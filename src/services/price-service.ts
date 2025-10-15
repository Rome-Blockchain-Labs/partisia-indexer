import axios, { AxiosError } from 'axios';
import db from '../db/client';

interface PriceData {
  timestamp: Date;
  priceUsd: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
}

interface RateLimitState {
  requestTimes: number[];
  hourlyRequestTimes: number[];
  backoffMs: number;
  lastRequest: number;
}

class PriceService {
  private readonly apiKey: string;
  private readonly coinId: string;
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  private running = false;
  private rateLimitState: RateLimitState = {
    requestTimes: [],
    hourlyRequestTimes: [],
    backoffMs: 1000,
    lastRequest: 0
  };

  private readonly cache = new Map<string, { data: any; expires: number }>();

  // Conservative rate limits to avoid monthly quota exhaustion
  private readonly MINUTE_LIMIT = 30;
  private readonly HOUR_LIMIT = 500;
  private readonly MAX_BACKOFF = 300_000; // 5 minutes
  private readonly BACKOFF_MULTIPLIER = 1.5;

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY || '';
    this.coinId = process.env.COINGECKO_COIN_ID || 'partisia-blockchain';

    // Cleanup intervals
    setInterval(() => this.pruneRateLimitHistory(), 60_000);
    setInterval(() => this.pruneCache(), 300_000);
  }

  private pruneRateLimitHistory(): void {
    const now = Date.now();
    this.rateLimitState.requestTimes = this.rateLimitState.requestTimes
      .filter(time => now - time < 60_000);
    this.rateLimitState.hourlyRequestTimes = this.rateLimitState.hourlyRequestTimes
      .filter(time => now - time < 3_600_000);
  }

  private pruneCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Check minute limit
    if (this.rateLimitState.requestTimes.length >= this.MINUTE_LIMIT) {
      const oldestRequest = this.rateLimitState.requestTimes[0];
      const waitTime = 60_000 - (now - oldestRequest);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // Check hourly limit
    if (this.rateLimitState.hourlyRequestTimes.length >= this.HOUR_LIMIT) {
      const oldestRequest = this.rateLimitState.hourlyRequestTimes[0];
      const waitTime = 3_600_000 - (now - oldestRequest);
      if (waitTime > 0) {
        console.warn(`Rate limit: waiting ${Math.round(waitTime / 60_000)} minutes`);
        await this.sleep(waitTime);
      }
    }

    // Apply backoff
    const timeSinceLastRequest = now - this.rateLimitState.lastRequest;
    if (timeSinceLastRequest < this.rateLimitState.backoffMs) {
      await this.sleep(this.rateLimitState.backoffMs - timeSinceLastRequest);
    }

    // Record request
    this.rateLimitState.requestTimes.push(Date.now());
    this.rateLimitState.hourlyRequestTimes.push(Date.now());
    this.rateLimitState.lastRequest = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    });
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}, cacheTtlMs = 300_000): Promise<any> {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    await this.enforceRateLimit();

    try {
      const config: any = {
        timeout: 10_000,
        params
      };

      if (this.apiKey) {
        config.headers = { 'x-cg-pro-api-key': this.apiKey };
      }

      const response = await axios.get(`${this.baseUrl}${endpoint}`, config);

      this.setCachedData(cacheKey, response.data, cacheTtlMs);
      this.rateLimitState.backoffMs = 1000; // Reset backoff on success

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        this.rateLimitState.backoffMs = Math.min(
          this.rateLimitState.backoffMs * this.BACKOFF_MULTIPLIER,
          this.MAX_BACKOFF
        );
        throw new Error('Rate limited by CoinGecko API');
      }
      throw error;
    }
  }

  async getCurrentPrice(): Promise<PriceData | null> {
    try {
      const data = await this.makeRequest('/simple/price', {
        ids: this.coinId,
        vs_currencies: 'usd',
        include_market_cap: true,
        include_24hr_vol: true
      }, 60_000); // 1 minute cache

      const coinData = data[this.coinId];
      if (!coinData) {
        throw new Error(`No price data found for coin: ${this.coinId}`);
      }

      return {
        timestamp: new Date(),
        priceUsd: coinData.usd,
        marketCapUsd: coinData.usd_market_cap,
        volume24hUsd: coinData.usd_24h_vol
      };
    } catch (error) {
      console.error('Failed to fetch current price:', error);
      return null;
    }
  }

  async getHistoricalPrice(date: string): Promise<PriceData | null> {
    try {
      const data = await this.makeRequest(`/coins/${this.coinId}/history`,
        { date },
        86_400_000 // 24 hour cache
      );

      if (!data.market_data) {
        return null;
      }

      return {
        timestamp: new Date(data.date || date),
        priceUsd: data.market_data.current_price?.usd || 0,
        marketCapUsd: data.market_data.market_cap?.usd,
        volume24hUsd: data.market_data.total_volume?.usd
      };
    } catch (error) {
      console.error(`Failed to fetch historical price for ${date}:`, error);
      return null;
    }
  }

  private async savePriceData(priceData: PriceData): Promise<void> {
    try {
      await db.query(`
        INSERT INTO price_history (timestamp, price_usd, market_cap_usd, volume_24h_usd, source)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (timestamp) DO UPDATE SET
          price_usd = EXCLUDED.price_usd,
          market_cap_usd = EXCLUDED.market_cap_usd,
          volume_24h_usd = EXCLUDED.volume_24h_usd,
          source = EXCLUDED.source
      `, [
        priceData.timestamp,
        priceData.priceUsd,
        priceData.marketCapUsd,
        priceData.volume24hUsd,
        'CoinGecko'  // Track source
      ]);
    } catch (error) {
      console.error('Failed to save price data:', error);
    }
  }

  private async backfillHistoricalPrices(): Promise<void> {
    try {
      const result = await db.query('SELECT MAX(timestamp) as last_price FROM price_history');
      const lastPriceDate = result.rows[0]?.last_price;
      const startDate = lastPriceDate ? new Date(lastPriceDate) : new Date('2025-06-19');
      const endDate = new Date();

      console.log(`Backfilling prices from ${startDate.toISOString().split('T')[0]}`);

      let currentDate = new Date(startDate);
      let backfilledCount = 0;

      while (currentDate <= endDate && this.running) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const [year, month, day] = dateStr.split('-');
        const cgDateFormat = `${day}-${month}-${year}`;

        try {
          const existingData = await db.query(
            'SELECT id FROM price_history WHERE DATE(timestamp) = $1',
            [dateStr]
          );

          if (existingData.rows.length === 0) {
            const priceData = await this.getHistoricalPrice(cgDateFormat);
            if (priceData) {
              await this.savePriceData(priceData);
              backfilledCount++;
              console.log(`Backfilled price for ${dateStr}: $${priceData.priceUsd}`);
            }
          }
        } catch (error) {
          console.error(`Error backfilling price for ${dateStr}:`, error);
          await this.sleep(5000);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`Historical price backfill complete: ${backfilledCount} new entries`);
    } catch (error) {
      console.error('Error during historical price backfill:', error);
    }
  }

  private async monitorPrices(): Promise<void> {
    const interval = setInterval(async () => {
      if (!this.running) {
        clearInterval(interval);
        return;
      }

      try {
        const priceData = await this.getCurrentPrice();
        if (priceData) {
          await this.savePriceData(priceData);
          console.log(`Updated MPC price: $${priceData.priceUsd}`);
        }
      } catch (error) {
        console.error('Error updating current price:', error);
      }
    }, 300_000); // 5 minutes
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('Starting price monitoring service');
    console.log(`Coin: ${this.coinId}`);
    console.log(`API key: ${this.apiKey ? 'configured' : 'using free tier'}`);

    await this.backfillHistoricalPrices();
    this.monitorPrices();
  }

  stop(): void {
    this.running = false;
    console.log('Price monitoring service stopped');
  }

  getStats() {
    return {
      requestsThisMinute: this.rateLimitState.requestTimes.length,
      requestsThisHour: this.rateLimitState.hourlyRequestTimes.length,
      currentBackoffMs: this.rateLimitState.backoffMs,
      cacheSize: this.cache.size,
      hasApiKey: !!this.apiKey
    };
  }
}

export default new PriceService();