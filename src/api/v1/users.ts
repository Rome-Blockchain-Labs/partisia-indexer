import { Router } from 'express';
import db from '../../db/client';

export function createUsersRouter(): Router {
  const router = Router();

  // Get top users by balance
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db.query(
        `SELECT address, balance, first_seen, last_seen
         FROM users
         ORDER BY CAST(balance AS NUMERIC) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const users = result.rows.map(row => ({
        address: row.address,
        balance: row.balance,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen
      }));

      res.apiSuccess({
        users,
        count: users.length,
        hasMore: users.length === limit
      });
    } catch (error) {
      next(error);
    }
  });

  // Get user by address
  router.get('/:address', async (req, res, next) => {
    try {
      const { address } = req.params;

      const result = await db.query(
        `SELECT address, balance, first_seen, last_seen
         FROM users
         WHERE address = $1`,
        [address]
      );

      if (result.rows.length === 0) {
        return res.apiError(
          'USER_NOT_FOUND',
          `User ${address} not found`,
          404
        );
      }

      const user = result.rows[0];
      res.apiSuccess({
        address: user.address,
        balance: user.balance,
        firstSeen: user.first_seen,
        lastSeen: user.last_seen
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
