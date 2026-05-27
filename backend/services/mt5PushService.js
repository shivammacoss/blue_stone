/**
 * MT5 Push Service — direct A-Book hedging via MetaAPI
 *
 * When MT5_PUSH_ENABLED=true and credentials are present, lpService routes
 * A-Book trades through this module instead of (or before) Corecen REST.
 * The flow:
 *   - On open  → createMarketBuyOrder / createMarketSellOrder → store positionId on Trade
 *   - On close → closePosition(positionId)
 *   - On modify → modifyPosition(positionId, sl, tp)
 *
 * We hold a single long-lived RPC connection to ONE hedging MT5 account
 * (every A-Book trade in BlueStone hedges into the same MT5 book). Adding
 * per-user MT5 accounts later only requires keying the connection cache by
 * accountId instead of using a single singleton.
 *
 * Required env vars (when enabled):
 *   MT5_PUSH_ENABLED=true
 *   METAAPI_TOKEN=<JWT>
 *   METAAPI_ACCOUNT_ID=<UUID>
 * Optional:
 *   MT5_SYMBOL_SUFFIX=.raw         broker-specific suffix appended to canonical symbols
 *   MT5_VOLUME_MULTIPLIER=1.0      scale BlueStone lot size before sending to MT5
 *   MT5_DEFAULT_SLIPPAGE=10        slippage tolerance in points
 */

import dotenv from 'dotenv'
dotenv.config()

const PUSH_ENABLED = process.env.MT5_PUSH_ENABLED === 'true'
const METAAPI_TOKEN = process.env.METAAPI_TOKEN || ''
const METAAPI_ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID || ''
const SYMBOL_SUFFIX = process.env.MT5_SYMBOL_SUFFIX || ''
const VOLUME_MULTIPLIER = parseFloat(process.env.MT5_VOLUME_MULTIPLIER || '1.0')
const DEFAULT_SLIPPAGE = parseInt(process.env.MT5_DEFAULT_SLIPPAGE || '10', 10)

// Reverse aliases: BlueStone canonical symbol → MT5 broker symbol. Falls back
// to <canonical><SYMBOL_SUFFIX> when no explicit alias is configured.
const REVERSE_ALIASES = {
  XAUUSD: 'GOLD',
  XAGUSD: 'SILVER',
  XPTUSD: 'PLATINUM',
  XPDUSD: 'PALLADIUM',
  BTCUSD: 'BITCOIN',
  ETHUSD: 'ETHEREUM',
  LTCUSD: 'LITECOIN',
  XRPUSD: 'RIPPLE'
}

// Forex quote currencies — used to recognise "EURUSD"-shaped symbols so we
// don't accidentally treat them as crypto pairs and try USDT variants.
const FOREX_QUOTES = new Set([
  'EUR','GBP','JPY','AUD','NZD','CAD','CHF','SGD','HKD','MXN','TRY','ZAR',
  'SEK','NOK','DKK','PLN','HUF','RUB','CNY','CZK','ILS','THB','KRW','INR'
])

// Commodity / metal bases — same exclusion purpose.
const METAL_BASES = new Set(['XAU','XAG','XPT','XPD'])

let api = null
let account = null
let connection = null
let isConnected = false
let isConnecting = false
let lastError = null

// Cache of symbols the broker actually lists. Populated lazily on first
// push, refreshed every 30 minutes. Knowing the real list lets us pick the
// broker's exact gold/silver/crypto name (e.g. "XAUUSD.r", "GOLD#", "ATOMUSDT.m")
// instead of guessing through a candidate list and burning round-trips.
let brokerSymbolsCache = null
let brokerSymbolsCacheAt = 0
const BROKER_SYMBOLS_TTL_MS = 30 * 60 * 1000

