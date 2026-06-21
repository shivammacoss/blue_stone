// Market hours / weekend trading rules.
//
// The spot CFD market (forex, metals, energy, indices, US stocks) is closed on
// weekends. Crypto trades 24/7, so crypto instruments stay open. In addition,
// specific instruments can be kept open on weekends via the
// WEEKEND_OPEN_SYMBOLS env var (comma-separated symbols), e.g.
//   WEEKEND_OPEN_SYMBOLS=BTCUSD,ETHUSD,US500
//
// This module is the single source of truth used by:
//   - the trade /open route (server-side enforcement), and
//   - the /api/prices/instruments response (so the web + mobile UIs know which
//     instruments to keep enabled over the weekend).

// Categories whose instruments trade 24/7, including weekends.
const WEEKEND_OPEN_CATEGORIES = new Set(['Crypto'])

// Parse the configurable per-symbol weekend allow-list from the environment.
// Read lazily so the value can be changed without restarting in dev tooling.
function getWeekendOpenSymbols() {
  return new Set(
    (process.env.WEEKEND_OPEN_SYMBOLS || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  )
}

// True on Saturday/Sunday (UTC). FX markets are closed across the weekend.
export function isWeekend(date = new Date()) {
  const day = date.getUTCDay() // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6
}

// Does this instrument keep trading on weekends?
// (Crypto by default, plus any symbols listed in WEEKEND_OPEN_SYMBOLS.)
export function isWeekendOpenInstrument(symbol, category) {
  if (symbol && getWeekendOpenSymbols().has(symbol.toUpperCase())) return true
  return WEEKEND_OPEN_CATEGORIES.has(category)
}

// Is the market open right now for this instrument?
// Weekdays: always open. Weekends: only crypto + configured symbols.
export function isMarketOpen(symbol, category, date = new Date()) {
  if (!isWeekend(date)) return true
  return isWeekendOpenInstrument(symbol, category)
}

export default { isWeekend, isWeekendOpenInstrument, isMarketOpen }
