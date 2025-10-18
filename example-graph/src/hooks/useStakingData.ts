import { useState, useEffect, useCallback } from 'react'
import { parseISO, subHours, subDays, subMonths } from 'date-fns'
import { API_BASE_URL, WS_URL } from '../config'

// Define types for better type safety
interface ExchangeRateData {
  timestamp: string
  blockTime: string
  rate: string
  totalStake: string
  totalLiquid: string
}

interface PriceData {
  timestamp: string
  price_usd: number
  market_cap_usd: number
  volume_24h_usd: number
}

interface APYData {
  daily: number | null
  weekly: number | null
  monthly: number | null
}

interface CombinedDataPoint {
  timestamp: Date
  blockNumber: number
  exchangeRate: number
  price: number
  totalStaked: bigint
  totalLiquid: bigint
  tvlUSD: number
  marketCap: number
  volume24h: number
  apy?: number
}

interface UseStakingDataReturn {
  data: CombinedDataPoint[]
  loading: boolean
  error: Error | null
  apy: APYData
  currentStats: {
    price: number
    exchangeRate: number
    tvl: number
    totalStaked: string
    marketCap: number
  } | null
  refetch: () => void
}

// API_BASE_URL now imported from config

export function useStakingData(
  timePeriod: '24h' | '7d' | '30d' | '90d' | '1y' | 'all' = '30d'
): UseStakingDataReturn {
  const [data, setData] = useState<CombinedDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [apy, setApy] = useState<APYData>({ daily: null, weekly: null, monthly: null })
  const [currentStats, setCurrentStats] = useState<UseStakingDataReturn['currentStats']>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Calculate hours based on time period
      // Note: Use larger time windows since our data is from June 2025
      const hoursMap = {
        '24h': 8760, // Show historical data since there's no recent data
        '7d': 8760,  // Show historical data since there's no recent data
        '30d': 8760, // Show historical data since there's no recent data
        '90d': 8760,
        '1y': 8760,
        'all': 100000, // Large number for "all" data
      }
      const hours = hoursMap[timePeriod]

      // Fetch exchange rate data using GraphQL
      const graphQLQuery = {
        query: `
          query GetContractStates($first: Int!) {
            contractStates(first: $first, orderBy: BLOCK_DESC) {
              blockNumber
              timestamp
              exchangeRate
              totalPoolStakeToken
              totalPoolLiquid
            }
          }
        `,
        variables: {
          first: Math.min(hours * 10, 1000) // Estimate data points based on hours
        }
      }

      const exchangeRes = await fetch(`${API_BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphQLQuery)
      })

      if (!exchangeRes.ok) {
        throw new Error('Failed to fetch exchange rate data')
      }

      const graphQLResponse = await exchangeRes.json()

      if (graphQLResponse.errors) {
        throw new Error(`GraphQL errors: ${graphQLResponse.errors.map((e: any) => e.message).join(', ')}`)
      }

      const exchangeData = graphQLResponse.data.contractStates.map((state: any) => ({
        timestamp: state.timestamp,
        blockTime: state.blockNumber,
        rate: state.exchangeRate,
        totalStake: state.totalPoolStakeToken,
        totalLiquid: state.totalPoolLiquid
      })) as ExchangeRateData[]

      // Fetch price data from MEXC historical endpoint
      const priceRes = await fetch(`${API_BASE_URL}/api/mpc/prices?hours=${hours}`)
      if (!priceRes.ok) {
        throw new Error('Failed to fetch price data')
      }
      const priceData = await priceRes.json()

      // Create a map of prices by timestamp for efficient lookup
      const priceMap = new Map<string, any>()
      priceData.forEach((p: any) => {
        const normalizedTimestamp = new Date(p.timestamp).toISOString()
        priceMap.set(normalizedTimestamp, {
          timestamp: p.timestamp,
          price_usd: p.price_usd,
          market_cap_usd: p.market_cap_usd,
          volume_24h_usd: p.volume_24h_usd || 0
        })
      })

      // Combine exchange rate and price data
      const combinedData: CombinedDataPoint[] = exchangeData.map((ex, index) => {
        const timestamp = new Date(ex.timestamp)
        const normalizedTimestamp = timestamp.toISOString()

        // Find closest price data by day (prices are daily)
        const dayStart = new Date(timestamp)
        dayStart.setUTCHours(0, 0, 0, 0)
        const dayKey = dayStart.toISOString()

        // Try to find the closest price data, or use the latest available price as fallback
        let priceInfo = priceMap.get(dayKey)
        if (!priceInfo && priceMap.size > 0) {
          // Use the most recent price available as fallback
          const latestPrice = Array.from(priceMap.values())[priceMap.size - 1]
          priceInfo = latestPrice
        }
        if (!priceInfo) {
          // Last resort fallback price
          priceInfo = { price_usd: 0.01562, market_cap_usd: null, volume_24h_usd: 0 }
        }

        // Exchange rates are now corrected at the GraphQL resolver level
        const exchangeRate = parseFloat(ex.rate) // Already corrected by server

        // Use real staking data from GraphQL
        const totalStakedValue = BigInt(ex.totalStake)
        const totalLiquidValue = BigInt(ex.totalLiquid)

        const price = priceInfo.price_usd
        const totalStaked = totalStakedValue
        const totalLiquid = totalLiquidValue

        // Calculate TVL in USD (assuming 6 decimal places for the token)
        const tvlUSD = (Number(totalStaked) / 1e6) * price

        return {
          timestamp,
          blockNumber: parseInt(ex.blockTime),
          exchangeRate,
          price,
          totalStaked,
          totalLiquid,
          tvlUSD,
          marketCap: priceInfo.market_cap_usd || 0,
          volume24h: priceInfo.volume_24h_usd,
        }
      })

      // Sort by timestamp
      combinedData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      // Calculate rolling APY for each point
      combinedData.forEach((point, index) => {
        if (index >= 24) {
          // Need at least 24 hours of data
          const dayAgoIndex = Math.max(0, index - 24)
          const dayAgoPoint = combinedData[dayAgoIndex]

          if (dayAgoPoint && point.exchangeRate && dayAgoPoint.exchangeRate) {
            const dailyReturn =
              (point.exchangeRate - dayAgoPoint.exchangeRate) / dayAgoPoint.exchangeRate
            point.apy = dailyReturn * 365 * 100 // Annualized percentage
          }
        }
      })

      setData(combinedData)

      // Calculate real APY values based on exchange rate changes
      const calculateApy = (days: number) => {
        if (combinedData.length < days * 24) return null

        const latest = combinedData[combinedData.length - 1]
        const earlier = combinedData[Math.max(0, combinedData.length - days * 24)]

        if (!latest || !earlier || earlier.exchangeRate === 0) return null

        const totalReturn = (latest.exchangeRate - earlier.exchangeRate) / earlier.exchangeRate
        const annualizedReturn = (totalReturn / days) * 365 * 100

        return Math.max(0, annualizedReturn) // Ensure non-negative APY
      }

      setApy({
        daily: calculateApy(1),
        weekly: calculateApy(7),
        monthly: calculateApy(30),
      })

      // Set current stats from the latest data point and stats endpoint
      if (combinedData.length > 0) {
        const latest = combinedData[combinedData.length - 1]
        setCurrentStats({
          price: latest.price,
          exchangeRate: latest.exchangeRate,
          tvl: latest.tvlUSD,
          totalStaked: latest.totalStaked.toString(),
          marketCap: latest.marketCap,
        })
      }
    } catch (err) {
      console.error('Error fetching staking data:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [timePeriod])

  useEffect(() => {
    fetchData()

    // Set up auto-refresh every minute
    const interval = setInterval(fetchData, 60000)

    return () => clearInterval(interval)
  }, [fetchData])

  return {
    data,
    loading,
    error,
    apy,
    currentStats,
    refetch: fetchData,
  }
}

// Hook for real-time WebSocket updates
export function useRealtimeUpdates(
  onUpdate: (data: CombinedDataPoint) => void
): void {
  useEffect(() => {
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'update') {
          const { exchangeRate, price, block, timestamp, totalStaked, totalLiquid } = message.data

          onUpdate({
            timestamp: new Date(timestamp),
            blockNumber: block,
            exchangeRate: parseFloat(exchangeRate),
            price: price || 0,
            totalStaked: BigInt(totalStaked),
            totalLiquid: BigInt(totalLiquid),
            tvlUSD: (Number(totalStaked) / 1e6) * (price || 0),
            marketCap: 0, // Would need to fetch separately
            volume24h: 0, // Would need to fetch separately
          })
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [onUpdate])
}

// Hook for fetching historical exchange rates with caching
export function useHistoricalExchangeRates() {
  const [data, setData] = useState<ExchangeRateData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistorical = async () => {
      try {
        // Check local storage for cached data
        const cacheKey = 'historical_exchange_rates'
        const cached = localStorage.getItem(cacheKey)

        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached)
          const cacheAge = Date.now() - timestamp

          // Use cache if less than 5 minutes old
          if (cacheAge < 5 * 60 * 1000) {
            setData(cachedData)
            setLoading(false)
            return
          }
        }

        // Fetch fresh data
        const response = await fetch(`${API_BASE_URL}/api/exchangeRates?hours=8760`)
        const freshData = await response.json()

        // Cache the data
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ data: freshData, timestamp: Date.now() })
        )

        setData(freshData)
      } catch (err) {
        console.error('Error fetching historical data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistorical()
  }, [])

  return { data, loading }
}

// Hook for calculating custom metrics
export function useStakingMetrics(data: CombinedDataPoint[]) {
  return useCallback(() => {
    if (data.length < 2) return null

    const latest = data[data.length - 1]
    const earliest = data[0]

    // Calculate various metrics
    const priceChange = latest.price - earliest.price
    const priceChangePercent = (priceChange / earliest.price) * 100

    const exchangeRateChange = latest.exchangeRate - earliest.exchangeRate
    const exchangeRateChangePercent = (exchangeRateChange / earliest.exchangeRate) * 100

    const tvlChange = latest.tvlUSD - earliest.tvlUSD
    const tvlChangePercent = earliest.tvlUSD ? (tvlChange / earliest.tvlUSD) * 100 : 0

    // Find highs and lows
    const priceHigh = Math.max(...data.map((d) => d.price))
    const priceLow = Math.min(...data.filter((d) => d.price > 0).map((d) => d.price))

    const exchangeRateHigh = Math.max(...data.map((d) => d.exchangeRate))
    const exchangeRateLow = Math.min(...data.filter((d) => d.exchangeRate > 0).map((d) => d.exchangeRate))

    // Calculate average APY
    const apyValues = data.filter((d) => d.apy !== undefined).map((d) => d.apy!)
    const averageApy = apyValues.length > 0
      ? apyValues.reduce((a, b) => a + b, 0) / apyValues.length
      : 0

    return {
      priceChange,
      priceChangePercent,
      exchangeRateChange,
      exchangeRateChangePercent,
      tvlChange,
      tvlChangePercent,
      priceHigh,
      priceLow,
      exchangeRateHigh,
      exchangeRateLow,
      averageApy,
    }
  }, [data])
}