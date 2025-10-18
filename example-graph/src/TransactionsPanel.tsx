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
  const [filter, setFilter] = useState<'all' | 'accrueRewards' | 'stake' | 'unstake'>('all')

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      try {
        const query = {
          query: `
            query GetTransactions($first: Int!, $where: TransactionFilter) {
              transactions(first: $first, where: $where, orderBy: TIMESTAMP_DESC) {
                txHash
                action
                timestamp
                blockNumber
              }
            }
          `,
          variables: {
            first: 20,
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
      case 'accrueRewards': return 'bg-green-100 text-green-800'
      case 'stake': return 'bg-blue-100 text-blue-800'
      case 'unstake': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Recent Transactions</h2>

        <div className="flex space-x-2">
          {['all', 'accrueRewards', 'stake', 'unstake'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption as any)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption === 'all' ? 'All' : filterOption}
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
                    {tx.action}
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
    </div>
  )
}

export default TransactionsPanel