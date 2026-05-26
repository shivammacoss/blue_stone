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
  BTCUSD: 'BITCOIN',
  ETHUSD: 'ETHEREUM'
}

let api = null
let account = null
let connection = null
let isConnected = false
let isConnecting = false
let lastError = null

const log = (...args) => console.log('[MT5 Push]', ...args)
const warn = (...args) => console.warn('[MT5 Push]', ...args)
const error = (...args) => console.error('[MT5 Push]', ...args)

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
 * Establish RPC connection to MT5 via MetaAPI SDK. Idempotent — repeated
 * calls return the existing connection if it's still alive.
 */
export async function connect() {
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
    // Wait for the in-flight connect attempt to finish rather than starting another.
    while (isConnecting) await new Promise(r => setTimeout(r, 200))
    return connection
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
    log(`✓ Connected: login=${info.login} broker=${info.broker} balance=${info.currency} ${info.balance}`)
    return connection
  } catch (err) {
    isConnected = false
    lastError = err.message
    error(`Connect failed: ${err.message}`)
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
 * Push a BlueStone trade to MT5. Returns { success, mt5PositionId, mt5OrderId, mt5Symbol, error }.
 * Does NOT throw on push failure — caller persists FAILED state on the trade.
 */
export async function pushTrade(trade, user) {
  if (!isPushConfigured()) {
    return { success: false, error: 'MT5 push not configured' }
  }

  try {
    const conn = await ensureConnected()
    if (!conn) return { success: false, error: 'No MT5 connection' }

    const mt5Symbol = mapSymbolToMt5(trade.symbol)
    const volume = Math.max(0.01, +(trade.quantity * VOLUME_MULTIPLIER).toFixed(2))
    const sl = trade.stopLoss || trade.sl || undefined
    const tp = trade.takeProfit || trade.tp || undefined

    // MetaAPI clientId requires a strict alphanumeric/dash pattern and some
    // brokers (e.g. MEXAtlantic) further reject 24-char hex MongoDB ObjectIds.
    // Use the human tradeId ("T1234567890") which is short, starts with a
    // letter, and is unique. Fall back to the last 12 chars of _id if missing.
    const safeClientId = (trade.tradeId || trade._id?.toString().slice(-12) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 31)
    const options = {
      comment: `BS-${trade.tradeId || trade._id?.toString().slice(-8)}`,
      clientId: safeClientId,
      slippage: DEFAULT_SLIPPAGE
    }

    log(`PUSH ${trade.side} ${volume} ${mt5Symbol} (canonical ${trade.symbol})  tradeId=${trade.tradeId}`)

    let result
    if (trade.side?.toUpperCase() === 'BUY') {
      result = await conn.createMarketBuyOrder(mt5Symbol, volume, sl, tp, options)
    } else {
      result = await conn.createMarketSellOrder(mt5Symbol, volume, sl, tp, options)
    }

    // MetaAPI response shape: { numericCode, stringCode, message, orderId, positionId, ... }
    log(`✓ Pushed: orderId=${result?.orderId} positionId=${result?.positionId} stringCode=${result?.stringCode}`)

    return {
      success: true,
      mt5PositionId: result?.positionId?.toString() || null,
      mt5OrderId: result?.orderId?.toString() || null,
      mt5Symbol,
      raw: result
    }
  } catch (err) {
    const desc = describeError(err)
    error(`Push failed for ${trade.tradeId} (symbol sent: ${mapSymbolToMt5(trade.symbol)}): ${desc.summary}`)
    return {
      success: false,
      error: desc.summary,
      errorDetails: desc,
      symbolSent: mapSymbolToMt5(trade.symbol)
    }
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
    volumeMultiplier: VOLUME_MULTIPLIER
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
  mapSymbolToMt5
}
