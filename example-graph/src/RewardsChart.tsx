import React, { FC, useState, useRef, useEffect, useCallback } from 'react'
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
  '1y': 90,  // Limited to 90 days max by backend
  '3y': 90,  // Limited to 90 days max by backend
  'all': 90, // Limited to 90 days max by backend
}

// Auto-select optimal granularity based on time period
const GRANULARITY_MAP: Record<TimePeriod, Granularity> = {
  '7d': 'daily',    // 7 points
  '30d': 'daily',   // 30 points
  '90d': 'daily',   // 90 points
  '1y': 'daily',    // 90 points (limited by backend)
  '3y': 'daily',    // 90 points (limited by backend)
  'all': 'daily',   // 90 points (limited by backend)
}

interface RewardData {
  date: string
  blockNumber: string
  rewardAmountMpc: string
  rewardAmountUsd: number
  exchangeRateChange: number
  dailyRateMpc: number
  dailyRateUsd: number
  apyMpc: number
  apyUsd: number
}

const RewardsChart: FC = () => {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [showApyMpc, setShowApyMpc] = useState(true)
  const [showApyUsd, setShowApyUsd] = useState(true)
  const [showDailyRewards, setShowDailyRewards] = useState(false)
  const [data, setData] = useState<RewardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const days = DAYS_MAP[timePeriod]
      const granularity = GRANULARITY_MAP[timePeriod]

      const query = `{
        dailyRewards(days: ${days}, granularity: "${granularity}") {
          date
          blockNumber
          rewardAmountMpc
          rewardAmountUsd
          exchangeRateChange
          dailyRateMpc
          dailyRateUsd
          apyMpc
          apyUsd
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
      console.log('Rewards GraphQL response:', result)

      if (result.errors) {
        console.error('GraphQL errors:', result.errors)
        throw new Error(result.errors[0]?.message || 'GraphQL query failed')
      }

      if (!result.data?.dailyRewards) {
        throw new Error('No dailyRewards data in response')
      }

      setData(result.data.dailyRewards)
    } catch (err: any) {
      console.error('Fetch error:', err)
      setError(err.message || 'Failed to fetch reward data')
    } finally {
      setLoading(false)
    }
  }, [timePeriod])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchData])

  const chartData = {
    labels: data.map(d => format(parseISO(d.date), 'MMM dd')),
    datasets: [
      ...(showApyMpc ? [{
        label: 'APY (MPC)',
        data: data.map(d => d.apyMpc),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: false,
        yAxisID: 'y-apy',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
      }] : []),
      ...(showApyUsd ? [{
        label: 'APY (USD)',
        data: data.map(d => d.apyUsd),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: false,
        yAxisID: 'y-apy',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
      }] : []),
      ...(showDailyRewards ? [{
        label: 'Exchange Rate Change',
        data: data.map(d => d.exchangeRateChange * 100), // Convert to percentage
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: true,
        yAxisID: 'y-change',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
      }] : []),
    ]
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
        }
      },
      title: {
        display: true,
        text: 'Daily Rewards & APY',
        font: { size: 16, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || ''
            const value = context.parsed.y

            if (label.includes('APY')) {
              return `${label}: ${value.toFixed(4)}%`
            } else if (label.includes('Change')) {
              return `${label}: ${value.toFixed(6)}%`
            }
            return `${label}: ${value}`
          }
        }
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          maxTicksLimit: 8,
          font: { size: 11 }
        }
      },
      'y-apy': {
        type: 'linear',
        display: showApyMpc || showApyUsd,
        position: 'left',
        title: {
          display: true,
          text: 'APY (%)',
          font: { size: 12, weight: 'bold' }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawOnChartArea: true
        },
        ticks: {
          font: { size: 11 },
          callback: (value) => Number(value).toFixed(4) + '%'
        }
      },
      'y-change': {
        type: 'linear',
        display: showDailyRewards,
        position: 'right',
        title: {
          display: true,
          text: 'Rate Change (%)',
          font: { size: 12, weight: 'bold' }
        },
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 11 },
          callback: (value) => Number(value).toFixed(6) + '%'
        }
      }
    }
  }

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  const latestData = data[data.length - 1]
  const avgApyMpc = data.length > 0
    ? data.reduce((sum, d) => sum + d.apyMpc, 0) / data.length
    : 0
  const avgApyUsd = data.length > 0
    ? data.reduce((sum, d) => sum + d.apyUsd, 0) / data.length
    : 0

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with stats */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Staking Rewards</h2>
            <p className="text-sm text-gray-500 mt-1">
              Real-time protocol performance and portfolio returns
            </p>
          </div>
          <button
            onClick={resetZoom}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Reset Zoom
          </button>
        </div>

        {/* Current Stats */}
        {latestData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-600 font-medium">Current APY (MPC)</div>
              <div className="text-lg font-bold text-blue-900">
                {latestData.apyMpc.toFixed(2)}%
              </div>
              <div className="text-xs text-blue-600">
                Avg: {avgApyMpc.toFixed(2)}%
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-green-600 font-medium">Current APY (USD)</div>
              <div className="text-lg font-bold text-green-900">
                {latestData.apyUsd.toFixed(2)}%
              </div>
              <div className="text-xs text-green-600">
                Avg: {avgApyUsd.toFixed(2)}%
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-xs text-amber-600 font-medium">Last Reward</div>
              <div className="text-lg font-bold text-amber-900">
                {parseFloat(latestData.rewardAmountMpc).toFixed(2)} MPC
              </div>
              <div className="text-xs text-amber-600">
                ${latestData.rewardAmountUsd.toFixed(2)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-purple-600 font-medium">Rate Change</div>
              <div className="text-lg font-bold text-purple-900">
                +{(latestData.exchangeRateChange * 100).toFixed(4)}%
              </div>
              <div className="text-xs text-purple-600">
                Daily
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Time Period Selector */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm">
            {(['7d', '30d', '90d', '1y'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {period.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Granularity indicator */}
          <div className="text-xs text-gray-500">
            Showing {GRANULARITY_MAP[timePeriod]} data
          </div>

          {/* Dataset Toggles */}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showApyMpc}
                onChange={(e) => setShowApyMpc(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">APY (MPC)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showApyUsd}
                onChange={(e) => setShowApyUsd(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">APY (USD)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showDailyRewards}
                onChange={(e) => setShowDailyRewards(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">Rate Change</span>
            </label>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-gray-500">Loading reward data...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-gray-500">No reward data available yet</div>
          </div>
        ) : (
          <div className="h-96">
            <Line ref={chartRef} data={chartData} options={options} />
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <strong>APY (MPC):</strong> Protocol reward performance - measures how much additional MPC you earn
          </div>
          <div>
            <strong>APY (USD):</strong> Actual portfolio return - includes both rewards and MPC price changes
          </div>
        </div>
      </div>
    </div>
  )
}

export default RewardsChart
