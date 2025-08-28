// src/services/coingecko.ts
import axios from 'axios';
import db from '../db/client';

class CoinGecko {
  private running = false;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY || '';
  }

  async start() {
    this.running = true;
    console.log('📈 Starting CoinGecko price monitor');
    
    const deploymentDate = new Date('2025-06-19T06:49:38.890Z');
    console.log(`📅 Contract deployment: ${deploymentDate.toISOString()}`);
    
    // Backfill historical prices
    await this.backfillHistoricalPrices(deploymentDate);
    
    // Monitor current price
    this.monitorCurrentPrice();
  }

  async backfillHistoricalPrices(startDate: Date) {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Check what we already have
    const result = await db.query(
      'SELECT MIN(timestamp) as min_date FROM price_history WHERE timestamp > $1',
      [startDate]
    );
    
    const lastFetched = result.rows[0]?.min_date || now;
    let currentDate = new Date(startDate);
    
    console.log(`📊 Backfilling prices from ${startDate.toISOString().split('T')[0]} to ${lastFetched.toISOString().split('T')[0]}`);
    
    while (currentDate < lastFetched) {
      const dateStr = `${currentDate.getUTCDate().toString().padStart(2,'0')}-${(currentDate.getUTCMonth()+1).toString().padStart(2,'0')}-${currentDate.getUTCFullYear()}`;
      
      try {
        const resp = await axios.get(
          `https://api.coingecko.com/api/v3/coins/partisia-blockchain/history?date=${dateStr}`,
          { headers: { 'x-cg-demo-api-key': this.apiKey } }
        );
        
        const price = resp.data.market_data?.current_price?.usd || 0;
        const marketCap = resp.data.market_data?.market_cap?.usd || 0;
        const volume = resp.data.market_data?.total_volume?.usd || 0;
        
        await db.query(
          'INSERT INTO price_history (timestamp, price_usd, market_cap_usd, volume_24h_usd) VALUES ($1, $2, $3, $4) ON CONFLICT (timestamp) DO NOTHING',
          [currentDate, price, marketCap, volume]
        );
        
        console.log(`💰 ${dateStr}: $${price}`);
        
        // 30 seconds between requests to avoid rate limits
        await new Promise(r => setTimeout(r, 30000));
        
      } catch (err: any) {
        console.error(`Failed ${dateStr}: ${err.message}`);
      }
      
      currentDate = new Date(currentDate.getTime() + dayMs);
    }
    
    console.log('✅ Historical price backfill complete');
  }

  async monitorCurrentPrice() {
    while (this.running) {
      try {
        const resp = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=partisia-blockchain&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`,
          { headers: { 'x-cg-demo-api-key': this.apiKey } }
        );
        
        const data = resp.data['partisia-blockchain'];
        const price = data?.usd || 0;
        const marketCap = data?.usd_market_cap || 0;
        const volume = data?.usd_24h_vol || 0;
        
        await db.query(
          'INSERT INTO price_history (timestamp, price_usd, market_cap_usd, volume_24h_usd) VALUES ($1, $2, $3, $4) ON CONFLICT (timestamp) DO UPDATE SET price_usd = $2, market_cap_usd = $3, volume_24h_usd = $4',
          [new Date(), price, marketCap, volume]
        );
        
        console.log(`💵 MPC: $${price} | MCap: $${(marketCap/1e6).toFixed(2)}M | Vol: $${(volume/1e3).toFixed(0)}K`);
        
      } catch (err: any) {
        console.error('Price error:', err.message);
      }
      
      await new Promise(r => setTimeout(r, 60000));
    }
  }

  stop() {
    this.running = false;
  }
}

export default new CoinGecko();
