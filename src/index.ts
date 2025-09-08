import 'dotenv/config';
import indexer from './services/indexer';
import coingecko from './services/coingecko';
import './api/endpoints';  // Start API immediately
import db from './db/client';

async function main() {
  try {
    console.log('Starting Partisia Indexer');
    
    // Start API server immediately
    console.log('API server started on port', process.env.API_PORT || 3002);
    
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

main();
