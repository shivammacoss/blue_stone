// Client-side market-hours helper (mirrors backend/services/marketHoursService.js).
//
// The spot market (forex, metals, energy, indices, stocks) is closed on
// weekends; crypto trades 24/7. The backend is the source of truth for which
// instruments stay open on weekends and stamps a `weekendOpen` flag onto each
// instrument in /api/prices/instruments. This helper uses that flag when
// present and falls back to a category check (Crypto) otherwise.

const WEEKEND_OPEN_CATEGORIES = new Set(['Crypto'])

// True on Saturday/Sunday (UTC), matching the backend.
export function isWeekend(date = new Date()) {
  const day = date.getUTCDay() // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6
}

// Does this instrument keep trading on weekends?
export function isInstrumentWeekendOpen(instrument) {
  if (!instrument) return false
  if (instrument.weekendOpen === true) return true
  return WEEKEND_OPEN_CATEGORIES.has(instrument.category)
}

// Is the market open right now for this instrument?
export function isMarketOpen(instrument, date = new Date()) {
  if (!isWeekend(date)) return true
  return isInstrumentWeekendOpen(instrument)
}
