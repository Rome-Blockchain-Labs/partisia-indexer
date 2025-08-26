import 'dotenv/config';
import indexer from './services/indexer';
import db from './db/client';

async function main() {
  try {
    console.log('Starting LS Contract Indexer');
    
    // Initialize database - schema is handled by docker-entrypoint-initdb.d
    await new Promise(r => setTimeout(r, 2000)); // Wait for DB to be ready
    
    await indexer.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  indexer.stop();
  await db.close();
  process.exit(0);
});

main();

// Initialize schema on startup
async function initDatabase() {
  const schemaSQL = require('fs').readFileSync('./src/db/schema.sql', 'utf8');
  await db.query(schemaSQL);
}
