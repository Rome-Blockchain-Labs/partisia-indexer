import React, { FC, useState, useEffect } from 'react'
import { API_BASE_URL } from './config'

interface Transaction {
  txHash: string
  action: string
  timestamp: string
  blockNumber: string
}

const TransactionsPanel: FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'submit' | 'requestUnlock' | 'withdraw' | 'accrueRewards' | 'redeem' | 'approve' | 'transfer'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      try {
        const skip = (currentPage - 1) * pageSize
        const query = {
          query: `
            query GetTransactions($first: Int!, $skip: Int!, $where: TransactionFilter) {
              transactions(first: $first, skip: $skip, where: $where, orderBy: TIMESTAMP_DESC) {
                txHash
                action
                timestamp
                blockNumber
              }
            }
          `,
          variables: {
            first: pageSize,
            skip,
            where: filter === 'all' ? {} : { action: filter }
          }
        }

        const response = await fetch(`${API_BASE_URL}/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query)
        })

        const result = await response.json()
        if (result.data) {
          setTransactions(result.data.transactions)
        }
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [filter, currentPage])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'submit': return 'bg-blue-100 text-blue-800'
      case 'deposit': return 'bg-blue-100 text-blue-800'
      case 'requestUnlock': return 'bg-orange-100 text-orange-800'
      case 'withdraw': return 'bg-red-100 text-red-800'
      case 'redeem': return 'bg-red-100 text-red-800'
      case 'accrueRewards': return 'bg-green-100 text-green-800'
      case 'transfer': return 'bg-purple-100 text-purple-800'
      case 'transferFrom': return 'bg-purple-100 text-purple-800'
      case 'approve': return 'bg-indigo-100 text-indigo-800'
      case 'changeBuyIn': return 'bg-yellow-100 text-yellow-800'
      case 'disableBuyIn': return 'bg-yellow-100 text-yellow-800'
      case 'cleanUpPendingUnlocks': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'submit': return 'Stake'
      case 'deposit': return 'Deposit'
      case 'requestUnlock': return 'Unstake'
      case 'withdraw': return 'Withdraw'
      case 'redeem': return 'Redeem'
      case 'accrueRewards': return 'Protocol Rewards'
      case 'transfer': return 'Transfer'
      case 'transferFrom': return 'Transfer From'
      case 'approve': return 'Approve'
      case 'changeBuyIn': return 'Change Buy-In'
      case 'disableBuyIn': return 'Disable Buy-In'
      case 'cleanUpPendingUnlocks': return 'Cleanup'
      default: return action
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Recent Transactions</h2>

        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'submit', label: 'Stake' },
            { value: 'requestUnlock', label: 'Unstake' },
            { value: 'withdraw', label: 'Withdraw' },
            { value: 'accrueRewards', label: 'Protocol Rewards' },
            { value: 'redeem', label: 'Redeem' },
            { value: 'approve', label: 'Approve' },
            { value: 'transfer', label: 'Transfer' }
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value as any)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === filterOption.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="text-gray-500">Loading transactions...</div>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found for the selected filter.
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.txHash}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(tx.action)}`}>
                    {getActionLabel(tx.action)}
                  </span>
                  <div>
                    <div className="font-mono text-sm">
                      {tx.txHash.substring(0, 10)}...{tx.txHash.substring(-6)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Block {tx.blockNumber}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium">
                    {formatTimestamp(tx.timestamp)}
                  </div>
                  <a
                    href={`https://browser.partisiablockchain.com/transactions/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View Details →
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && transactions.length > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div className="text-sm text-gray-600">
            Page {currentPage}
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              ← Previous
            </button>

            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={transactions.length < pageSize}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                transactions.length < pageSize
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionsPanel