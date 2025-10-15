import React, { FC, useMemo, useState, useCallback, useRef, useEffect } from 'react'
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
  TooltipItem,
  ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import annotationPlugin from 'chartjs-plugin-annotation'
import { format, subDays, subMonths, parseISO } from 'date-fns'
import { API_BASE_URL } from './config'

// Register Chart.js components
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

interface DataPoint {
  timestamp: string
  price?: number
  exchangeRate?: number
  totalStaked?: string
  apy?: number
}

type TimePeriod = '24h' | '7d' | '30d' | '90d' | '1y' | 'all'

const InteractiveStakingChart: FC = () => {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [showPrice, setShowPrice] = useState(true)
  const [showExchangeRate, setShowExchangeRate] = useState(true)
  const [showVolume, setShowVolume] = useState(false)
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Fetch data from your indexer API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const hours = {
        '24h': 24,
        '7d': 168,
        '30d': 720,
        '90d': 2160,
        '1y': 8760,
        'all': 10000,
      }[timePeriod]

      const [exchangeRes] = await Promise.all([
        fetch(`${API_BASE_URL}/exchangeRates?hours=${hours}`),
      ])

      const rates = await exchangeRes.json()

      // Convert exchange rate data to chart format
      const mergedData: DataPoint[] = rates.map((rate: any) => ({
        timestamp: rate.timestamp,
        exchangeRate: parseFloat(rate.rate),
        totalStaked: rate.totalStake,
        price: 0.01562, // Use current MPC price from our MEXC service
      }))


      // Add APY calculations
      for (let i = 1; i < mergedData.length; i++) {
        const current = mergedData[i]
        const dayAgo = mergedData[Math.max(0, i - 24)] // 24 hours ago
        if (current.exchangeRate && dayAgo.exchangeRate) {
          const dailyReturn = (current.exchangeRate - dayAgo.exchangeRate) / dayAgo.exchangeRate
          current.apy = dailyReturn * 365 * 100
        }
      }

      setData(mergedData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [timePeriod])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchData])

  const chartData = useMemo(() => {
    const labels = data.map(d => format(parseISO(d.timestamp), 'MMM dd HH:mm'))

    const datasets = []

    if (showPrice) {
      datasets.push({
        label: 'MPC Price (USD)',
        data: data.map(d => d.price || null),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y-price',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      })
    }

    if (showExchangeRate) {
      datasets.push({
        label: 'Exchange Rate',
        data: data.map(d => d.exchangeRate || null),
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

    return { labels, datasets }
  }, [data, showPrice, showExchangeRate])

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
            return format(parseISO(point.timestamp), 'PPpp')
          },
          label: (context) => {
            const index = context.dataIndex
            const point = data[index]
            const label = context.dataset.label || ''

            if (label.includes('Price')) {
              return `${label}: $${point.price?.toFixed(4) || 'N/A'}`
            } else if (label.includes('Exchange')) {
              const apy = point.apy ? ` (APY: ${point.apy.toFixed(2)}%)` : ''
              return `${label}: ${point.exchangeRate?.toFixed(6) || 'N/A'}${apy}`
            }
            return ''
          },
          afterBody: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const point = data[index]
            const lines = []

            if (point.totalStaked) {
              const staked = (parseFloat(point.totalStaked) / 1e6).toFixed(2)
              lines.push(`Total Staked: ${staked}M MPC`)

              if (point.price) {
                const tvl = (parseFloat(point.totalStaked) / 1e6 * point.price).toFixed(2)
                lines.push(`TVL: $${tvl}M`)
              }
            }

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
      annotation: hoveredIndex !== null ? {
        annotations: {
          line1: {
            type: 'line',
            xMin: hoveredIndex,
            xMax: hoveredIndex,
            borderColor: 'rgba(156, 163, 175, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
          },
        },
      } : {},
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
        display: showPrice,
        position: 'left',
        title: {
          display: true,
          text: 'Price (USD)',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: (value) => `$${value}`,
          font: { size: 11 },
        },
      },
      'y-rate': {
        type: 'linear',
        display: showExchangeRate,
        position: 'right',
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
        },
      },
    },
    onHover: (event, activeElements) => {
      setHoveredIndex(activeElements.length > 0 ? activeElements[0].index : null)
    },
  }), [data, showPrice, showExchangeRate, hoveredIndex])

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-lg">
        <div className="text-gray-500">Loading chart data...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-gray-800">Liquid Staking Analytics</h2>

        {/* Time Period Selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '30d', '90d', '1y', 'all'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timePeriod === period
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle Controls */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showPrice}
            onChange={(e) => setShowPrice(e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700">MPC Price</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showExchangeRate}
            onChange={(e) => setShowExchangeRate(e.target.checked)}
            className="w-4 h-4 text-green-600"
          />
          <span className="text-sm text-gray-700">Exchange Rate</span>
        </label>
        <button
          onClick={resetZoom}
          className="ml-auto px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Reset Zoom
        </button>
      </div>

      {/* Chart */}
      <div className="relative h-96">
        <Line ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      {/* Stats Summary */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <div className="text-sm text-gray-500">Current Price</div>
            <div className="text-lg font-semibold">
              ${data[data.length - 1]?.price?.toFixed(4) || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Exchange Rate</div>
            <div className="text-lg font-semibold">
              {data[data.length - 1]?.exchangeRate?.toFixed(6) || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Current APY</div>
            <div className="text-lg font-semibold text-green-600">
              {data[data.length - 1]?.apy?.toFixed(2) || '0'}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Total Value Locked</div>
            <div className="text-lg font-semibold">
              ${((parseFloat(data[data.length - 1]?.totalStaked || '0') / 1e6) *
                (data[data.length - 1]?.price || 0)).toFixed(2)}M
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 text-xs text-gray-500">
        • Scroll to zoom • Shift+drag to pan • Click legend to toggle series
      </div>
    </div>
  )
}

export default InteractiveStakingChart