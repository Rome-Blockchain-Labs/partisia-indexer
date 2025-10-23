import React, { FC, useState, useEffect } from 'react'
import { API_BASE_URL } from './config'

const IndexingProgress: FC = () => {
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = async () => {
    try {
      // Use the v1 indexer status endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/indexer/status`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const apiResponse = await response.json()

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.error?.message || 'API request failed')
      }

      const data = apiResponse.data

      // Transform v1 response to match component structure
      const transformedData = {
        overall: {
          progressPercent: data.state.progressPercent,
          syncComplete: data.state.syncComplete,
          estimatedTimeRemaining: data.overall.syncing ? 'Syncing...' : 'Complete'
        },
        stateIndexer: {
          currentBlock: data.state.currentBlock,
          targetBlock: data.state.targetBlock,
          blocksRemaining: data.state.blocksRemaining,
          progressPercent: data.state.progressPercent,
          blocksPerSecond: data.state.blocksPerSecond,
          syncComplete: data.state.syncComplete
        },
        transactionIndexer: {
          currentBlock: data.transactions.currentBlock,
          targetBlock: data.transactions.targetBlock,
          deploymentBlock: data.transactions.deploymentBlock,
          blocksRemaining: data.transactions.blocksRemaining,
          progressPercent: Math.min(100, (((data.transactions.currentBlock - data.transactions.deploymentBlock) / (data.transactions.targetBlock - data.transactions.deploymentBlock)) * 100)),
          transactionsFound: data.transactions.transactionsProcessed,
          contractTxFound: data.transactions.contractTxFound,
          adminTxFound: data.transactions.adminTxFound,
          blocksPerSecond: data.transactions.blocksPerSecond || 0
        }
      }

      setProgress(transformedData)
      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to fetch status: ${errorMsg}`)
      console.error('Error fetching progress:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProgress()
    const interval = setInterval(fetchProgress, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const reconnect = () => {
    setLoading(true)
    fetchProgress()
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }


  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Indexing Progress</h2>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        </div>
        <div className="text-gray-500">Fetching indexer status...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-red-800">⚠️ Indexing Status Error</h2>
          <button
            onClick={reconnect}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
          >
            Retry
          </button>
        </div>
        <div className="text-red-600">
          {error} - Using /api/status endpoint
        </div>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="bg-gray-50 rounded-lg shadow-lg p-6 mb-8">
        <div className="text-gray-600">No indexing progress data available</div>
      </div>
    )
  }

  const { stateIndexer, transactionIndexer, overall } = progress

  // Don't show if both indexers are complete
  const bothComplete = stateIndexer.syncComplete && transactionIndexer.progressPercent >= 100
  if (bothComplete) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-indigo-900">🔄 Blockchain Indexing</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {!error && (
              <>
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-green-600">Live</span>
              </>
            )}
            {error && (
              <>
                <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                <span className="text-sm text-red-600 cursor-pointer" onClick={reconnect}>Retry</span>
              </>
            )}
          </div>
          <div className="text-sm text-indigo-600">
            {overall.progressPercent.toFixed(1)}% Complete
          </div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{overall.estimatedTimeRemaining}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, overall.progressPercent)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* State Indexer */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">📊 State Indexer</h3>
            <div className="text-sm text-gray-500">
              {stateIndexer.blocksPerSecond.toFixed(1)} blocks/s
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stateIndexer.progressPercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Current:</span>
              <div className="font-mono">{formatNumber(stateIndexer.currentBlock)}</div>
            </div>
            <div>
              <span className="text-gray-500">Target:</span>
              <div className="font-mono">{formatNumber(stateIndexer.targetBlock)}</div>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Remaining:</span>
              <div className="font-mono">{formatNumber(stateIndexer.blocksRemaining)} blocks</div>
            </div>
          </div>
        </div>

        {/* Transaction Indexer */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">🔍 Transaction Indexer</h3>
            <div className="text-sm text-gray-500">
              {transactionIndexer.blocksPerSecond.toFixed(1)} blocks/s
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, transactionIndexer.progressPercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Current:</span>
              <div className="font-mono">{formatNumber(transactionIndexer.currentBlock)}</div>
            </div>
            <div>
              <span className="text-gray-500">Target:</span>
              <div className="font-mono">{formatNumber(transactionIndexer.targetBlock)}</div>
            </div>
            <div>
              <span className="text-gray-500">Contract TX:</span>
              <div className="font-mono text-blue-600">{transactionIndexer.contractTxFound}</div>
            </div>
            <div>
              <span className="text-gray-500">Admin TX:</span>
              <div className="font-mono text-purple-600">{transactionIndexer.adminTxFound}</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-800">
            <strong>Connection Error:</strong> {error}
            <button
              onClick={reconnect}
              className="ml-2 text-red-600 hover:text-red-800 underline"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>Note:</strong> Full historical data and APY calculations will be available once indexing completes.
          The dashboard shows {!error ? 'live' : 'cached'} data from indexed blocks.
        </div>
      </div>
    </div>
  )
}

export default IndexingProgress