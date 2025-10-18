import React, { FC } from 'react'
import { useRealtimeData } from './hooks/useRealtimeData'

const IndexingProgress: FC = () => {
  const { data: progress, loading, error, connectionStatus, reconnect } = useRealtimeData()

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
            <span className="text-sm text-gray-500">Connecting...</span>
          </div>
        </div>
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!progress) return null

  // Don't show if indexing is complete
  if (progress.overall.syncComplete) return null

  const { stateIndexer, transactionIndexer, overall } = progress

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-indigo-900">🔄 Blockchain Indexing</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {connectionStatus === 'connected' && (
              <>
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-green-600">Live</span>
              </>
            )}
            {connectionStatus === 'connecting' && (
              <>
                <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-yellow-600">Connecting</span>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <div className="h-2 w-2 bg-orange-400 rounded-full"></div>
                <span className="text-sm text-orange-600">Reconnecting</span>
              </>
            )}
            {connectionStatus === 'error' && (
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
          The dashboard shows {connectionStatus === 'connected' ? 'live' : 'cached'} data from indexed blocks.
        </div>
      </div>
    </div>
  )
}

export default IndexingProgress