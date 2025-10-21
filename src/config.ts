export default {
  blockchain: {
    apiUrl: process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com',
    shard: process.env.PARTISIA_SHARD || 'Shard2',
    contractAddress: process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6',
    deploymentBlock: parseInt(process.env.DEPLOYMENT_BLOCK || '10682802'),
    deploymentTx: process.env.DEPLOYMENT_TX || 'd20bdb67fd5e52f21e2229a7fc82abf81cbb36acfe196faa1ad49ddfa7abdda6',
    deploymentTimestamp: new Date(1750315778890), // Block 10682802 production time (2025-06-19T06:49:38.890Z)
  },
  api: {
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://partisia.subgraph.romenet.io'],
    corsPatterns: [
      /^https:\/\/.*\.sceptre\.fi$/,
      /^https:\/\/partisia\.subgraph\.romenet\.io$/
    ],
    mexcBaseUrl: process.env.MEXC_BASE_URL || 'https://api.mexc.com/api/v3',
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
