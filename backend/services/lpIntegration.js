/**
 * LP Integration Service (Corecen)
 *
 * Primary REST channel for pushing A-Book trades to the Corecen LP platform.
 * Uses HMAC-SHA256 request signing. The accompanying corecenSocketClient.js
 * is the secondary real-time channel; this REST client is the authoritative
 * sync path that the trade engine and admin tools rely on.
 *
 * Required env vars:
 *   LP_API_URL     - Corecen backend base URL (e.g. http://localhost:3001)
 *   LP_API_KEY     - Broker API key issued by Corecen (e.g. lpk_xxx)
 *   LP_API_SECRET  - Broker API secret issued by Corecen
 *   LP_ENABLED     - 'true' to enable LP routing
 */

import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

// Mutable so admin UI can update at runtime via updateConfig()
let LP_API_URL = process.env.LP_API_URL || 'http://localhost:3001'
let LP_API_KEY = process.env.LP_API_KEY || ''
let LP_API_SECRET = process.env.LP_API_SECRET || ''
let LP_ENABLED = process.env.LP_ENABLED === 'true'

if (LP_API_KEY && LP_API_SECRET) {
  console.log(`[LPIntegration] ✓ Configured from .env - URL: ${LP_API_URL}, API Key: ${LP_API_KEY.substring(0, 10)}...`)
} else {
  console.warn('[LPIntegration] ✗ NOT CONFIGURED - Set LP_API_URL, LP_API_KEY, LP_API_SECRET in .env')
}

export const generateSignature = (method, path, body = '') => {
  const timestamp = Date.now().toString()
  const message = timestamp + method.toUpperCase() + path + body
  const signature = crypto
    .createHmac('sha256', LP_API_SECRET)
    .update(message)
    .digest('hex')
  return { timestamp, signature }
}

