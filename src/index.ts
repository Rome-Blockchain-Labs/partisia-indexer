import 'dotenv/config';
import indexer from './services/indexer';
import mexcService from './services/mexc-rest-service';
import eventIndexer from './services/event-indexer';
import rewardTracker from './reward-tracker';
import db from './db/client';
import app from './api/endpoints';

const PORT = process.env.API_PORT || 3002;

async function main() {
  try {
    console.log('Starting Partisia Indexer');

    // Start API server
    app.listen(PORT, () => {
      console.log(`API server: http://localhost:${PORT}`);
      console.log(`Reward tracking: /api/rewards/*`);
    });

    // Wait for DB to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Start all services in parallel
    const services = [
      indexer.start(),         // Contract state indexer
      mexcService.start(),     // MEXC REST price feed (simple & reliable!)
      eventIndexer.start()     // Event indexer
    ];

    // Try to start reward tracker but don't fail if tables missing
    try {
      await rewardTracker.start();
    } catch (error) {
      console.log('⚠️  Reward tracker disabled (tables missing)');
    }

    await Promise.all(services);

    // Index historical events on startup
    await eventIndexer.fetchHistoricalEvents();

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  indexer.stop();
  mexcService.stop();
  eventIndexer.stop();
  rewardTracker.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  indexer.stop();
  mexcService.stop();
  eventIndexer.stop();
  rewardTracker.stop();
  await db.close();
  process.exit(0);
});

main();
