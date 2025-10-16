import db from '../db/client';
import config from '../config';

interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
}

interface OHLCData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class MEXCRestService {
  private readonly symbol: string;
  private readonly baseUrl = config.api.mexcBaseUrl;

  private running = false;
  private lastKlineTime = 0;
  private syncInterval: NodeJS.Timeout | null = null;

  private readonly SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.symbol = process.env.MEXC_SYMBOL || 'MPCUSDT';

    console.log('MEXC Historical Price Service initialized');
    console.log(`Symbol: ${this.symbol}`);
    console.log(`Sync interval: ${this.SYNC_INTERVAL / 1000 / 60}min`);
    console.log(`Contract deployment: ${config.blockchain.deploymentTimestamp.toISOString()}`);
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('Starting MEXC historical price service');

    // Initial backfill of recent data
    await this.syncHistoricalData();

    // Set up regular sync
    this.syncInterval = setInterval(async () => {
      if (this.running) {
        await this.syncHistoricalData();
      }
    }, this.SYNC_INTERVAL);
  }

  private async syncHistoricalData(): Promise<void> {
    try {
      // Get last stored timestamp
      const lastResult = await db.query(`
        SELECT MAX(timestamp) as last_timestamp
        FROM price_history
        WHERE source = 'mexc_klines'
      `);

      const lastTimestamp = lastResult.rows[0]?.last_timestamp;
      const startTime = lastTimestamp
        ? new Date(lastTimestamp).getTime() + 24 * 60 * 60 * 1000 // Start from next day
        : config.blockchain.deploymentTimestamp.getTime(); // Start from contract deployment

      const now = Date.now();

      // Don't fetch future data
      if (startTime >= now) {
        console.log('📊 Already up to date with MEXC price data');
        return;
      }

      const url = `${this.baseUrl}/klines?symbol=${this.symbol}&interval=1d&startTime=${startTime}&limit=1000`;
      console.log(`🔍 Fetching MEXC data from: ${new Date(startTime).toISOString()}`);
      console.log(`🔗 URL: ${url}`);

      // Fetch daily klines from MEXC
      const response = await fetch(url);

      console.log(`📡 MEXC API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const klines: number[][] = await response.json();

      if (klines.length === 0) {
        console.log('📊 No new price data to sync');
        return;
      }

      console.log(`📊 Syncing ${klines.length} daily price records from MEXC`);

      // Process and save klines
      for (const kline of klines) {
        const ohlcData: OHLCData = {
          timestamp: new Date(kline[0]), // openTime
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[7]) // quoteAssetVolume (USDT volume)
        };

        console.log(`💾 Saving OHLC data for ${ohlcData.timestamp.toISOString()}: $${ohlcData.close}`);
        await this.saveOHLCData(ohlcData);
      }

      console.log(`✅ MEXC price sync complete: ${klines.length} records`);

    } catch (error) {
      console.error('❌ Failed to sync MEXC historical data:', error);
      console.error('Error details:', error.stack);
    }
  }

  private async saveOHLCData(ohlc: OHLCData): Promise<void> {
    try {
      await db.query(`
        INSERT INTO price_history (timestamp, price_usd, market_cap_usd, volume_24h_usd, source, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (timestamp, source) DO UPDATE SET
          price_usd = EXCLUDED.price_usd,
          volume_24h_usd = EXCLUDED.volume_24h_usd,
          metadata = EXCLUDED.metadata
      `, [
        ohlc.timestamp,
        ohlc.close, // Use closing price as main price
        null, // No market cap from MEXC
        ohlc.volume,
        'mexc_klines',
        JSON.stringify({
          open: ohlc.open,
          high: ohlc.high,
          low: ohlc.low,
          close: ohlc.close
        })
      ]);
    } catch (error) {
      console.error('Error saving OHLC data:', error);
    }
  }

  // Keep current price method for API compatibility
  getCurrentPrice(): { price: number; timestamp: Date } | null {
    // This could fetch latest from DB or make a spot call
    return null;
  }

  getStats() {
    return {
      symbol: this.symbol,
      running: this.running,
      lastSync: this.lastKlineTime,
      syncInterval: this.SYNC_INTERVAL
    };
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('MEXC historical price service stopped');
  }
}

export default new MEXCRestService();