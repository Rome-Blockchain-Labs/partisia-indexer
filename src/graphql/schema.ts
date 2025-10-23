import { createSchema } from 'graphql-yoga'
import db from '../db/client'
import { fromRawAmount, getTokenDecimals } from '../utils/denomination'

export const schema = createSchema({
  typeDefs: `
    type Query {
      contractStates(first: Int = 100, skip: Int = 0, orderBy: OrderBy = BLOCK_DESC, where: StateFilter): [ContractState!]!
      users(first: Int = 100, skip: Int = 0, orderBy: UserOrderBy = BALANCE_DESC): [User!]!
      transactions(first: Int = 100, skip: Int = 0, orderBy: TransactionOrderBy = BLOCK_DESC, where: TransactionFilter): [Transaction!]!
      rewards(first: Int = 100, skip: Int = 0, orderBy: TransactionOrderBy = BLOCK_DESC): [Transaction!]!
      currentState: CurrentState!
      exchangeRate: ExchangeRate!
      priceHistory(hours: Int = 24): [Price!]!
      dailyRewards(days: Int = 30, granularity: String): [DailyRewardActual!]!
      dailyHistory(days: Int = 30, granularity: String): [DailyData!]!
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

    type Transaction {
      txHash: String!
      blockNumber: String!
      timestamp: String!
      action: String!
      sender: String!
      amount: String!
      metadata: String
      stakeTokenAmount: String
      exchangeRate: Float
    }
    
    type CurrentState {
      blockNumber: String!
      exchangeRate: String!
      totalStaked: String!
      totalLiquid: String!
      totalStakedRaw: String!
      totalLiquidRaw: String!
      tokenDecimals: Int!
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

    type DailyRewardActual {
      date: String!
      blockNumber: String!
      rewardAmountMpc: String!
      rewardAmountUsd: Float!
      exchangeRateChange: Float!
      dailyRateMpc: Float!
      dailyRateUsd: Float!
      apyMpc: Float!
      apyUsd: Float!
    }

    type DailyData {
      date: String!
      blockNumber: String!
      exchangeRate: Float!
      mpcPrice: Float
      smpcPrice: Float
      totalLiquid: String!
      totalStaked: String!
      marketCap: Float
      poolSize: Float
    }
    
    input StateFilter {
      exchangeRate_gt: Float
      exchangeRate_lt: Float
      blockNumber_gte: Int
      blockNumber_lte: Int
      timestamp_after: String
      timestamp_before: String
    }

    input TransactionFilter {
      action: String
      sender: String
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

    enum TransactionOrderBy {
      BLOCK_DESC
      BLOCK_ASC
      TIMESTAMP_DESC
      TIMESTAMP_ASC
    }
  `,
  
  resolvers: {
    Query: {
      contractStates: async (_: any, { first, skip, orderBy, where }: any) => {
        // Only use authentic database data
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

        query += ` ORDER BY ${orderMap[orderBy as keyof typeof orderMap]}`
        query += ` LIMIT ${Math.min(first, 1000)} OFFSET ${skip}`

        const result = await db.query(query, params)

        // Return authentic exchange rates directly from blockchain data
        return result.rows.map(r => ({
          blockNumber: r.block_number,
          timestamp: new Date(r.timestamp).toISOString(),
          exchangeRate: r.exchange_rate, // Use authentic rate from blockchain
          totalPoolStakeToken: r.total_pool_stake_token,
          totalPoolLiquid: r.total_pool_liquid,
          stakeTokenBalance: r.stake_token_balance
        }))
      },
      
      users: async (_: any, { first, skip, orderBy }: any) => {
        const orderMap = {
          BALANCE_DESC: 'CAST(balance AS NUMERIC) DESC',
          BALANCE_ASC: 'CAST(balance AS NUMERIC) ASC',
          FIRST_SEEN_DESC: 'first_seen DESC',
          FIRST_SEEN_ASC: 'first_seen ASC'
        }
        
        const result = await db.query(
          `SELECT * FROM users ORDER BY ${orderMap[orderBy as keyof typeof orderMap]} LIMIT $1 OFFSET $2`,
          [first, skip]
        )
        return result.rows.map(r => ({
          address: r.address || '',
          balance: r.balance || '0',
          firstSeen: r.first_seen ? new Date(r.first_seen).toISOString() : new Date().toISOString(),
          lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : new Date().toISOString()
        }))
      },

      transactions: async (_: any, { first, skip, orderBy, where }: any) => {
        let query = 'SELECT t.*, cs.exchange_rate FROM transactions t LEFT JOIN contract_states cs ON cs.block_number = t.block_number WHERE 1=1'
        const params = []

        if (where) {
          if (where.action) {
            params.push(where.action)
            query += ` AND t.action = $${params.length}`
          }
          if (where.sender) {
            params.push(where.sender)
            query += ` AND t.sender = $${params.length}`
          }
          if (where.blockNumber_gte) {
            params.push(where.blockNumber_gte)
            query += ` AND t.block_number >= $${params.length}`
          }
          if (where.blockNumber_lte) {
            params.push(where.blockNumber_lte)
            query += ` AND t.block_number <= $${params.length}`
          }
          if (where.timestamp_after) {
            params.push(where.timestamp_after)
            query += ` AND t.timestamp > $${params.length}`
          }
          if (where.timestamp_before) {
            params.push(where.timestamp_before)
            query += ` AND t.timestamp < $${params.length}`
          }
        }

        const orderMap = {
          BLOCK_DESC: 't.block_number DESC',
          BLOCK_ASC: 't.block_number ASC',
          TIMESTAMP_DESC: 't.timestamp DESC',
          TIMESTAMP_ASC: 't.timestamp ASC'
        }

        query += ` ORDER BY ${orderMap[orderBy as keyof typeof orderMap]}`
        query += ` LIMIT ${first} OFFSET ${skip}`

        const result = await db.query(query, params)
        return result.rows.map(r => {
          const metadata = r.metadata || {}
          const stakeTokenAmount = metadata.arguments?.stakeTokenAmount || null

          return {
            txHash: r.tx_hash,
            blockNumber: r.block_number.toString(),
            timestamp: r.timestamp.toISOString(),
            action: r.action,
            sender: r.sender,
            amount: r.amount,
            metadata: r.metadata ? JSON.stringify(r.metadata) : null,
            stakeTokenAmount: stakeTokenAmount,
            exchangeRate: r.exchange_rate ? parseFloat(r.exchange_rate) : null
          }
        })
      },

      rewards: async (_: any, { first, skip, orderBy }: any) => {
        const orderMap = {
          BLOCK_DESC: 't.block_number DESC',
          BLOCK_ASC: 't.block_number ASC',
          TIMESTAMP_DESC: 't.timestamp DESC',
          TIMESTAMP_ASC: 't.timestamp ASC'
        }

        const query = `
          SELECT t.*, cs.exchange_rate
          FROM transactions t
          LEFT JOIN contract_states cs ON cs.block_number = t.block_number
          WHERE t.action = 'accrueRewards'
          ORDER BY ${orderMap[orderBy as keyof typeof orderMap]}
          LIMIT $1 OFFSET $2
        `

        const result = await db.query(query, [first, skip])
        return result.rows.map(r => {
          const metadata = r.metadata || {}
          const stakeTokenAmount = metadata.arguments?.stakeTokenAmount || null

          return {
            txHash: r.tx_hash,
            blockNumber: r.block_number.toString(),
            timestamp: r.timestamp.toISOString(),
            action: r.action,
            sender: r.sender,
            amount: r.amount,
            metadata: r.metadata ? JSON.stringify(r.metadata) : null,
            stakeTokenAmount: stakeTokenAmount,
            exchangeRate: r.exchange_rate ? parseFloat(r.exchange_rate) : null
          }
        })
      },

      currentState: async () => {
        const [state, price] = await Promise.all([
          db.query('SELECT * FROM current_state WHERE id = 1'),
          db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
        ])
        
        const s = state.rows[0]
        const p = parseFloat(price.rows[0]?.price_usd) || 0
        const staked = BigInt(s?.total_pool_stake_token || '0')
        const liquid = BigInt(s?.total_pool_liquid || '0')

        // Get token decimals
        const decimals = await getTokenDecimals()

        // Convert raw amounts to human-readable (uses token_decimals from DB)
        const stakedMpc = await fromRawAmount(staked)
        const liquidMpc = await fromRawAmount(liquid)
        const tvlUsd = (stakedMpc * p).toFixed(2)

        return {
          blockNumber: s?.block_number || '0',
          exchangeRate: s?.exchange_rate || '1.0',
          totalStaked: stakedMpc.toFixed(4),
          totalLiquid: liquidMpc.toFixed(4),
          totalStakedRaw: staked.toString(),
          totalLiquidRaw: liquid.toString(),
          tokenDecimals: decimals,
          tvlUsd
        }
      },
      
      exchangeRate: async () => {
        const [state, price] = await Promise.all([
          db.query('SELECT exchange_rate FROM current_state WHERE id = 1'),
          db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
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
        const result = await db.query(
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
      },

      dailyRewards: async (_: any, { days, granularity }: any) => {
        // Limit to 90 days max to prevent timeout (N+1 query problem)
        const requestedDays = Math.min(days || 30, 90)

        // Check if we have enough data
        const countResult = await db.query('SELECT COUNT(*) as count FROM contract_states')
        const stateCount = parseInt(countResult.rows[0]?.count || '0')

        // Need at least 2 states to calculate rewards
        if (stateCount < 2) {
          console.log(`Not enough data for dailyRewards (${stateCount} states)`)
          return []
        }

        // Determine granularity: manual override or auto-select
        let selectedGranularity = granularity
        if (!selectedGranularity) {
          // Auto-select based on time range
          if (requestedDays <= 30) selectedGranularity = 'daily'
          else if (requestedDays <= 180) selectedGranularity = 'weekly'
          else selectedGranularity = 'monthly'
        }

        // Build query based on granularity
        let query: string

        switch (selectedGranularity) {
          case 'daily':
            query = `
              SELECT DISTINCT ON (DATE(timestamp))
                DATE(timestamp) as date,
                block_number,
                exchange_rate,
                total_pool_liquid,
                timestamp
              FROM contract_states
              WHERE timestamp > NOW() - INTERVAL '1 day' * $1
              ORDER BY DATE(timestamp) ASC, timestamp DESC
            `
            break

          case 'weekly':
            query = `
              SELECT
                DATE_TRUNC('week', timestamp) as date,
                (array_agg(block_number ORDER BY timestamp DESC))[1] as block_number,
                AVG(exchange_rate) as exchange_rate,
                AVG(total_pool_liquid::numeric) as total_pool_liquid,
                MAX(timestamp) as timestamp
              FROM contract_states
              WHERE timestamp > NOW() - INTERVAL '1 day' * $1
              GROUP BY DATE_TRUNC('week', timestamp)
              ORDER BY date ASC
            `
            break

          case 'monthly':
            query = `
              SELECT
                DATE_TRUNC('month', timestamp) as date,
                (array_agg(block_number ORDER BY timestamp DESC))[1] as block_number,
                AVG(exchange_rate) as exchange_rate,
                AVG(total_pool_liquid::numeric) as total_pool_liquid,
                MAX(timestamp) as timestamp
              FROM contract_states
              WHERE timestamp > NOW() - INTERVAL '1 day' * $1
              GROUP BY DATE_TRUNC('month', timestamp)
              ORDER BY date ASC
            `
            break

          default:
            throw new Error(`Invalid granularity: ${selectedGranularity}. Use 'daily', 'weekly', or 'monthly'.`)
        }

        const states = await db.query(query, [requestedDays + 1])

        if (states.rows.length < 2) {
          return []
        }

        // Get MPC price for each day
        const results = []

        for (let i = 1; i < states.rows.length; i++) {
          const current = states.rows[i]
          const previous = states.rows[i - 1]

          const currentRate = parseFloat(current.exchange_rate)
          const previousRate = parseFloat(previous.exchange_rate)
          const rateChange = currentRate - previousRate

          // Get MPC prices for both days
          const [currentPriceResult, previousPriceResult] = await Promise.all([
            db.query(`
              SELECT price_usd
              FROM price_history
              WHERE timestamp <= $1
              ORDER BY timestamp DESC
              LIMIT 1
            `, [current.timestamp]),
            db.query(`
              SELECT price_usd
              FROM price_history
              WHERE timestamp <= $1
              ORDER BY timestamp DESC
              LIMIT 1
            `, [previous.timestamp])
          ])

          const currentMpcPrice = parseFloat(currentPriceResult.rows[0]?.price_usd) || 0
          const previousMpcPrice = parseFloat(previousPriceResult.rows[0]?.price_usd) || 0

          // Calculate reward using: reward = rate_change × total_pool_liquid
          const liquidBigInt = BigInt(current.total_pool_liquid)
          const liquidMpc = await fromRawAmount(liquidBigInt)
          const rewardMpc = rateChange * liquidMpc

          // Calculate MPC-denominated returns (protocol performance)
          const dailyRateMpc = previousRate !== 0 ? rateChange / previousRate : 0
          const apyMpc = previousRate !== 0
            ? (Math.pow(1 + dailyRateMpc, 365) - 1) * 100
            : 0

          // Calculate USD-denominated returns (actual portfolio return)
          const currentSmpcPrice = currentRate * currentMpcPrice
          const previousSmpcPrice = previousRate * previousMpcPrice
          const dailyRateUsd = previousSmpcPrice !== 0
            ? (currentSmpcPrice - previousSmpcPrice) / previousSmpcPrice
            : 0
          const apyUsd = previousSmpcPrice !== 0
            ? (Math.pow(1 + dailyRateUsd, 365) - 1) * 100
            : 0

          results.push({
            date: new Date(current.date).toISOString().split('T')[0], // Format as YYYY-MM-DD
            blockNumber: current.block_number.toString(),
            rewardAmountMpc: rewardMpc.toFixed(6),
            rewardAmountUsd: rewardMpc * currentMpcPrice,
            exchangeRateChange: rateChange,
            dailyRateMpc,
            dailyRateUsd,
            apyMpc,
            apyUsd
          })
        }

        return results
      },

      dailyHistory: async (_: any, { days }: any) => {
        // Get the timestamp range of our indexed contract states
        const stateRange = await db.query(`
          SELECT
            MIN(timestamp) as min_timestamp,
            MAX(timestamp) as max_timestamp
          FROM contract_states
        `)

        const minTimestamp = stateRange.rows[0]?.min_timestamp
        const maxTimestamp = stateRange.rows[0]?.max_timestamp

        if (!minTimestamp || !maxTimestamp) {
          return []
        }

        // Get price history for the time range we have contract data
        // Limit to the requested days, but count backwards from our latest data (not from NOW)
        const cutoffTimestamp = new Date(maxTimestamp.getTime() - (days * 24 * 60 * 60 * 1000))
        const prices = await db.query(`
          SELECT timestamp, price_usd
          FROM price_history
          WHERE timestamp >= $1
            AND timestamp <= $2
            AND timestamp >= $3
          ORDER BY timestamp ASC
        `, [minTimestamp, maxTimestamp, cutoffTimestamp])

        if (prices.rows.length === 0) {
          return []
        }

        // Match each price point with the contract state at that time
        const results = []

        for (const priceRow of prices.rows) {
          // Find the contract state at or before this timestamp
          const state = await db.query(`
            SELECT block_number, exchange_rate, total_pool_liquid, total_pool_stake_token
            FROM contract_states
            WHERE timestamp <= $1
            ORDER BY timestamp DESC
            LIMIT 1
          `, [priceRow.timestamp])

          if (state.rows.length > 0) {
            const s = state.rows[0]
            const mpcPrice = parseFloat(priceRow.price_usd)
            const totalLiquid = s.total_pool_liquid
            const totalStaked = s.total_pool_stake_token
            // Convert raw amounts to human-readable (uses token_decimals from DB)
            const liquidBigInt = BigInt(totalLiquid)
            const poolSizeTokens = await fromRawAmount(liquidBigInt)

            // Exchange rate should be from DB (1.0 at deployment, increases with rewards)
            const exchangeRate = parseFloat(s.exchange_rate) || 1.0
            const smpcPrice = mpcPrice * exchangeRate
            const marketCap = poolSizeTokens * smpcPrice
            const poolSize = poolSizeTokens

            results.push({
              date: new Date(priceRow.timestamp).toISOString(),
              blockNumber: s.block_number.toString(),
              exchangeRate,
              mpcPrice,
              smpcPrice,
              totalLiquid,
              totalStaked,
              marketCap,
              poolSize
            })
          }
        }

        return results
      }
    }
  }
})
