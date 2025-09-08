import 'dotenv/config';
import indexer from './services/indexer';
import coingecko from './services/coingecko';
import db from './db/client';
import app from './api/endpoints';

const PORT = process.env.API_PORT || 3002;

async function main() {
  try {
    console.log('Starting Partisia Indexer');

    // Start API server immediately
    app.listen(PORT, () => {
      console.log(`API server started on port ${PORT}`);
    });

    // Wait for DB to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Start indexers in background
    await Promise.all([
      indexer.start(),
      coingecko.start()
    ]);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  indexer.stop();
  coingecko.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  indexer.stop();
  coingecko.stop();
  await db.close();
  process.exit(0);
});

main();
