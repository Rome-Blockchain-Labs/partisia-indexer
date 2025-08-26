export default {
  blockchain: {
    apiUrl: process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com',
    contractAddress: process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6',
    deploymentBlock: parseInt(process.env.DEPLOYMENT_BLOCK || '10547814'),
    deploymentTx: process.env.DEPLOYMENT_TX || 'd20bdb67fd5e52f21e2229a7fc82abf81cbb36acfe196faa1ad49ddfa7abdda6',
    deploymentTimestamp: new Date('2025-06-19T13:48:00Z'),
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'ls_indexer',
    user: process.env.DB_USER || 'indexer',
    password: process.env.DB_PASSWORD || 'changeme',
  },
  indexer: {
    intervalSeconds: parseInt(process.env.INDEX_INTERVAL_S || '10'),
    batchSize: parseInt(process.env.BATCH_SIZE || '100'),
  }
};
