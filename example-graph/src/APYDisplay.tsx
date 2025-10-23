import React, { FC, useState, useEffect } from 'react'

interface APYData {
  apy24h: string
  apy7d: string
  apy30d: string
  syncComplete: boolean
}

const APYDisplay: FC = () => {
  const [data, setData] = useState<APYData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAPY = async () => {
    try {
      const response = await fetch('/api/v1/analytics/apy')
      if (!response.ok) {
        throw new Error('Failed to fetch APY data')
      }
      const result = await response.json()
      setData(result.data)
      setError(null)
    } catch (err: any) {
      console.error('Error fetching APY:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAPY()
    // Refresh every 5 minutes
    const interval = setInterval(fetchAPY, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-4 text-red-600">
          Failed to load APY data
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Annual Percentage Yield (APY)</h2>
        {!data.syncComplete && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
            Syncing...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 24 Hour APY */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium mb-1">24 Hour</div>
          <div className="text-3xl font-bold text-blue-900">
            {data.apy24h}%
          </div>
          <div className="text-xs text-blue-600 mt-1">Last day</div>
        </div>

        {/* 7 Day APY */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="text-sm text-purple-600 font-medium mb-1">7 Day</div>
          <div className="text-3xl font-bold text-purple-900">
            {data.apy7d}%
          </div>
          <div className="text-xs text-purple-600 mt-1">Last week</div>
        </div>

        {/* 30 Day APY */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium mb-1">30 Day</div>
          <div className="text-3xl font-bold text-green-900">
            {data.apy30d}%
          </div>
          <div className="text-xs text-green-600 mt-1">Last month</div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        APY is calculated from exchange rate changes over time. Updated every 5 minutes.
      </div>
    </div>
  )
}

export default APYDisplay
