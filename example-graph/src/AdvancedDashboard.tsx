import React, { FC, useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { useStakingData, useStakingMetrics } from './hooks/useStakingData'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const AdvancedDashboard: FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'rewards' | 'volume' | 'holders'>('rewards')
  const { data, loading, error, apy, currentStats } = useStakingData('7d')
  const calculateMetrics = useStakingMetrics(data)
  const metrics = useMemo(() => calculateMetrics(), [calculateMetrics])

  // Calculate daily rewards distribution
  const dailyRewards = useMemo(() => {
    if (data.length < 24) return { labels: [], values: [] }

    const rewardsByDay = new Map<string, number>()

    for (let i = 24; i < data.length; i++) {
      const current = data[i]
      const previous = data[i - 24]
      const dateKey = format(current.timestamp, 'MMM dd')

      if (current.exchangeRate > previous.exchangeRate) {
        const rewards = (current.exchangeRate - previous.exchangeRate) * Number(current.totalLiquid) / 1e6
        rewardsByDay.set(dateKey, (rewardsByDay.get(dateKey) || 0) + rewards)
      }
    }

    return {
      labels: Array.from(rewardsByDay.keys()),
      values: Array.from(rewardsByDay.values()),
    }
  }, [data])

  // Calculate TVL composition
  const tvlComposition = useMemo(() => {
    if (!currentStats) return null

    const staked = Number(currentStats.totalStaked) / 1e6
    const liquidSupply = staked * currentStats.exchangeRate
    const rewards = liquidSupply - staked

    return {
      labels: ['Principal Staked', 'Accumulated Rewards', 'Protocol Reserves'],
      data: [staked, rewards > 0 ? rewards : 0, staked * 0.1], // Mock reserves
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(34, 197, 94, 0.8)',    // Green
        'rgba(168, 85, 247, 0.8)',   // Purple
      ],
      borderColor: [
        'rgb(59, 130, 246)',
        'rgb(34, 197, 94)',
        'rgb(168, 85, 247)',
      ],
    }
  }, [currentStats])

  if (loading) return <div className="flex justify-center p-8">Loading dashboard...</div>
  if (error) return <div className="text-red-500 p-8">Error: {error.message}</div>

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-6">Advanced Analytics</h2>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
          <div className="text-blue-600 text-sm font-medium">7D Price Change</div>
          <div className="text-2xl font-bold mt-1">
            {metrics?.priceChangePercent.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">
            ${metrics?.priceChange.toFixed(4)} change
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
          <div className="text-green-600 text-sm font-medium">Average APY</div>
          <div className="text-2xl font-bold mt-1">
            {metrics?.averageApy.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">
            7-day average
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
          <div className="text-purple-600 text-sm font-medium">TVL Growth</div>
          <div className="text-2xl font-bold mt-1">
            {metrics?.tvlChangePercent.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">
            ${((metrics?.tvlChange ?? 0) / 1e6).toFixed(2)}M change
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TVL Composition Doughnut Chart */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">TVL Composition</h3>
          <div className="h-64">
            {tvlComposition && (
              <Doughnut
                data={{
                  labels: tvlComposition.labels,
                  datasets: [{
                    data: tvlComposition.data,
                    backgroundColor: tvlComposition.backgroundColor,
                    borderColor: tvlComposition.borderColor,
                    borderWidth: 2,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                      labels: {
                        padding: 15,
                        font: { size: 11 },
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = context.raw as number
                          const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0)
                          const percentage = ((value / total) * 100).toFixed(1)
                          return `${context.label}: ${value.toFixed(2)}M MPC (${percentage}%)`
                        },
                      },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>

        {/* Daily Rewards Bar Chart */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Daily Rewards Distribution</h3>
          <div className="h-64">
            <Bar
              data={{
                labels: dailyRewards.labels,
                datasets: [{
                  label: 'Rewards (MPC)',
                  data: dailyRewards.values,
                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                  borderColor: 'rgb(34, 197, 94)',
                  borderWidth: 1,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        return `Rewards: ${(context.raw as number).toFixed(2)} MPC`
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `${value} MPC`,
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* APY Breakdown Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">APY Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Period</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">APY</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Exchange Rate</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2">24 Hours</td>
                <td className="px-4 py-2 text-right font-mono">
                  {apy.daily?.toFixed(2) || '—'}%
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {currentStats?.exchangeRate.toFixed(6)}
                </td>
                <td className="px-4 py-2 text-right text-green-600">
                  +{((apy.daily || 0) / 365).toFixed(4)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2">7 Days</td>
                <td className="px-4 py-2 text-right font-mono">
                  {apy.weekly?.toFixed(2) || '—'}%
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {metrics?.exchangeRateHigh.toFixed(6)}
                </td>
                <td className="px-4 py-2 text-right text-green-600">
                  +{((apy.weekly || 0) / 52).toFixed(4)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2">30 Days</td>
                <td className="px-4 py-2 text-right font-mono">
                  {apy.monthly?.toFixed(2) || '—'}%
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {metrics?.exchangeRateLow.toFixed(6)}
                </td>
                <td className="px-4 py-2 text-right text-green-600">
                  +{((apy.monthly || 0) / 12).toFixed(4)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* High/Low Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <div className="text-xs text-gray-500">Price High</div>
          <div className="font-semibold">${metrics?.priceHigh.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Price Low</div>
          <div className="font-semibold">${metrics?.priceLow.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Exchange High</div>
          <div className="font-semibold">{metrics?.exchangeRateHigh.toFixed(6)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Exchange Low</div>
          <div className="font-semibold">{metrics?.exchangeRateLow.toFixed(6)}</div>
        </div>
      </div>
    </div>
  )
}

export default AdvancedDashboard