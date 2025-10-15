import WebSocket from 'ws';
import * as crypto from 'crypto';
import db from '../db/client';

interface PriceData {
  timestamp: Date;
  priceUsd: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  changePercent24h?: number;
}

interface MEXCTicker {
  symbol: string;
  lastPrice: string;
  volume: string;
  high: string;
  low: string;
  change: string;
  changePercent: string;
  time: number;
}

class MEXCPriceService {
  private readonly apiKey = 'mx0vglA2KctCi6rGll';
  private readonly apiSecret = 'ff384fc6bc59455eb7f99603097372a2';
  private readonly wsUrl = 'wss://wbs.mexc.com/raw/ws';  // Use raw WebSocket endpoint
  private readonly symbol = 'MPCUSDT';

  private ws: WebSocket | null = null;
  private running = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  private currentPrice: PriceData | null = null;
  private lastUpdate = 0;

  constructor() {
    console.log('MEXC Price Service initialized');
    console.log(`Symbol: ${this.symbol}`);
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('Starting MEXC WebSocket price service');
    this.connect();
  }

  private connect(): void {
    if (!this.running) return;

    console.log(`Connecting to MEXC WebSocket...`);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('MEXC WebSocket connected');
      this.reconnectAttempts = 0;

      // Subscribe to ticker updates for MPC/USDT
      // Try simple ticker subscription
      const subscribeMsg = {
        method: 'SUBSCRIPTION',
        params: [`spot@public.deals.v3.api@${this.symbol}`]
      };

      this.ws?.send(JSON.stringify(subscribeMsg));
      console.log(`Subscribed to ${this.symbol} ticker`);

      // Send ping every 30 seconds to keep connection alive
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing MEXC message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('MEXC WebSocket error:', error);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`MEXC WebSocket closed: ${code} - ${reason}`);
      this.stopHeartbeat();
      this.handleReconnect();
    });
  }

  private handleMessage(message: any): void {
    // Debug log to see message structure
    if (message.code || message.msg) {
      console.log('MEXC message:', message);
    }

    // MEXC sends ticker data in the 'd' field
    if (message.d && message.c) {
      console.log('Ticker update:', message.c);
      const ticker = message.d as any;

      this.currentPrice = {
        timestamp: new Date(),
        priceUsd: parseFloat(ticker.lastPrice),
        volume24h: parseFloat(ticker.volume),
        high24h: parseFloat(ticker.high),
        low24h: parseFloat(ticker.low),
        changePercent24h: parseFloat(ticker.changePercent)
      };

      this.lastUpdate = Date.now();

      // Save to database
      this.savePriceData(this.currentPrice);

      // Log every 10th update to avoid spam
      if (Math.random() < 0.1) {
        console.log(`MPC: $${this.currentPrice.priceUsd.toFixed(6)} (${this.currentPrice.changePercent24h?.toFixed(2)}%)`);
      }
    }
  }

  private heartbeatInterval: NodeJS.Timeout | null = null;

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'PING' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleReconnect(): void {
    if (!this.running) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async savePriceData(priceData: PriceData): Promise<void> {
    try {
      await db.query(`
        INSERT INTO price_history (timestamp, price_usd, market_cap_usd, volume_24h_usd)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (timestamp) DO UPDATE SET
          price_usd = EXCLUDED.price_usd,
          volume_24h_usd = EXCLUDED.volume_24h_usd
      `, [
        priceData.timestamp,
        priceData.priceUsd,
        null, // MEXC doesn't provide market cap directly
        priceData.volume24h
      ]);
    } catch (error) {
      // Silently ignore DB errors if database isn't available
      if (this.lastUpdate % 100 === 0) {
        console.debug('Price save skipped (DB unavailable)');
      }
    }
  }

  async getCurrentPrice(): Promise<PriceData | null> {
    // Return cached price if fresh (within 60 seconds)
    if (this.currentPrice && (Date.now() - this.lastUpdate) < 60000) {
      return this.currentPrice;
    }

    // If WebSocket isn't connected or price is stale, fetch via REST API
    return this.fetchRestPrice();
  }

  private async fetchRestPrice(): Promise<PriceData | null> {
    try {
      const response = await fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${this.symbol}`);
      const data = await response.json();

      return {
        timestamp: new Date(),
        priceUsd: parseFloat(data.lastPrice),
        volume24h: parseFloat(data.volume),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        changePercent24h: parseFloat(data.priceChangePercent)
      };
    } catch (error) {
      console.error('Failed to fetch REST price:', error);
      return null;
    }
  }

  stop(): void {
    this.running = false;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Service stopping');
      this.ws = null;
    }

    console.log('MEXC price service stopped');
  }

  getStats() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      lastUpdate: this.lastUpdate,
      currentPrice: this.currentPrice?.priceUsd,
      volume24h: this.currentPrice?.volume24h,
      changePercent24h: this.currentPrice?.changePercent24h,
      reconnectAttempts: this.reconnectAttempts,
      timeSinceUpdate: this.lastUpdate ? Date.now() - this.lastUpdate : null
    };
  }

  // Backward compatibility methods
  async getHistoricalPrice(date: string): Promise<PriceData | null> {
    // MEXC doesn't provide historical data via WebSocket
    // Would need to implement REST API calls or use stored DB data
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
      console.error('Error fetching historical price:', error);
    }

    return null;
  }
}

export default new MEXCPriceService();