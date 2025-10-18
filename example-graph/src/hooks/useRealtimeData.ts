import { useState, useEffect, useCallback, useRef } from 'react'

export interface RealtimeProgressData {
  stateIndexer: {
    currentBlock: number
    targetBlock: number
    blocksRemaining: number
    progressPercent: number
    syncComplete: boolean
    blocksPerSecond: number
  }
  transactionIndexer: {
    currentBlock: number
    targetBlock: number
    blocksRemaining: number
    progressPercent: number
    transactionsFound: number
    contractTxFound: number
    adminTxFound: number
    blocksPerSecond: number
  }
  overall: {
    progressPercent: number
    syncComplete: boolean
    estimatedTimeRemaining: string
  }
}

interface UseRealtimeDataOptions {
  endpoint?: string
  reconnectInterval?: number
  fallbackPollingInterval?: number
}

export function useRealtimeData(options: UseRealtimeDataOptions = {}) {
  const {
    endpoint = '/api/indexing-progress',
    reconnectInterval = 3000,
    fallbackPollingInterval = 5000
  } = options

  const [data, setData] = useState<RealtimeProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnectRef = useRef(true)

  // Fallback HTTP polling function
  const fetchData = useCallback(async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002'
      const response = await fetch(`${apiUrl}${endpoint}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const progressData = await response.json()
      setData(progressData)
      setError(null)
      return progressData
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      throw err
    }
  }, [endpoint])

  // WebSocket connection function
  const connectWebSocket = useCallback(() => {
    if (!shouldReconnectRef.current) return

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002'
      const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://')
      const ws = new WebSocket(`${wsUrl}/ws/progress`)

      wsRef.current = ws
      setConnectionStatus('connecting')

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnectionStatus('connected')
        setError(null)

        // Clear fallback polling when WebSocket connects
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current)
          fallbackIntervalRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const progressData = JSON.parse(event.data)
          setData(progressData)
          setLoading(false)
          setError(null)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus('error')
        setError('WebSocket connection error')
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setConnectionStatus('disconnected')
        wsRef.current = null

        // Start fallback polling
        if (!fallbackIntervalRef.current) {
          console.log('Starting fallback HTTP polling')
          fallbackIntervalRef.current = setInterval(fetchData, fallbackPollingInterval)
        }

        // Attempt to reconnect
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, reconnectInterval)
        }
      }

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setConnectionStatus('error')
      setError('Failed to create WebSocket connection')

      // Start fallback polling immediately
      if (!fallbackIntervalRef.current) {
        fallbackIntervalRef.current = setInterval(fetchData, fallbackPollingInterval)
      }
    }
  }, [reconnectInterval, fallbackPollingInterval, fetchData])

  // Initialize connection
  useEffect(() => {
    shouldReconnectRef.current = true

    // Try WebSocket first, fallback to HTTP polling
    connectWebSocket()

    // Initial HTTP fetch to get data immediately
    fetchData().then(() => {
      setLoading(false)
    }).catch(() => {
      // If initial fetch fails, still stop loading state
      setLoading(false)
    })

    return () => {
      shouldReconnectRef.current = false

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current)
        fallbackIntervalRef.current = null
      }
    }
  }, [connectWebSocket, fetchData])

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    connectWebSocket()
  }, [connectWebSocket])

  return {
    data,
    loading,
    error,
    connectionStatus,
    reconnect
  }
}