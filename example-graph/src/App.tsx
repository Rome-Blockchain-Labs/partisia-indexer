import React from 'react'
import InteractiveStakingChart from './InteractiveStakingChart'
import AdvancedDashboard from './AdvancedDashboard'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Partisia Liquid Staking Dashboard
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Interactive Chart Component */}
          <InteractiveStakingChart />

          {/* Advanced Dashboard with Multiple Views */}
          <AdvancedDashboard />
        </div>
      </main>
    </div>
  )
}

export default App