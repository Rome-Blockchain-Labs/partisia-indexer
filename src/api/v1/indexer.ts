import { Router } from 'express';
import config from '../../config';

export function createIndexerRouter(): Router {
  const router = Router();

  router.get('/status', async (req, res, next) => {
    try {
      const indexer = require('../../indexer').default;
      const txIndexerEnabled = process.env.ENABLE_TX_INDEXER !== 'false';

      const stateStats = await indexer.getStats();

      const response: any = {
        state: {
          currentBlock: stateStats.lastIndexedBlock,
          targetBlock: stateStats.currentBlockHeight,
          blocksRemaining: Math.max(0, stateStats.currentBlockHeight - stateStats.lastIndexedBlock),
          progressPercent: stateStats.progressPercent,
          blocksPerSecond: stateStats.performance.blocksPerSecond,
          syncComplete: stateStats.syncComplete
        },
        overall: {
          syncing: !stateStats.syncComplete,
          healthy: stateStats.isHealthy
        }
      };

      // Only include TX indexer stats if enabled
      if (txIndexerEnabled) {
        const transactionIndexer = require('../../transactionIndexer').default;
        const txStats = transactionIndexer.getStats();

        // Calculate offset from deployment block for proper progress display
        const currentBlock = (txStats.lastProcessedBlock || config.blockchain.deploymentBlock) - config.blockchain.deploymentBlock;
        const targetBlock = stateStats.currentBlockHeight - config.blockchain.deploymentBlock;

        response.transactions = {
          enabled: true,
          currentBlock: currentBlock,
          targetBlock: targetBlock,
          blocksRemaining: Math.max(0, targetBlock - currentBlock),
          transactionsProcessed: txStats.transactionsProcessed || 0,
          contractTxFound: txStats.contractTxFound || 0,
          adminTxFound: txStats.adminTxFound || 0,
          blocksPerSecond: txStats.blocksPerSecond || 0
        };
      } else {
        response.transactions = {
          enabled: false,
          message: 'Transaction indexer is disabled'
        };
      }

      res.apiSuccess(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
