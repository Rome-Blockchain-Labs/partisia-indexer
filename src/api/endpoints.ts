import express from 'express';
import path from 'path';
import { createYoga } from 'graphql-yoga';
import { schema } from '../graphql/schema';
import { responseMiddleware, errorHandler } from './middleware/response';
import { createV1Router } from './v1';

const VERSION = require('../../package.json').version;

const app = express();

// Security middleware
app.use(express.json({ limit: '1mb' }));
app.use('/api', express.json({ limit: '100kb' }));

// CORS and security headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Response formatting middleware
app.use(responseMiddleware);

// Rate limiting (simple in-memory implementation)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10000; // requests per minute
const WINDOW_MS = 60 * 1000;

app.use((req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();

  if (!rateLimit.has(key)) {
    rateLimit.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  const limit = rateLimit.get(key)!;
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + WINDOW_MS;
    return next();
  }

  if (limit.count >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  limit.count++;
  next();
});

// Mount v1 API routes
app.use('/api/v1', createV1Router());

// GraphQL endpoint
const yoga = createYoga({
  schema,
  graphiql: true,
  graphqlEndpoint: '/graphql'
});

app.use('/graphql', yoga);

// Serve frontend static files
const frontendBuildPath = path.join(__dirname, '../../example-graph/build');
console.log(`✅ Serving frontend from ${frontendBuildPath}`);
app.use(express.static(frontendBuildPath));

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    version: VERSION,
    endpoints: {
      rest: {
        '/api/v1/health': 'System health check',
        '/api/v1/indexer/status': 'Indexer sync status',
        '/api/v1/contract/current': 'Current contract state',
        '/api/v1/contract/history': 'Contract state history',
        '/api/v1/transactions': 'List transactions',
        '/api/v1/transactions/:txHash': 'Get transaction by hash',
        '/api/v1/rewards/accrue': 'Accrue reward transactions',
        '/api/v1/users': 'List users',
        '/api/v1/users/:address': 'Get user by address',
        '/api/v1/analytics/apy': 'APY calculations',
        '/api/v1/analytics/daily': 'Daily aggregated data',
        '/api/v1/analytics/stats': 'Protocol statistics',
        '/api/v1/analytics/stats/combined': 'Combined stats with price data',
        '/api/v1/analytics/exchange-rates': 'Exchange rate history',
        '/api/v1/prices/current': 'Current MPC token price',
        '/api/v1/prices/history': 'Historical MPC prices'
      },
      graphql: {
        endpoint: '/graphql',
        playground: '/graphql',
        description: 'GraphQL API with interactive playground'
      }
    }
  });
});

// Root endpoint - Smart routing (SPA + API)
app.get('/', (req, res) => {
  // Check if request accepts HTML (browser request)
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Serve the frontend app
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  } else {
    // Return API info for JSON requests
    res.json({
      message: 'Partisia Blockchain Indexer API',
      version: VERSION,
      endpoints: {
        frontend: '/ (React dashboard)',
        graphql: '/graphql',
        rest_api: '/api/v1',
        api_docs: '/api'
      }
    });
  }
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api') && !req.path.startsWith('/graphql')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Error handler middleware (must be last)
app.use(errorHandler);

export default app;
