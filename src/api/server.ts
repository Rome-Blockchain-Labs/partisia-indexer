import express from 'express';
import db from '../db/client';

const app = express();

app.get('/api/stats', async (req, res) => {
  const stats = await db.query(`
    SELECT * FROM contract_states 
    ORDER BY timestamp DESC LIMIT 1
  `);
  
  const apy = await db.query(`
    SELECT * FROM apy_history 
    ORDER BY timestamp DESC LIMIT 1
  `);
  
  res.json({
    currentState: stats.rows[0],
    apy: apy.rows[0]
  });
});

app.get('/api/user/:address', async (req, res) => {
  const actions = await db.query(
    'SELECT * FROM user_actions WHERE user_address = $1 ORDER BY timestamp DESC',
    [req.params.address]
  );
  
  res.json(actions.rows);
});

app.get('/api/rewards', async (req, res) => {
  const rewards = await db.query(
    'SELECT * FROM rewards_accrued ORDER BY timestamp DESC LIMIT 100'
  );
  
  res.json(rewards.rows);
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