// Circuit breaker — prevent runaway reconnect loops when MetaAPI is down.
// The SDK has its own ~1.5s reconnect that spams logs when MetaAPI returns
// 503 / network is flaky. We wrap with exponential backoff and stop trying
// after too many failures (admin can force-reconnect via /api/book/mt5/connect).
let consecutiveFailures = 0
let nextRetryAt = 0
let circuitOpen = false  // true = stop auto-retrying, wait for manual reset
const MIN_RETRY_DELAY_MS = 30 * 1000        // first retry after 30s
const MAX_RETRY_DELAY_MS = 10 * 60 * 1000   // cap at 10 min between auto-retries
const FAILURE_TRIP_THRESHOLD = 5             // open circuit after 5 consecutive fails

const log = (...args) => console.log('[MT5 Push]', ...args)
const warn = (...args) => console.warn('[MT5 Push]', ...args)
const error = (...args) => console.error('[MT5 Push]', ...args)

// Suppress MetaAPI SDK's verbose websocket reconnect spam. SDK uses log4js
// for its internal logging; raising the level to 'fatal' silences the
// per-1.5s "xhr poll error" lines that flood production logs when MetaAPI
// returns 503. Our own circuit breaker handles real failures separately.
;(async () => {
  try {
    const log4js = await import('log4js')
    log4js.default.configure({
      appenders: { out: { type: 'console' } },
      categories: { default: { appenders: ['out'], level: 'fatal' } }
    })
  } catch (_) {
    // log4js not directly available — best-effort only, fall through silently.
  }
})()

// MetaAPI errors are rich objects: ValidationError throws with .details[] (the
// real reason — "symbol not found", "volume below min", etc.), TradeError
// throws with .stringCode / .numericCode (TRADE_RETCODE_*). Generic JS errors
// only have .message. This helper flattens all of them into a printable shape.
function describeError(err) {
  if (!err) return { message: 'Unknown error' }
  const out = { message: err.message || String(err) }
  if (err.stringCode) out.stringCode = err.stringCode
  if (err.numericCode !== undefined) out.numericCode = err.numericCode
  if (Array.isArray(err.details) && err.details.length > 0) {
    out.details = err.details.map(d => {
      if (typeof d === 'string') return d
      if (d?.message) return d.parameter ? `${d.parameter}: ${d.message}` : d.message
      return JSON.stringify(d)
    })
  }
  // Compose a human-readable summary line.
  const parts = [out.message]
  if (out.stringCode) parts.push(`(${out.stringCode})`)
  if (out.details) parts.push(`— ${out.details.join('; ')}`)
  out.summary = parts.join(' ')
  return out
}

export const isPushEnabled = () => PUSH_ENABLED
export const isPushConfigured = () => PUSH_ENABLED && !!METAAPI_TOKEN && !!METAAPI_ACCOUNT_ID
export const isPushReady = () => isPushConfigured() && isConnected

/**
 * Map a BlueStone canonical symbol (EURUSD, XAUUSD, BTCUSD) to whatever the
 * MT5 broker calls it. Tries: explicit reverse alias → canonical + suffix → canonical.
 * Brokers vary wildly; if a trade fails with "symbol not found", set
 * MT5_SYMBOL_SUFFIX or add an entry to REVERSE_ALIASES.
 */
export function mapSymbolToMt5(canonical) {
  if (!canonical) return canonical
  const upper = canonical.toUpperCase()
  if (REVERSE_ALIASES[upper]) return REVERSE_ALIASES[upper] + (SYMBOL_SUFFIX || '')
  return upper + (SYMBOL_SUFFIX || '')
}

/**
 * Build an ordered list of MT5 symbol candidates to try for one BlueStone
 * canonical symbol. Brokers name silver / gold / crypto wildly differently
 * (SILVER, XAGUSD, XAGUSD.r, SILVERm, ATOMUSDT, ...), so on push failure we
 * walk this list before giving up. First entry is the preferred mapping
 * (alias + suffix), subsequent entries are progressively looser fallbacks.
 *
 * Crypto note: BlueStone quotes crypto vs USD (Coinbase feed) but most MT5
 * brokers list crypto vs USDT. For any non-forex, non-metal *USD symbol we
 * also try the USDT-quoted variant so ATOMUSD → ATOMUSDT, SOLUSD → SOLUSDT
 * etc. just work out of the box.
 */
