import { mock } from 'bun:test'

const ROOT = import.meta.dir

// ---- fixture ------------------------------------------------------------
// rows are newest-last; exchange_rate grows at a steady daily factor
const DAY_MS = 24 * 60 * 60 * 1000
const T0 = new Date('2026-06-01T00:00:00Z').getTime()
const DAILY_GROWTH = 1.0002 // ~7.57% APY

function makeRows(days: number) {
  const rows: any[] = []
  for (let d = 0; d <= days; d++) {
    rows.push({
      block_number: String(1000 + d),
      timestamp: new Date(T0 + d * DAY_MS),
      exchange_rate: (1.05 * Math.pow(DAILY_GROWTH, d)).toFixed(10),
      total_pool_liquid: '1000',
      total_pool_stake_token: '1100',
    })
  }
  return rows
}

let ROWS: any[] = []

// ---- stubs --------------------------------------------------------------
const fakeDb = {
  query: async (sql: string, params?: any[]) => {
    const usable = ROWS // MEASURABLE filter is a no-op for this fixture
    if (/timestamp <= \$1/.test(sql)) {
      const target = new Date(params![0]).getTime()
      const hits = usable
        .filter(r => new Date(r.timestamp).getTime() <= target)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      return { rows: hits.slice(0, 1) }
    }
    const desc = [...usable].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    return { rows: desc.slice(0, 1) }
  },
}

let STATS = { syncComplete: true, canCalculateAPY: true, progressPercent: 100 }

mock.module(`${ROOT}/src/db/client.ts`, () => ({ default: fakeDb }))
mock.module(`${ROOT}/src/config/index.ts`, () => ({ default: {} }))
mock.module(`${ROOT}/src/utils/denomination.ts`, () => ({ fromRawAmount: (x: any) => x }))
mock.module(`${ROOT}/src/indexer.ts`, () => ({ default: { getStats: async () => STATS } }))

const { createAnalyticsRouter } = await import(`${ROOT}/src/api/v1/analytics.ts`)

// ---- harness ------------------------------------------------------------
const router: any = createAnalyticsRouter()
const layer = router.stack.find(
  (l: any) => l.route?.path === '/apy' && l.route.methods.get,
)
const handler = layer.route.stack[0].handle

async function callApy() {
  let payload: any
  const res: any = { apiSuccess: (d: any) => { payload = d } }
  await handler({ query: {} } as any, res, (e: any) => { throw e })
  return payload
}

// ---- assertions ---------------------------------------------------------
let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`)
  else { console.log(`  FAIL ${name} ${detail}`); failures++ }
}

// A: 40 days of history -> all windows measurable
ROWS = makeRows(40)
let out = await callApy()
console.log('A: 40 days of history')
const expected30 = (Math.pow(Math.pow(DAILY_GROWTH, 30), 365 / 30) - 1) * 100
check('apy30d present', out.apy30d !== null, JSON.stringify(out.apy30d))
check(
  `apy30d ~= ${expected30.toFixed(2)}`,
  Math.abs(parseFloat(out.apy30d) - expected30) < 0.05,
  `got ${out.apy30d}`,
)
check('actualDays >= 30', out.windows.apy30d.actualDays >= 30, String(out.windows.apy30d.actualDays))
check('apy24h and apy7d present', out.apy24h !== null && out.apy7d !== null)
check('all windows agree (constant growth)',
  Math.abs(parseFloat(out.apy24h) - parseFloat(out.apy30d)) < 0.05,
  `24h=${out.apy24h} 30d=${out.apy30d}`)

// the datapoints must reproduce the published figure - the tooltip shows this
// working, so if they disagree the UI is displaying arithmetic that is not the
// arithmetic that produced the number
const dp = out.windows.apy30d.datapoints
check('datapoints are [r1, r2]', dp.length === 2)
check('datapoints are unix seconds',
  dp[0].timestamp > 1e9 && dp[0].timestamp < 1e11, String(dp[0].timestamp))
check('datapoints ordered oldest first', dp[0].timestamp < dp[1].timestamp)
const reproduced =
  (Math.pow(Number(dp[1].rate) / Number(dp[0].rate),
    365 / out.windows.apy30d.actualDays) - 1) * 100
check('datapoints reproduce the published apy30d',
  Math.abs(reproduced - parseFloat(out.apy30d)) < 0.01,
  `formula=${reproduced.toFixed(4)} published=${out.apy30d}`)
check('deltaT from datapoints matches actualDays',
  Math.abs((dp[1].timestamp - dp[0].timestamp) / 86400 - out.windows.apy30d.actualDays) < 0.01)

// B: only 10 days of history -> 30d window must be null, NOT since-inception
ROWS = makeRows(10)
out = await callApy()
console.log('B: 10 days of history')
check('apy30d is null (no silent degradation)', out.apy30d === null, `got ${out.apy30d}`)
check('apy30d window is null', out.windows.apy30d === null)
check('apy7d still measurable', out.apy7d !== null, `got ${out.apy7d}`)

// C: sync incomplete -> nulls, never "0.00"
STATS = { syncComplete: false, canCalculateAPY: false, progressPercent: 42.5 }
out = await callApy()
console.log('C: sync incomplete')
check('apy30d null not "0.00"', out.apy30d === null, `got ${JSON.stringify(out.apy30d)}`)
check('apy24h null not "0.00"', out.apy24h === null, `got ${JSON.stringify(out.apy24h)}`)
check('syncComplete false', out.syncComplete === false)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
