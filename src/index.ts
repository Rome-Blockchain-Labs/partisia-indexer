import 'dotenv/config';
import indexer from './indexer';
import mexcService from './services/mexc-rest-service';
import db from './db/client';
import app from './api/endpoints';

const PORT = process.env.API_PORT || 3002;

async function main() {
  try {
    console.log('🚀 Starting Partisia Blockchain Indexer');

    // Start API server
    app.listen(PORT, () => {
      console.log(`🌐 API server: http://localhost:${PORT}`);
      console.log(`📊 Stats: /api/stats`);
      console.log(`💰 Current state: /api/current`);
    });

    // Wait for DB to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Start services
    await Promise.all([
      indexer.start(),        // Main unified indexer
      mexcService.start(),    // Price service
    ]);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  indexer.stop();
  mexcService.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  indexer.stop();
  mexcService.stop();
  await db.close();
  process.exit(0);
});

main();
