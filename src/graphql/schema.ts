import { createSchema } from 'graphql-yoga'
import { Pool } from 'pg'
import config from '../config'

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
});

export const schema = createSchema({
  typeDefs: `
    type Query {
      contractStates(first: Int = 100, skip: Int = 0, orderBy: OrderBy = BLOCK_DESC, where: StateFilter): [ContractState!]!
      users(first: Int = 100, skip: Int = 0, orderBy: UserOrderBy = BALANCE_DESC): [User!]!
      currentState: CurrentState!
      exchangeRate: ExchangeRate!
      priceHistory(hours: Int = 24): [Price!]!
    }
    
    type ContractState {
      blockNumber: String!
      timestamp: String!
      exchangeRate: String!
      totalPoolStakeToken: String!
      totalPoolLiquid: String!
      stakeTokenBalance: String!
    }
    
    type User {
      address: String!
      balance: String!
      firstSeen: String!
      lastSeen: String!
    }
    
    type CurrentState {
      blockNumber: String!
      exchangeRate: String!
      totalStaked: String!
      totalLiquid: String!
      tvlUsd: String!
    }
    
    type ExchangeRate {
      mpcPrice: Float!
      exchangeRate: Float!
      smpcPrice: Float!
      premium: String!
    }
    
    type Price {
      timestamp: String!
      priceUsd: Float!
      marketCap: Float
      volume: Float
    }
    
    input StateFilter {
      exchangeRate_gt: Float
      exchangeRate_lt: Float
      blockNumber_gte: Int
      blockNumber_lte: Int
      timestamp_after: String
      timestamp_before: String
    }
    
    enum OrderBy {
      BLOCK_DESC
      BLOCK_ASC
      RATE_DESC
      RATE_ASC
      TIMESTAMP_DESC
      TIMESTAMP_ASC
    }
    
    enum UserOrderBy {
      BALANCE_DESC
      BALANCE_ASC
      FIRST_SEEN_DESC
      FIRST_SEEN_ASC
    }
  `,
  
  resolvers: {
    Query: {
      contractStates: async (_, { first, skip, orderBy, where }) => {
        let query = 'SELECT * FROM contract_states WHERE 1=1'
        const params = []
        
        if (where) {
          if (where.exchangeRate_gt) {
            params.push(where.exchangeRate_gt)
            query += ` AND exchange_rate > $${params.length}`
          }
          if (where.exchangeRate_lt) {
            params.push(where.exchangeRate_lt)
            query += ` AND exchange_rate < $${params.length}`
          }
          if (where.blockNumber_gte) {
            params.push(where.blockNumber_gte)
            query += ` AND block_number >= $${params.length}`
          }
          if (where.blockNumber_lte) {
            params.push(where.blockNumber_lte)
            query += ` AND block_number <= $${params.length}`
          }
          if (where.timestamp_after) {
            params.push(where.timestamp_after)
            query += ` AND timestamp > $${params.length}`
          }
          if (where.timestamp_before) {
            params.push(where.timestamp_before)
            query += ` AND timestamp < $${params.length}`
          }
        }
        
        const orderMap = {
          BLOCK_DESC: 'block_number DESC',
          BLOCK_ASC: 'block_number ASC',
          RATE_DESC: 'exchange_rate DESC',
          RATE_ASC: 'exchange_rate ASC',
          TIMESTAMP_DESC: 'timestamp DESC',
          TIMESTAMP_ASC: 'timestamp ASC'
        }
        
        query += ` ORDER BY ${orderMap[orderBy]}`
        query += ` LIMIT ${first} OFFSET ${skip}`
        
        const result = await pool.query(query, params)
        return result.rows.map(r => ({
          blockNumber: r.block_number,
          timestamp: r.timestamp.toISOString(),
          exchangeRate: r.exchange_rate,
          totalPoolStakeToken: r.total_pool_stake_token,
          totalPoolLiquid: r.total_pool_liquid,
          stakeTokenBalance: r.stake_token_balance
        }))
      },
      
      users: async (_, { first, skip, orderBy }) => {
        const orderMap = {
          BALANCE_DESC: 'CAST(balance AS NUMERIC) DESC',
          BALANCE_ASC: 'CAST(balance AS NUMERIC) ASC',
          FIRST_SEEN_DESC: 'first_seen DESC',
          FIRST_SEEN_ASC: 'first_seen ASC'
        }
        
        const result = await pool.query(
          `SELECT * FROM users ORDER BY ${orderMap[orderBy]} LIMIT $1 OFFSET $2`,
          [first, skip]
        )
        return result.rows.map(r => ({
          address: r.address,
          balance: r.balance,
          firstSeen: r.first_seen.toISOString(),
          lastSeen: r.last_seen.toISOString()
        }))
      },
      
      currentState: async () => {
        const [state, price] = await Promise.all([
          pool.query('SELECT * FROM current_state WHERE id = 1'),
          pool.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
        ])
        
        const s = state.rows[0]
        const p = parseFloat(price.rows[0]?.price_usd) || 0
        const staked = BigInt(s?.total_pool_stake_token || '0')
        const liquid = BigInt(s?.total_pool_liquid || '0')

        return {
          blockNumber: s?.block_number || '0',
          exchangeRate: s?.exchange_rate || '1.0',
          totalStaked: staked.toString(),
          totalLiquid: liquid.toString(),
          tvlUsd: (Number(staked) / 1e6 * p).toFixed(2)
        }
      },
      
      exchangeRate: async () => {
        const [state, price] = await Promise.all([
          pool.query('SELECT exchange_rate FROM current_state WHERE id = 1'),
          pool.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
        ])
        
        const rate = parseFloat(state.rows[0]?.exchange_rate) || 1.0
        const mpc = parseFloat(price.rows[0]?.price_usd) || 0
        
        return {
          mpcPrice: mpc,
          exchangeRate: rate,
          smpcPrice: mpc * rate,
          premium: ((rate - 1) * 100).toFixed(2) + '%'
        }
      },
      
      priceHistory: async (_, { hours }) => {
        const result = await pool.query(
          `SELECT timestamp, price_usd, market_cap_usd, volume_24h_usd 
           FROM price_history 
           WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
           ORDER BY timestamp DESC`,
          [hours])
        return result.rows.map(r => ({
          timestamp: r.timestamp.toISOString(),
          priceUsd: parseFloat(r.price_usd),
          marketCap: r.market_cap_usd ? parseFloat(r.market_cap_usd) : null,
          volume: r.volume_24h_usd ? parseFloat(r.volume_24h_usd) : null
        }))
      }
    }
  }
})
