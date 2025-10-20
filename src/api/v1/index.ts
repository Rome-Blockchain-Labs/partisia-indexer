import { Router } from 'express';
import { createHealthRouter } from './health';
import { createIndexerRouter } from './indexer';
import { createContractRouter } from './contract';
import { createTransactionsRouter } from './transactions';
import { createRewardsRouter } from './rewards';
import { createAnalyticsRouter } from './analytics';
import { createPricesRouter } from './prices';
import { createUsersRouter } from './users';

export function createV1Router(): Router {
  const router = Router();

  // Core endpoints
  router.use('/health', createHealthRouter());
  router.use('/indexer', createIndexerRouter());
  router.use('/contract', createContractRouter());

  // Data endpoints
  router.use('/transactions', createTransactionsRouter());
  router.use('/rewards', createRewardsRouter());
  router.use('/users', createUsersRouter());

  // Analytics endpoints
  router.use('/analytics', createAnalyticsRouter());
  router.use('/prices', createPricesRouter());

  return router;
}
