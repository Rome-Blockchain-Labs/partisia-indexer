import React, { FC, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  registerables,
  ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format, parseISO } from 'date-fns'

ChartJS.register(
  ...registerables,
  zoomPlugin,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type TimePeriod = '7d' | '30d' | '90d' | '1y' | '3y' | 'all'
type Granularity = 'daily' | 'weekly' | 'monthly'

const DAYS_MAP: Record<TimePeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  '3y': 1095,
  'all': 1095,
}

// Auto-select optimal granularity
// Only aggregate when >500 data points to keep detail
const GRANULARITY_MAP: Record<TimePeriod, Granularity> = {
  '7d': 'daily',    // 7 points
  '30d': 'daily',   // 30 points
  '90d': 'daily',   // 90 points
  '1y': 'daily',    // 365 points
  '3y': 'weekly',   // ~157 points
  'all': 'weekly',  // ~157 points
}

interface PriceData {
  timestamp: string
  mpcPrice: number
  exchangeRate: number
  smpcPrice: number
  marketCap: number
  poolSize: number
  totalStaked: string
}

const PriceComparisonChart: FC = () => {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [showMPC, setShowMPC] = useState(true)
  const [showSMPC, setShowSMPC] = useState(true)
  const [showRate, setShowRate] = useState(true)
  const [showMarketCap, setShowMarketCap] = useState(true)
  const [showPoolSize, setShowPoolSize] = useState(false)
  const [showTVL, setShowTVL] = useState(false)
  const [data, setData] = useState<PriceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const days = DAYS_MAP[timePeriod]
      const granularity = GRANULARITY_MAP[timePeriod]

      // Use the new dailyHistory endpoint with granularity
      const query = `{
        dailyHistory(days: ${days}, granularity: "${granularity}") {
          date
          blockNumber
          exchangeRate
          mpcPrice
          smpcPrice
          marketCap
          poolSize
          totalStaked
        }
      }`

      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('GraphQL response:', result)

      if (result.errors) {
        console.error('GraphQL errors:', result.errors)
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
      }

      if (!result || !result.data) {
        console.error('Full response object:', JSON.stringify(result, null, 2))
        throw new Error(`GraphQL response missing data field. Response: ${JSON.stringify(result)}`)
      }

      const dailyData = result.data.dailyHistory || []
      console.log('Daily history data:', { count: dailyData.length, first: dailyData[0], last: dailyData[dailyData.length - 1] })

      // Convert dailyHistory data to PriceData format
      const combined: PriceData[] = dailyData.map((day: any) => ({
        timestamp: day.date,
        mpcPrice: day.mpcPrice || 0,
        exchangeRate: day.exchangeRate || 1.0,
        smpcPrice: day.smpcPrice || 0,
        marketCap: day.marketCap || 0,
        poolSize: day.poolSize || 0,
        totalStaked: day.totalStaked || '0'
      }))

      setData(combined)
    } catch (err: any) {
      console.error('Error fetching price data:', err)
      setError(err.message || 'Failed to fetch price data')
    } finally {
      setLoading(false)
    }
  }, [timePeriod])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = useMemo(() => {
    const labels = data.map(d => format(parseISO(d.timestamp), 'MMM dd'))

    const datasets = []

    if (showMPC) {
      datasets.push({
        label: 'MPC Price',
        data: data.map(d => d.mpcPrice),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y-price',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    if (showSMPC) {
      datasets.push({
        label: 'sMPC Price',
        data: data.map(d => d.smpcPrice),
        borderColor: 'rgb(168, 85, 247)', // Purple
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        yAxisID: 'y-price',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    if (showRate) {
      datasets.push({
        label: 'Exchange Rate',
        data: data.map(d => d.exchangeRate),
        borderColor: 'rgb(34, 197, 94)', // Green
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        yAxisID: 'y-rate',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    if (showMarketCap) {
      datasets.push({
        label: 'sMPC Market Cap',
        data: data.map(d => d.marketCap),
        borderColor: 'rgb(249, 115, 22)', // Orange
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        yAxisID: 'y-marketcap',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    if (showPoolSize) {
      datasets.push({
        label: 'Pool Size (M tokens)',
        data: data.map(d => d.poolSize),
        borderColor: 'rgb(236, 72, 153)', // Pink
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        yAxisID: 'y-poolsize',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    if (showTVL) {
      datasets.push({
        label: 'TVL (Total Staked)',
        data: data.map(d => parseFloat(d.totalStaked) / 1e6),
        borderColor: 'rgb(14, 165, 233)', // Sky blue
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        yAxisID: 'y-tvl',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    return { labels, datasets }
  }, [data, showMPC, showSMPC, showRate, showMarketCap, showPoolSize, showTVL])

  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 },
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(229, 231, 235, 0.2)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex
            const point = data[index]
            return format(parseISO(point.timestamp), 'PPP')
          },
          label: (context) => {
            const index = context.dataIndex
            const point = data[index]
            const label = context.dataset.label || ''

            if (label.includes('MPC Price')) {
              return `MPC Price: $${point.mpcPrice.toFixed(4)}`
            } else if (label.includes('sMPC Price')) {
              return `sMPC Price: $${point.smpcPrice.toFixed(4)}`
            } else if (label.includes('Exchange')) {
              return `Exchange Rate: ${point.exchangeRate.toFixed(6)}`
            } else if (label.includes('Market Cap')) {
              return `sMPC Market Cap: $${(point.marketCap / 1e6).toFixed(2)}M`
            }
            return ''
          },
          afterBody: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const point = data[index]
            const premium = ((point.exchangeRate - 1) * 100).toFixed(2)
            return [`Premium: ${premium}%`]
          },
        },
      },
      zoom: {
        limits: {
          y: { min: 0, max: 'original' },
          x: { min: 'original', max: 'original' },
        },
        pan: {
          enabled: true,
          mode: 'x',
          modifierKey: 'shift',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 0,
          font: { size: 11 },
        },
      },
      'y-price': {
        type: 'linear',
        display: showMPC || showSMPC,
        position: 'left',
        title: {
          display: true,
          text: 'Price (USD)',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          drawOnChartArea: true,
          color: 'rgba(229, 231, 235, 0.1)',
        },
        ticks: {
          font: { size: 11 },
          callback: (value) => `$${Number(value).toFixed(4)}`,
        },
      },
      'y-rate': {
        type: 'linear',
        display: showRate && !showMarketCap,
        position: 'right',
        title: {
          display: true,
          text: 'Exchange Rate',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: { size: 11 },
          callback: (value) => Number(value).toFixed(6),
        },
      },
      'y-marketcap': {
        type: 'linear',
        display: showMarketCap,
        position: 'right',
        title: {
          display: true,
          text: 'Market Cap (USD)',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: { size: 11 },
          callback: (value) => `$${(Number(value) / 1e6).toFixed(1)}M`,
        },
      },
    },
  }), [data, showMPC, showSMPC, showRate, showMarketCap])

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading price comparison...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8">
          <p className="text-red-600">Error: {error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8">
          <p className="text-gray-600">No price data available</p>
        </div>
      </div>
    )
  }

  const latestData = data[data.length - 1]
  const earliestData = data[0]
  const mpcChange = latestData.mpcPrice - earliestData.mpcPrice
  const mpcChangePercent = (mpcChange / earliestData.mpcPrice) * 100
  const smpcChange = latestData.smpcPrice - earliestData.smpcPrice
  const smpcChangePercent = (smpcChange / earliestData.smpcPrice) * 100
  const marketCapChange = latestData.marketCap - earliestData.marketCap
  const marketCapChangePercent = (marketCapChange / earliestData.marketCap) * 100

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Price Comparison: MPC vs sMPC</h2>
          <p className="text-sm text-gray-600">
            Compare MPC token price with staked MPC (sMPC) value
          </p>
        </div>

        {/* Time Period Selector */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-2">
            {(['7d', '30d', '90d', '1y', '3y', 'all'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Granularity indicator */}
          <div className="text-xs text-gray-500 ml-2">
            ({GRANULARITY_MAP[timePeriod]} data)
          </div>
        </div>
      </div>

      {/* Toggle Controls */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showMPC}
            onChange={(e) => setShowMPC(e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700">MPC Price</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSMPC}
            onChange={(e) => setShowSMPC(e.target.checked)}
            className="w-4 h-4 text-purple-600"
          />
          <span className="text-sm text-gray-700">sMPC Price</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRate}
            onChange={(e) => setShowRate(e.target.checked)}
            className="w-4 h-4 text-green-600"
          />
          <span className="text-sm text-gray-700">Exchange Rate</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showMarketCap}
            onChange={(e) => setShowMarketCap(e.target.checked)}
            className="w-4 h-4 text-orange-600"
          />
          <span className="text-sm text-gray-700">Market Cap</span>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Reset Zoom
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-96">
        <Line ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t">
        <div>
          <div className="text-sm text-gray-500">Current MPC</div>
          <div className="text-lg font-semibold">
            ${latestData.mpcPrice.toFixed(4)}
          </div>
          <div className={`text-xs ${mpcChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {mpcChangePercent > 0 ? '+' : ''}{mpcChangePercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Current sMPC</div>
          <div className="text-lg font-semibold">
            ${latestData.smpcPrice.toFixed(4)}
          </div>
          <div className={`text-xs ${smpcChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {smpcChangePercent > 0 ? '+' : ''}{smpcChangePercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Market Cap</div>
          <div className="text-lg font-semibold">
            ${(latestData.marketCap / 1e6).toFixed(2)}M
          </div>
          <div className={`text-xs ${marketCapChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {marketCapChangePercent > 0 ? '+' : ''}{marketCapChangePercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Exchange Rate</div>
          <div className="text-lg font-semibold">
            {latestData.exchangeRate.toFixed(6)}
          </div>
          <div className="text-xs text-gray-600">
            Premium: {((latestData.exchangeRate - 1) * 100).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Data Points</div>
          <div className="text-lg font-semibold">
            {data.length}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-xs text-gray-500">
        • Scroll to zoom • Shift+drag to pan • Click legend to toggle series
      </div>
    </div>
  )
}

export default PriceComparisonChart