export function getSymbolCandidates(canonical) {
  if (!canonical) return []
  const upper = canonical.toUpperCase()
  const suf = SYMBOL_SUFFIX || ''
  const ordered = []
  const seen = new Set()
  const push = (s) => { if (s && !seen.has(s)) { seen.add(s); ordered.push(s) } }

  const alias = REVERSE_ALIASES[upper]
  if (alias) {
    push(alias + suf)
    push(alias)
  }
  push(upper + suf)
  push(upper)

  // Crypto USDT fallback. Only applies when the symbol ends in USD and isn't
  // already a forex or metal pair — those have their own listings and a USDT
  // substitution would be wrong.
  if (upper.endsWith('USD') && upper.length >= 6) {
    const base = upper.slice(0, -3)
    if (!FOREX_QUOTES.has(base) && !METAL_BASES.has(base)) {
      push(base + 'USDT' + suf)
      push(base + 'USDT')
      // Some brokers drop the quote currency entirely (e.g. plain "ATOM").
      push(base + suf)
      push(base)
    }
  }

  return ordered
}

// MetaAPI's ValidationError / TradeError shapes differ across SDK versions,
// but error categorization is stable enough via substring matching. These
// detectors decide which fallback to apply on a failed push attempt — the
// symbol loop, or the clientId-drop retry.

// flatten an error description into a single lowercase haystack
function _flatErr(desc) {
  if (!desc) return ''
  return [desc.message, desc.summary, ...(desc.details || [])]
    .filter(Boolean).join(' | ').toLowerCase()
}

// True when the failure looks like the broker doesn't recognize the symbol
// we sent. The check requires "symbol" PLUS a not-found-ish word so we don't
// confuse it with clientId/comment validation errors (which also say "invalid").
function looksLikeSymbolError(desc) {
  const hay = _flatErr(desc)
  if (!hay) return false
  if (!hay.includes('symbol')) return false
  return (
    hay.includes('not found') ||
    hay.includes('unknown') ||
    hay.includes('does not exist') ||
    hay.includes('invalid') ||
    hay.includes('unsupported')
  )
}

// True when the MetaAPI validator rejected our clientId — typically a regex
// failure on the server side because of an unexpected char, length, or
// broker-specific restriction. We retry the same symbol without a clientId.
function looksLikeClientIdError(desc) {
  const hay = _flatErr(desc)
  if (!hay) return false
  return hay.includes('clientid') || (hay.includes('pattern') && hay.includes('match'))
}

/**
 * Establish RPC connection to MT5 via MetaAPI SDK. Idempotent — repeated
 * calls return the existing connection if it's still alive.
 *
 * Failure handling: if the connect attempt fails (e.g. MetaAPI 503, account
 * undeployed, network), we (1) close the half-built connection object so
 * the SDK doesn't enter its own 1.5-second reconnect loop, and (2) enforce
 * an exponential backoff before the next attempt. After 5 consecutive
 * failures the breaker opens and stays open until reset via reconnect()
 * (admin click on "Connect now" / POST /api/book/mt5/connect).
 *
 * @param {boolean} forceReset - bypass circuit breaker (used by admin reconnect)
 */
