// MEXC REST API Price Service - Simple & Reliable
// No WebSocket complexity, just reliable REST polling

import db from '../db/client';

interface PriceData {
  timestamp: Date;
  priceUsd: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  changePercent24h?: number;
}

class MEXCRestService {
  private readonly symbol: string;
  private readonly baseUrl = 'https://api.mexc.com/api/v3';

  private running = false;
  private currentPrice: PriceData | null = null;
  private lastUpdate = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  // Poll interval from env or default
  private readonly POLL_INTERVAL: number;

  constructor() {
    // Load from environment - NO HARDCODED SECRETS!
    this.symbol = process.env.MEXC_SYMBOL || 'MPCUSDT';
    this.POLL_INTERVAL = (parseInt(process.env.MEXC_POLL_INTERVAL || '10') || 10) * 1000;

    console.log('MEXC REST Service initialized');
    console.log(`Symbol: ${this.symbol}`);
    console.log(`Poll interval: ${this.POLL_INTERVAL}ms`);
    // API key not needed for public endpoints
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('Starting MEXC REST price service');

    // Get initial price
    await this.fetchPrice();

    // Start polling
    this.pollInterval = setInterval(async () => {
      if (this.running) {
        await this.fetchPrice();
      }
    }, this.POLL_INTERVAL);
  }

  private async fetchPrice(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr?symbol=${this.symbol}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      this.currentPrice = {
        timestamp: new Date(),
        priceUsd: parseFloat(data.lastPrice),
        volume24h: parseFloat(data.quoteVolume), // MEXC provides volume in USDT already
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        changePercent24h: parseFloat(data.priceChangePercent)
      };

      this.lastUpdate = Date.now();

      // Log price updates (every 5th update to avoid spam)
      if (Math.random() < 0.2) {
        console.log(`MPC: $${this.currentPrice.priceUsd.toFixed(6)} (${this.currentPrice.changePercent24h?.toFixed(2)}% 24h)`);
      }

      // Save to database
      await this.savePriceData(this.currentPrice);

    } catch (error) {
      console.error('Failed to fetch MEXC price:', error);
    }
  }

  private async savePriceData(priceData: PriceData): Promise<void> {
    try {
      await db.query(`
        INSERT INTO price_history (timestamp, price_usd, market_cap_usd, volume_24h_usd, source)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (timestamp) DO UPDATE SET
          price_usd = EXCLUDED.price_usd,
          volume_24h_usd = EXCLUDED.volume_24h_usd,
          source = EXCLUDED.source
      `, [
        priceData.timestamp,
        priceData.priceUsd,
        null, // MEXC doesn't provide market cap
        priceData.volume24h,
        'MEXC'  // Track source
      ]);
    } catch (error) {
      // Silently ignore DB errors if database isn't available
    }
  }

  async getCurrentPrice(): Promise<PriceData | null> {
    // Return cached price if fresh (within 60 seconds)
    if (this.currentPrice && (Date.now() - this.lastUpdate) < 60000) {
      return this.currentPrice;
    }

    // Otherwise fetch fresh price
    await this.fetchPrice();
    return this.currentPrice;
  }

  stop(): void {
    this.running = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('MEXC REST service stopped');
  }

  getStats() {
    return {
      running: this.running,
      lastUpdate: this.lastUpdate,
      currentPrice: this.currentPrice?.priceUsd,
      volume24h: this.currentPrice?.volume24h,
      changePercent24h: this.currentPrice?.changePercent24h,
      timeSinceUpdate: this.lastUpdate ? Date.now() - this.lastUpdate : null,
      pollInterval: this.POLL_INTERVAL
    };
  }

  // Backward compatibility with old price service
  async getHistoricalPrice(date: string): Promise<PriceData | null> {
    // MEXC doesn't provide historical data via public API
    // Would need to use stored DB data
    try {
      const result = await db.query(`
        SELECT timestamp, price_usd, volume_24h_usd
        FROM price_history
        WHERE DATE(timestamp) = $1
        ORDER BY timestamp DESC
        LIMIT 1
      `, [date]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          timestamp: row.timestamp,
          priceUsd: parseFloat(row.price_usd),
          volume24h: parseFloat(row.volume_24h_usd)
        };
      }
    } catch (error) {
      // Ignore DB errors
    }

    return null;
  }
}

export default new MEXCRestService();