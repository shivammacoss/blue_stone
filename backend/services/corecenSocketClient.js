/**
 * Corecen Socket.IO Client (secondary channel)
 *
 * Real-time push to Corecen for A-Book activity. The REST channel in
 * lpIntegration.js is the authoritative sync; events here keep Corecen's
 * UI live and let it react instantly to assignment/trade changes.
 *
 * Events emitted to Corecen:
 *   abook:user:added | abook:user:removed
 *   abook:trade:opened | abook:trade:closed | abook:trade:updated
 */

import { io } from 'socket.io-client'
import dotenv from 'dotenv'

dotenv.config()

const getCorecenWsUrl = () =>
  process.env.CORECEN_WS_URL || process.env.LP_API_URL || 'http://localhost:3001'

const PLATFORM_KEY = process.env.CORECEN_PLATFORM_KEY || 'bluestone_secure_platform_key_2024'
const PLATFORM_NAME = process.env.CORECEN_PLATFORM_NAME || 'BLUESTONE'

let socket = null
let isConnected = false
let reconnectAttempts = 0
let currentWsUrl = null
const MAX_RECONNECT_ATTEMPTS = 10

export const initConnection = () => {
  const wsUrl = getCorecenWsUrl()

  if (socket && isConnected && currentWsUrl === wsUrl) {
    console.log('[CorecenSocket] Already connected')
    return socket
  }

  if (socket && currentWsUrl !== wsUrl) {
    console.log(`[CorecenSocket] URL changed from ${currentWsUrl} to ${wsUrl}, reconnecting...`)
    socket.disconnect()
    socket = null
    isConnected = false
  }

  currentWsUrl = wsUrl
  console.log(`[CorecenSocket] Connecting to Corecen at ${wsUrl}...`)

  socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    auth: { platform: PLATFORM_NAME, platformKey: PLATFORM_KEY },
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  })

  socket.on('connect', () => {
    isConnected = true
    reconnectAttempts = 0
    console.log(`[CorecenSocket] Connected to Corecen (ID: ${socket.id})`)
    socket.emit('platform:authenticate', { platform: PLATFORM_NAME, platformKey: PLATFORM_KEY })
  })

  socket.on('disconnect', (reason) => {
    isConnected = false
    console.log(`[CorecenSocket] Disconnected from Corecen: ${reason}`)
  })

  socket.on('connect_error', (error) => {
    reconnectAttempts++
    console.error(`[CorecenSocket] Connection error (attempt ${reconnectAttempts}): ${error.message}`)
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[CorecenSocket] Max reconnection attempts reached. Giving up.')
    }
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log(`[CorecenSocket] Reconnected after ${attemptNumber} attempts`)
  })

  socket.on('platform:authenticated', (data) => {
    console.log(`[CorecenSocket] Authenticated with Corecen: ${data?.message || 'ok'}`)
  })

  return socket
}

export const getSocket = () => {
  if (!socket) initConnection()
  return socket
}

export const isConnectedToCorecen = () => isConnected

const safeEmit = (event, payload) => {
  const s = getSocket()
  if (!s || !isConnected) {
    console.warn(`[CorecenSocket] Not connected, cannot emit ${event}`)
    return false
  }
  s.emit(event, payload)
  return true
}

export const emitUserAdded = (user) => {
  const ok = safeEmit('abook:user:added', {
    external_user_id: user._id.toString(),
    email: user.email || '',
    first_name: user.firstName || '',
    last_name: user.lastName || '',
    book_type: 'A_BOOK',
    source_platform: PLATFORM_NAME,
    timestamp: new Date().toISOString()
  })
  if (ok) console.log(`[CorecenSocket] Emitted abook:user:added for ${user.email}`)
  return ok
}

export const emitUserRemoved = (user) => {
  const ok = safeEmit('abook:user:removed', {
    external_user_id: user._id.toString(),
    email: user.email || '',
    source_platform: PLATFORM_NAME,
    timestamp: new Date().toISOString()
  })
  if (ok) console.log(`[CorecenSocket] Emitted abook:user:removed for ${user.email}`)
  return ok
}

export const emitTradeOpened = (trade, user) => {
  const ok = safeEmit('abook:trade:opened', {
    external_trade_id: trade._id.toString(),
    trade_id: trade.tradeId,
    user_id: trade.userId?.toString() || '',
    user_email: user?.email || '',
    user_name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    symbol: trade.symbol,
    side: trade.side?.toUpperCase() || 'BUY',
    volume: trade.quantity || 0,
    price: trade.openPrice || 0,
    sl: trade.stopLoss || trade.sl || 0,
    tp: trade.takeProfit || trade.tp || 0,
    commission: trade.commission || 0,
    margin: trade.marginUsed || 0,
    leverage: trade.leverage || 1,
    book_type: 'A_BOOK',
    source_platform: PLATFORM_NAME,
    trading_account_id: trade.tradingAccountId?.toString() || '',
    opened_at: trade.openedAt?.toISOString() || new Date().toISOString(),
    timestamp: new Date().toISOString()
  })
  if (ok) console.log(`[CorecenSocket] Emitted abook:trade:opened for ${trade.tradeId}`)
  return ok
}

export const emitTradeClosed = (trade) => {
  const ok = safeEmit('abook:trade:closed', {
    external_trade_id: trade._id.toString(),
    trade_id: trade.tradeId,
    close_price: trade.closePrice || 0,
    pnl: trade.realizedPnl || 0,
    closed_by: trade.closedBy || 'USER',
    source_platform: PLATFORM_NAME,
    closed_at: trade.closedAt?.toISOString() || new Date().toISOString(),
    timestamp: new Date().toISOString()
  })
  if (ok) console.log(`[CorecenSocket] Emitted abook:trade:closed for ${trade.tradeId}`)
  return ok
}

export const emitTradeUpdated = (trade) => {
  const ok = safeEmit('abook:trade:updated', {
    external_trade_id: trade._id.toString(),
    trade_id: trade.tradeId,
    sl: trade.stopLoss || trade.sl || 0,
    tp: trade.takeProfit || trade.tp || 0,
    pnl: trade.floatingPnl || 0,
    source_platform: PLATFORM_NAME,
    timestamp: new Date().toISOString()
  })
  if (ok) console.log(`[CorecenSocket] Emitted abook:trade:updated for ${trade.tradeId}`)
  return ok
}

export const disconnect = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    isConnected = false
    currentWsUrl = null
    console.log('[CorecenSocket] Disconnected from Corecen')
  }
}

export const reconnect = () => {
  console.log('[CorecenSocket] Reconnecting with new settings...')
  disconnect()
  return initConnection()
}

export default {
  initConnection,
  getSocket,
  isConnectedToCorecen,
  emitUserAdded,
  emitUserRemoved,
  emitTradeOpened,
  emitTradeClosed,
  emitTradeUpdated,
  disconnect,
  reconnect
}