export async function connect(forceReset = false) {
  if (!PUSH_ENABLED) {
    log('Disabled (set MT5_PUSH_ENABLED=true to enable)')
    return null
  }
  if (!METAAPI_TOKEN || !METAAPI_ACCOUNT_ID) {
    warn('METAAPI_TOKEN or METAAPI_ACCOUNT_ID missing — push disabled until configured')
    return null
  }
  if (isConnected && connection) return connection
  if (isConnecting) {
    while (isConnecting) await new Promise(r => setTimeout(r, 200))
    return connection
  }

  if (forceReset) {
    circuitOpen = false
    consecutiveFailures = 0
    nextRetryAt = 0
  }

  if (circuitOpen) {
    throw new Error(`MT5 connect circuit-open after ${consecutiveFailures} failures. Last error: ${lastError}. Force reconnect via /api/book/mt5/connect.`)
  }
  if (Date.now() < nextRetryAt) {
    const waitSec = Math.ceil((nextRetryAt - Date.now()) / 1000)
    throw new Error(`MT5 connect throttled — next retry in ${waitSec}s. Last error: ${lastError}`)
  }

  isConnecting = true
  try {
    log(`Connecting to MetaAPI account ${METAAPI_ACCOUNT_ID}...`)
    const { default: MetaApi } = await import('metaapi.cloud-sdk/esm-node')
    api = new MetaApi(METAAPI_TOKEN, { application: 'bluestone' })
    account = await api.metatraderAccountApi.getAccount(METAAPI_ACCOUNT_ID)

    if (account.state !== 'DEPLOYED') {
      log(`Account state ${account.state}, deploying...`)
      await account.deploy()
    }
    await account.waitDeployed()

    connection = account.getRPCConnection()
    await connection.connect()
    log('Synchronizing terminal state (may take ~10s)...')
    await connection.waitSynchronized()

    const info = await connection.getAccountInformation()
    isConnected = true
    lastError = null
    consecutiveFailures = 0
    nextRetryAt = 0
    circuitOpen = false
    log(`✓ Connected: login=${info.login} broker=${info.broker} balance=${info.currency} ${info.balance}`)
    return connection
  } catch (err) {
    isConnected = false
    lastError = err.message
    consecutiveFailures++

    // Tear down the half-built connection so the MetaAPI SDK's internal
    // reconnect loop (which floods logs every ~1.5s) stops.
    if (connection) {
      try { await connection.close() } catch (_) {}
      connection = null
    }
    account = null
    api = null

    if (consecutiveFailures >= FAILURE_TRIP_THRESHOLD) {
      circuitOpen = true
      error(`Circuit OPEN after ${consecutiveFailures} failures — auto-retries paused. Use admin "Connect now" to reset. Last error: ${err.message}`)
    } else {
      const delay = Math.min(
        MIN_RETRY_DELAY_MS * Math.pow(2, consecutiveFailures - 1),
        MAX_RETRY_DELAY_MS
      )
      nextRetryAt = Date.now() + delay
      error(`Connect failed (${consecutiveFailures}/${FAILURE_TRIP_THRESHOLD}): ${err.message}. Next auto-retry in ${Math.round(delay/1000)}s.`)
    }

    throw err
  } finally {
    isConnecting = false
  }
}

async function ensureConnected() {
  if (isConnected && connection) return connection
  return await connect()
}

/**
 * Fetch (and cache) the list of symbols the broker actually has listed.
 * MetaAPI exposes this via connection.getSymbols(). We cache for 30 min so
 * every push doesn't pay the round-trip. On failure we return whatever we
 * have cached (possibly empty) so the caller can fall back to guess mode.
 */
async function getBrokerSymbols(conn, { force = false } = {}) {
  if (!force && brokerSymbolsCache && Date.now() - brokerSymbolsCacheAt < BROKER_SYMBOLS_TTL_MS) {
    return brokerSymbolsCache
  }
  try {
    const list = await conn.getSymbols()
    if (Array.isArray(list) && list.length > 0) {
      brokerSymbolsCache = list
      brokerSymbolsCacheAt = Date.now()
      log(`Loaded ${list.length} broker symbols (first 5: ${list.slice(0, 5).join(', ')})`)
    }
  } catch (err) {
    warn(`getSymbols() failed: ${err.message} — falling back to candidate guessing`)
  }
  return brokerSymbolsCache || []
}

