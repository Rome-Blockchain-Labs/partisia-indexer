import React, { FC, useMemo, useState } from 'react'
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
import annotationPlugin from 'chartjs-plugin-annotation'
import { format } from 'date-fns'
import { useStakingData } from './hooks/useStakingData'

ChartJS.register(
  ...registerables,
  zoomPlugin,
  annotationPlugin,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type TimePeriod = '24h' | '7d' | '30d' | '90d' | '1y' | 'all'

interface HistoricalExchangeRatesChartProps {
  className?: string
}

const HistoricalExchangeRatesChart: FC<HistoricalExchangeRatesChartProps> = ({
  className = ''
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [showAPY, setShowAPY] = useState(true)

  const { data: stakingData, loading, error, refetch } = useStakingData(timePeriod)

  const chartData = useMemo(() => {
    const labels = stakingData.map(d => format(d.timestamp, 'MMM dd HH:mm'))

    const datasets = [
      {
        label: 'Exchange Rate',
        data: stakingData.map(d => d.exchangeRate),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        yAxisID: 'y-rate',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      }
    ]

    if (showAPY) {
      datasets.push({
        label: 'APY (%)',
        data: stakingData.map(d => d.apy || 0),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        yAxisID: 'y-apy',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      } as any)
    }

    return { labels, datasets }
  }, [stakingData, showAPY])

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
            const point = stakingData[index]
            return format(point.timestamp, 'PPpp')
          },
          label: (context) => {
            const index = context.dataIndex
            const point = stakingData[index]
            const label = context.dataset.label || ''

            if (label.includes('Exchange')) {
              return `Exchange Rate: ${point.exchangeRate.toFixed(6)}`
            } else if (label.includes('APY')) {
              return `APY: ${(point.apy || 0).toFixed(2)}%`
            }
            return ''
          },
          afterBody: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const point = stakingData[index]
            const lines = []

            lines.push(`Block: ${point.blockNumber}`)
            lines.push(`Total Staked: ${(Number(point.totalStaked) / 1e6).toFixed(2)}M MPC`)
            lines.push(`TVL: $${point.tvlUSD.toFixed(2)}`)

            return lines
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
      'y-rate': {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Exchange Rate',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          drawOnChartArea: true,
          color: 'rgba(229, 231, 235, 0.1)',
        },
        ticks: {
          font: { size: 11 },
          callback: (value) => Number(value).toFixed(6),
        },
      },
      'y-apy': {
        type: 'linear',
        display: showAPY,
        position: 'right',
        title: {
          display: true,
          text: 'APY (%)',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: { size: 11 },
          callback: (value) => `${value}%`,
        },
      },
    },
  }), [stakingData, showAPY])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading exchange rate history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading exchange rate data: {error.message}</p>
          <button
            onClick={refetch}
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (stakingData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-gray-600">No exchange rate data available</p>
        </div>
      </div>
    )
  }

  const latestRate = stakingData[stakingData.length - 1]?.exchangeRate || 0
  const earliestRate = stakingData[0]?.exchangeRate || 0
  const rateChange = latestRate - earliestRate
  const rateChangePercent = earliestRate ? (rateChange / earliestRate) * 100 : 0

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Historical Exchange Rates</h2>
          <p className="text-sm text-gray-600">
            Track the sMPC/MPC exchange rate over time
          </p>
        </div>

        {/* Time Period Selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '30d', '90d', '1y', 'all'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timePeriod === period
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showAPY}
            onChange={(e) => setShowAPY(e.target.checked)}
            className="w-4 h-4 text-purple-600"
          />
          <span className="text-sm text-gray-700">Show APY</span>
        </label>
        <div className="ml-auto">
          <button
            onClick={refetch}
            className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-96">
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
        <div>
          <div className="text-sm text-gray-500">Current Rate</div>
          <div className="text-lg font-semibold">
            {latestRate.toFixed(6)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Rate Change</div>
          <div className={`text-lg font-semibold ${rateChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {rateChange > 0 ? '+' : ''}{rateChange.toFixed(6)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">% Change</div>
          <div className={`text-lg font-semibold ${rateChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {rateChangePercent > 0 ? '+' : ''}{rateChangePercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Data Points</div>
          <div className="text-lg font-semibold">
            {stakingData.length}
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

export default HistoricalExchangeRatesChart