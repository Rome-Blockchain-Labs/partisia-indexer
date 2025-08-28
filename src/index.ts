// src/index.ts
import 'dotenv/config';
import indexer from './services/indexer';
import coingecko from './services/coingecko';
import db from './db/client';

async function main() {
  try {
    console.log('Starting LS Contract Indexer with CoinGecko prices');

    // wait for DB to be ready
    await new Promise(r => setTimeout(r, 2000));

    // indexers in parallel
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