/**
 * Pick the best broker symbol for a BlueStone canonical symbol, using the
 * cached broker symbol list. Strategy:
 *   1. Exact match against our candidate list (alias+suffix, canonical+suffix, USDT, ...).
 *   2. Fuzzy match: broker symbols starting with the canonical base (e.g.
 *      "XAU" for XAUUSD), preferring the shortest (least decorated) match.
 *   3. No match → return { mode: 'none' } so caller can fail with a clear
 *      "broker doesn't list this instrument" message instead of guessing.
 *
 * If the broker symbol list is unavailable we fall back to { mode: 'guess' }
 * — the legacy candidate-loop behaviour.
 */
function pickBrokerSymbol(canonical, brokerSymbols) {
  const candidates = getSymbolCandidates(canonical)

  if (!brokerSymbols || brokerSymbols.length === 0) {
    return { mode: 'guess', candidates }
  }

  const set = new Set(brokerSymbols)

  // 1. Exact match against our pre-built candidate order
  const matched = candidates.filter(c => set.has(c))
  if (matched.length > 0) {
    return { mode: 'matched', candidates: matched }
  }

  // 2. Fuzzy by base: strip trailing USD/USDT/T (so XAUUSD → XAU, ATOMUSDT → ATOM)
  const upper = canonical.toUpperCase()
  const base = upper.replace(/USDT?$/, '')
  const fuzzy = []
  if (base.length >= 3) {
    // Prefer prefix matches — broker symbols that START with the base.
    // Sort by length ascending so we try the simplest form first.
    const prefixMatches = brokerSymbols
      .filter(s => s.toUpperCase().startsWith(base))
      .sort((a, b) => a.length - b.length)
    fuzzy.push(...prefixMatches)
  }
  if (fuzzy.length > 0) {
    return { mode: 'fuzzy', candidates: fuzzy.slice(0, 5) }
  }

  // 3. Nothing resembling this symbol. Return a small sample for diagnostics.
  const prefix2 = base.slice(0, 2)
  const sample = prefix2.length === 2
    ? brokerSymbols.filter(s => s.toUpperCase().startsWith(prefix2)).slice(0, 10)
    : brokerSymbols.slice(0, 10)
  return { mode: 'none', candidates: [], sample }
}

/**
 * Push a BlueStone trade to MT5. Returns { success, mt5PositionId, mt5OrderId, mt5Symbol, error }.
 * Does NOT throw on push failure — caller persists FAILED state on the trade.
 *
 * Symbol fallback: getSymbolCandidates() returns an ordered list of broker
 * symbols to try (alias+suffix, alias, canonical+suffix, canonical). On a
 * symbol-shaped failure we fall through to the next candidate so a broker
 * naming SILVER as "XAGUSD" doesn't strand every XAGUSD trade. Non-symbol
 * failures (margin, market closed, lot size) abort immediately — retrying
 * with a different symbol won't help and could mask the real issue.
 */
