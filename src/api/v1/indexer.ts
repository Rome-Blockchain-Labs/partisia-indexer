import { Router } from 'express';
import config from '../../config';

export function createIndexerRouter(): Router {
  const router = Router();

  router.get('/status', async (req, res, next) => {
    try {
      const indexer = require('../../indexer').default;
      const transactionIndexer = require('../../transactionIndexer').default;

      const stateStats = await indexer.getStats();
      const txStats = transactionIndexer.getStats();

      res.apiSuccess({
        state: {
          currentBlock: stateStats.lastIndexedBlock,
          targetBlock: stateStats.currentBlockHeight,
          blocksRemaining: Math.max(0, stateStats.currentBlockHeight - stateStats.lastIndexedBlock),
          progressPercent: stateStats.progressPercent,
          blocksPerSecond: stateStats.performance.blocksPerSecond,
          syncComplete: stateStats.syncComplete
        },
        transactions: {
          currentBlock: txStats.lastProcessedBlock || config.blockchain.deploymentBlock,
          transactionsProcessed: txStats.transactionsProcessed || 0,
          contractTxFound: txStats.contractTxFound || 0,
          adminTxFound: txStats.adminTxFound || 0
        },
        overall: {
          syncing: !stateStats.syncComplete,
          healthy: stateStats.isHealthy
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