const makeRequest = async (method, path, data = null) => {
  if (!LP_API_KEY || !LP_API_SECRET) {
    console.warn('[LPIntegration] LP_API_KEY or LP_API_SECRET not configured, skipping LP sync')
    return { success: false, error: 'LP credentials not configured' }
  }

  const body = data ? JSON.stringify(data) : ''
  const { timestamp, signature } = generateSignature(method, path, body)
  const url = `${LP_API_URL}${path}`

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': LP_API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      body: method !== 'GET' ? body : undefined
    })

    const result = await response.json()

    if (!response.ok) {
      const errMsg = result.error?.message || result.message || `HTTP ${response.status}`
      console.error(`[LPIntegration] API Error: ${errMsg}`, JSON.stringify(result))
      return { success: false, error: errMsg }
    }

    return result
  } catch (error) {
    console.error(`[LPIntegration] Request failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * Push a new A-Book trade to LP. Called on trade open for A_BOOK users.
 */
export const pushTrade = async (trade, user) => {
  const payload = {
    external_trade_id: trade._id.toString(),
    user_id: trade.userId?.toString() || '',
    user_email: user?.email || '',
    user_name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    symbol: trade.symbol,
    side: trade.side?.toUpperCase() || 'BUY',
    volume: trade.quantity || 0,
    open_price: trade.openPrice || 0,
    sl: trade.stopLoss || trade.sl || 0,
    tp: trade.takeProfit || trade.tp || 0,
    margin: trade.marginUsed || 0,
    leverage: trade.leverage || 100,
    commission: trade.commission || 0,
    contract_size: trade.contractSize || 100000,
    trading_account_id: trade.tradingAccountId?.toString() || '',
    opened_at: trade.openedAt?.toISOString() || new Date().toISOString(),
    retroactive: true
  }

  console.log(`[LPIntegration] Pushing A-Book trade: ${trade.tradeId}`)
  const result = await makeRequest('POST', '/api/v1/broker-api/trades/push', payload)

  if (result.success) {
    console.log(`[LPIntegration] Trade pushed successfully: ${trade.tradeId}`)
  } else {
    console.error(`[LPIntegration] Failed to push trade: ${result.error}`)
  }

  return result
}

// Corecen's closed_by enum does not accept every closer the broker tracks
// (e.g. MT5 signal closes); map them down to values LP validates.
const CLOSED_BY_TO_LP = {
  MT5: 'ALGO'
}

export const closeTrade = async (trade) => {
  const rawClosedBy = trade.closedBy || 'USER'
  const closedBy = CLOSED_BY_TO_LP[rawClosedBy] || rawClosedBy

  const payload = {
    external_trade_id: trade._id.toString(),
    close_price: trade.closePrice || 0,
    pnl: trade.realizedPnl || 0,
    closed_by: closedBy,
    closed_at: trade.closedAt?.toISOString() || new Date().toISOString(),
    contract_size: trade.contractSize || 100000
  }

  console.log(`[LPIntegration] Closing A-Book trade: ${trade.tradeId} @ ${payload.close_price} (pnl ${payload.pnl})`)
  const result = await makeRequest('POST', '/api/v1/broker-api/trades/close', payload)

  if (result.success) {
    console.log(`[LPIntegration] ✓ Trade closed in LP: ${trade.tradeId}`)
  } else {
    console.error(`[LPIntegration] ✗ Failed to close trade in LP: ${trade.tradeId} — ${result.error}`)
  }

  return result
}

export const updateTrade = async (trade) => {
  const payload = {
    external_trade_id: trade._id.toString(),
    sl: trade.stopLoss || trade.sl || 0,
    tp: trade.takeProfit || trade.tp || 0,
    pnl: trade.floatingPnl || 0,
    contract_size: trade.contractSize || 100000
  }

  console.log(`[LPIntegration] Updating A-Book trade: ${trade.tradeId}`)
  const result = await makeRequest('POST', '/api/v1/broker-api/trades/update', payload)

  if (result.success) {
    console.log(`[LPIntegration] Trade updated in LP: ${trade.tradeId}`)
  } else {
    console.error(`[LPIntegration] Failed to update trade in LP: ${result.error}`)
  }

  return result
}

export const testConnection = async () => {
  if (!LP_API_KEY || !LP_API_SECRET) {
    console.warn('[LPIntegration] LP credentials not configured')
    return false
  }
  try {
    const result = await makeRequest('GET', '/api/v1/broker-api/trades/stats')
    return result.success === true
  } catch (error) {
    console.error(`[LPIntegration] Connection test failed: ${error.message}`)
    return false
  }
}

export const isConfigured = () => !!(LP_API_KEY && LP_API_SECRET)

export const isEnabled = () => LP_ENABLED && isConfigured()

export const getConfigStatus = () => ({
  configured: isConfigured(),
  enabled: LP_ENABLED,
  apiUrl: LP_API_URL,
  apiKeySet: !!LP_API_KEY,
  apiSecretSet: !!LP_API_SECRET
})

export const updateConfig = (config) => {
  if (config.apiUrl) LP_API_URL = config.apiUrl
  if (config.apiKey) LP_API_KEY = config.apiKey
  if (config.apiSecret) LP_API_SECRET = config.apiSecret
  if (config.enabled !== undefined) LP_ENABLED = !!config.enabled
  console.log(`[LPIntegration] Configuration updated - URL: ${LP_API_URL}, API Key: ${LP_API_KEY ? LP_API_KEY.substring(0, 10) + '...' : 'not set'}`)
}

export const removeABookUser = async (user) => {
  const payload = {
    external_user_id: user._id.toString(),
    user_email: user.email || '',
    source_platform: 'BLUESTONE',
    timestamp: new Date().toISOString()
  }

  console.log(`[LPIntegration] Removing A-Book user: ${user.email}`)
  const result = await makeRequest('POST', '/api/v1/broker-api/users/remove', payload)

  if (result.success) {
    console.log(`[LPIntegration] User removed from LP: ${user.email}`)
  } else {
    console.error(`[LPIntegration] Failed to remove user from LP: ${result.error}`)
  }

  return result
}

export const closeAllUserTrades = async (userId) => {
  try {
    const Trade = (await import('../models/Trade.js')).default
    const openTrades = await Trade.find({
      userId,
      status: 'OPEN',
      bookType: 'A_BOOK'
    })

    console.log(`[LPIntegration] Found ${openTrades.length} open A-Book trades for user ${userId}`)

    const results = []
    for (const trade of openTrades) {
      trade.status = 'CLOSED'
      trade.closedBy = 'ADMIN'
      trade.closedAt = new Date()
      trade.realizedPnl = 0
      const result = await closeTrade(trade)
      results.push({ tradeId: trade.tradeId, result })
      await trade.save()
    }

    const successCount = results.filter(r => r.result.success).length
    console.log(`[LPIntegration] Closed ${successCount}/${openTrades.length} trades in LP`)

    return { success: true, total: openTrades.length, closed: successCount, results }
  } catch (error) {
    console.error(`[LPIntegration] Error closing user trades: ${error.message}`)
    return { success: false, error: error.message }
  }
}

export default {
  generateSignature,
  pushTrade,
  closeTrade,
  updateTrade,
  testConnection,
  isConfigured,
  isEnabled,
  getConfigStatus,
  updateConfig,
  removeABookUser,
  closeAllUserTrades
}