export async function pushTrade(trade, user) {
  if (!isPushConfigured()) {
    return { success: false, error: 'MT5 push not configured' }
  }

  let conn
  try {
    conn = await ensureConnected()
  } catch (connErr) {
    return { success: false, error: `MT5 connect failed: ${connErr.message}` }
  }
  if (!conn) return { success: false, error: 'No MT5 connection' }

  const volume = Math.max(0.01, +(trade.quantity * VOLUME_MULTIPLIER).toFixed(2))
  const sl = trade.stopLoss || trade.sl || undefined
  const tp = trade.takeProfit || trade.tp || undefined

  // clientId is intentionally omitted. MetaAPI documents it as optional, and
  // its server-side regex varies per broker plugin (some reject anything but
  // [a-z0-9_], some reject digit-leading IDs, some reject all clientIds for
  // certain venues). We never *read* clientId back from MT5 either —
  // positionId is the source of truth for close/modify. So sending none is
  // both safer and zero-cost.
  //
  // Comment uses pure alphanumeric (no dash, no underscore) and is capped at
  // 24 chars to stay well under MetaAPI's combined "comment + clientId ≤ 26"
  // ceiling even if a future SDK upgrade re-introduces a default clientId.
  const rawId = (trade.tradeId || trade._id?.toString() || '').replace(/[^A-Za-z0-9]/g, '')
  const idTail = rawId.slice(-12) || 'unknown'
  const safeComment = `BS${idTail}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 20)

  const baseOptions = {
    comment: safeComment,
    slippage: DEFAULT_SLIPPAGE
  }

  // Pull the broker's actual symbol list (cached 30 min) and pick which
  // candidate(s) to try. When the broker list is available we only attempt
  // symbols that genuinely exist on the venue — no more burning round-trips
  // on guesses like "GOLD" when the broker only has "XAUUSD.r".
  const brokerSymbols = await getBrokerSymbols(conn)
  const pick = pickBrokerSymbol(trade.symbol, brokerSymbols)

  if (pick.mode === 'none') {
    const hint = pick.sample.length
      ? ` Broker has these similar listings: ${pick.sample.join(', ')}`
      : ''
    error(`Broker has no listing matching ${trade.symbol} — declining to guess.${hint}`)
    return {
      success: false,
      error: `Broker has no listing for ${trade.symbol}.${hint}`,
      symbolSent: null,
      brokerSample: pick.sample
    }
  }

  const candidates = pick.candidates
  if (candidates.length === 0) {
    return { success: false, error: `No MT5 symbol candidates for ${trade.symbol}` }
  }
  log(`Symbol pick mode=${pick.mode} for ${trade.symbol} → trying ${candidates.join(', ')}`)

  const isBuy = trade.side?.toUpperCase() === 'BUY'
  const attempts = []
  let lastDesc = null
  // Defense in depth: if MetaAPI somehow still complains about a clientId
  // (e.g. a broker plugin that auto-injects one), we strip comment too on
  // the next pass. This latches once tripped.
  let dropComment = false

  for (let i = 0; i < candidates.length; i++) {
    const mt5Symbol = candidates[i]
    const opts = dropComment ? { slippage: DEFAULT_SLIPPAGE } : baseOptions
    log(`PUSH ${trade.side} ${volume} ${mt5Symbol} (canonical ${trade.symbol}) attempt ${i + 1}/${candidates.length}${dropComment ? ' (no comment)' : ''}  tradeId=${trade.tradeId}`)

    try {
      const result = isBuy
        ? await conn.createMarketBuyOrder(mt5Symbol, volume, sl, tp, opts)
        : await conn.createMarketSellOrder(mt5Symbol, volume, sl, tp, opts)

      log(`✓ Pushed via ${mt5Symbol}: orderId=${result?.orderId} positionId=${result?.positionId} stringCode=${result?.stringCode}`)
      return {
        success: true,
        mt5PositionId: result?.positionId?.toString() || null,
        mt5OrderId: result?.orderId?.toString() || null,
        mt5Symbol,
        symbolAttempts: attempts.length > 0 ? [...attempts, { symbol: mt5Symbol, ok: true }] : undefined,
        raw: result
      }
    } catch (err) {
      const desc = describeError(err)
      lastDesc = desc
      attempts.push({ symbol: mt5Symbol, error: desc.summary, commentUsed: !dropComment })

      // ClientId/pattern rejection from the broker — strip comment too and
      // retry the SAME symbol once before moving on. We don't loop forever:
      // dropComment latches.
      if (!dropComment && looksLikeClientIdError(desc)) {
        warn(`Broker rejected clientId/pattern on ${mt5Symbol} — retrying with no comment either`)
        dropComment = true
        i--  // re-run same candidate index
        continue
      }

      if (!looksLikeSymbolError(desc) || i === candidates.length - 1) {
        // Either this is a non-symbol error (margin / market closed / lot size)
        // — retrying with a different name won't help — or we've exhausted
        // every candidate. Either way, stop here and report.
        error(`Push failed for ${trade.tradeId} (last symbol: ${mt5Symbol}): ${desc.summary}`)
        return {
          success: false,
          error: desc.summary,
          errorDetails: desc,
          symbolSent: mt5Symbol,
          symbolAttempts: attempts,
          commentDropped: dropComment
        }
      }
      warn(`Symbol "${mt5Symbol}" rejected (${desc.summary}); trying next candidate...`)
    }
  }

  // Defensive — loop should always return inside.
  return {
    success: false,
    error: lastDesc?.summary || 'All symbol candidates exhausted',
    errorDetails: lastDesc,
    symbolAttempts: attempts,
    commentDropped: dropComment
  }
}

/**
 * Close an MT5 position by the positionId we stored on the BlueStone trade.
 */
export async function closeTrade(trade) {
  if (!isPushConfigured()) {
    return { success: false, error: 'MT5 push not configured' }
  }
  if (!trade.mt5PositionId) {
    return { success: false, error: 'No mt5PositionId on trade — was it ever pushed?' }
  }

  try {
    const conn = await ensureConnected()
    if (!conn) return { success: false, error: 'No MT5 connection' }

    log(`CLOSE positionId=${trade.mt5PositionId}  tradeId=${trade.tradeId}`)
    const result = await conn.closePosition(trade.mt5PositionId, { slippage: DEFAULT_SLIPPAGE })
    log(`✓ Closed: stringCode=${result?.stringCode}`)
    return { success: true, raw: result }
  } catch (err) {
    const desc = describeError(err)
    error(`Close failed for ${trade.tradeId} (positionId=${trade.mt5PositionId}): ${desc.summary}`)
    return { success: false, error: desc.summary, errorDetails: desc }
  }
}

/**
 * Update SL/TP on an MT5 position.
 */
export async function updateTrade(trade) {
  if (!isPushConfigured()) return { success: false, error: 'MT5 push not configured' }
  if (!trade.mt5PositionId) return { success: false, error: 'No mt5PositionId on trade' }

  try {
    const conn = await ensureConnected()
    if (!conn) return { success: false, error: 'No MT5 connection' }

    const sl = trade.stopLoss || trade.sl || 0
    const tp = trade.takeProfit || trade.tp || 0
    log(`MODIFY positionId=${trade.mt5PositionId} sl=${sl} tp=${tp}`)
    const result = await conn.modifyPosition(trade.mt5PositionId, sl, tp)
    return { success: true, raw: result }
  } catch (err) {
    const desc = describeError(err)
    error(`Modify failed for ${trade.tradeId}: ${desc.summary}`)
    return { success: false, error: desc.summary, errorDetails: desc }
  }
}

/**
 * Snapshot current MT5 positions — used by the reconciliation endpoint and
 * the admin dashboard's verification button.
 */
export async function listPositions() {
  if (!isPushConfigured()) return { success: false, error: 'MT5 push not configured' }
  try {
    const conn = await ensureConnected()
    if (!conn) return { success: false, error: 'No MT5 connection' }
    const positions = await conn.getPositions()
    return { success: true, positions }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Health check / status snapshot — used by GET /api/book/lp-status to surface
 * MT5 reachability alongside Corecen.
 */
export function getStatus() {
  return {
    enabled: PUSH_ENABLED,
    configured: isPushConfigured(),
    connected: isConnected,
    accountId: METAAPI_ACCOUNT_ID ? METAAPI_ACCOUNT_ID.substring(0, 8) + '...' : null,
    lastError,
    symbolSuffix: SYMBOL_SUFFIX,
    volumeMultiplier: VOLUME_MULTIPLIER,
    circuitOpen,
    consecutiveFailures,
    nextRetryInSec: nextRetryAt > Date.now() ? Math.ceil((nextRetryAt - Date.now()) / 1000) : 0
  }
}

export async function disconnect() {
  try {
    if (connection) await connection.close()
  } catch (_) {}
  connection = null
  account = null
  isConnected = false
}

export default {
  isPushEnabled,
  isPushConfigured,
  isPushReady,
  connect,
  pushTrade,
  closeTrade,
  updateTrade,
  listPositions,
  getStatus,
  disconnect,
  mapSymbolToMt5,
  getSymbolCandidates
}
