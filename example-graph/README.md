# Interactive Staking Dashboard for Partisia Indexer

This is a React-based interactive dashboard for visualizing Partisia liquid staking data with advanced charting capabilities.

## Features

### Main Interactive Chart (`InteractiveStakingChart.tsx`)
- **Dual Y-axis**: Displays MPC price (USD) and exchange rate simultaneously
- **Interactive controls**: Time period selector (24h, 7d, 30d, 90d, 1y, all)
- **Zoom & Pan**: Mouse wheel zoom, shift+drag to pan, pinch zoom on mobile
- **Rich tooltips**: Shows price, exchange rate, APY, TVL, and total staked
- **Crosshair annotation**: Visual guide when hovering
- **Real-time updates**: Auto-refreshes every minute
- **Toggle series**: Click checkboxes to show/hide price or exchange rate

### Advanced Dashboard (`AdvancedDashboard.tsx`)
- **Metrics cards**: 7-day price change, average APY, TVL growth
- **TVL composition**: Doughnut chart showing principal, rewards, reserves
- **Daily rewards**: Bar chart of rewards distribution
- **APY breakdown table**: Daily, weekly, monthly APY with growth rates
- **High/low statistics**: Track price and exchange rate extremes

### Data Hooks (`hooks/useStakingData.ts`)
- **`useStakingData`**: Main hook for fetching and combining price/exchange data
- **`useRealtimeUpdates`**: WebSocket support for live updates
- **`useHistoricalExchangeRates`**: Cached historical data fetching
- **`useStakingMetrics`**: Calculate derived metrics and statistics

## Installation

```bash
cd example-graph
npm install
```

## Configuration

Set environment variables in `.env`:

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:3001/ws
```

## Usage

```bash
npm start
```

The dashboard will be available at `http://localhost:3000`

## Integration with Your Template

To integrate into your existing liquid-staking-template:

1. **Install additional dependencies**:
```bash
npm install chartjs-plugin-zoom chartjs-plugin-annotation
```

2. **Copy the hooks**:
```bash
cp hooks/useStakingData.ts ../src/hooks/
```

3. **Replace or enhance your existing graph**:
- The `InteractiveStakingChart` can replace your current `ExchangeRateGraph`
- Or run both side-by-side for comparison

4. **API endpoints required**:
- `/exchangeRates?hours=X` - Historical exchange rates
- `/mpc/prices?hours=X` - Historical MPC prices
- `/apy` - APY calculations
- `/stats` - Current statistics

## Chart.js Interactions

### Zoom Controls
- **Mouse wheel**: Zoom in/out on X-axis
- **Pinch gesture**: Zoom on touchscreens
- **Reset button**: Return to original view

### Pan Controls
- **Shift + drag**: Pan along X-axis
- **Touch drag**: Pan on mobile devices

### Tooltips
- **Hover**: Shows detailed information at cursor position
- **Multi-dataset**: Displays both price and exchange rate
- **Additional info**: Shows APY and TVL in tooltip footer

## Customization

### Modify chart appearance:
```typescript
// In InteractiveStakingChart.tsx
const chartOptions = {
  // Change colors
  datasets: [{
    borderColor: 'rgb(your-color)',
    backgroundColor: 'rgba(your-color, 0.1)',
  }]
}
```

### Add new metrics:
```typescript
// In useStakingData.ts
interface CombinedDataPoint {
  // Add your custom fields
  yourMetric: number
}
```

### Adjust time periods:
```typescript
type TimePeriod = '1h' | '24h' | '7d' // etc
```

## Performance Optimizations

- **Data caching**: 5-minute localStorage cache for historical data
- **Efficient rendering**: Points only shown on hover (pointRadius: 0)
- **Batched updates**: Combines multiple API calls
- **Debounced zoom**: Prevents excessive re-renders

## Mobile Responsiveness

- Responsive chart sizing
- Touch gestures for zoom/pan
- Simplified tooltips on small screens
- Collapsible metric cards

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript required
- WebSocket support for real-time updates