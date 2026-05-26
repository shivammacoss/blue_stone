/**
 * LP Connection Monitor
 *
 * Heartbeat-checks Corecen LP every 30s via the HMAC-signed health endpoint.
 * Triggers a WebSocket reconnect with exponential backoff when consecutive
 * failures occur, and exposes a pre-flight `ensureLpHealthy()` for callers
 * that need to gate critical operations (e.g. opening an A-Book trade).
 */

import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config()

let isLpConnected = false
let lastHeartbeat = null
let lastHeartbeatSuccess = false
let consecutiveFailures = 0
let heartbeatInterval = null
let reconnectTimeout = null

const HEARTBEAT_INTERVAL_MS = 30 * 1000
const HEARTBEAT_TIMEOUT_MS = 10 * 1000
const MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT = 3
const RECONNECT_BASE_DELAY_MS = 5000
const RECONNECT_MAX_DELAY_MS = 60000

const getLpConfig = () => ({
  apiUrl: process.env.LP_API_URL || 'http://localhost:3001',
  apiKey: process.env.LP_API_KEY || '',
  apiSecret: process.env.LP_API_SECRET || ''
})

export const pingCorecen = async () => {
  const config = getLpConfig()
  if (!config.apiKey || !config.apiSecret) {
    return { success: false, error: 'LP credentials not configured' }
  }

  const timestamp = Date.now().toString()
  const path = '/api/v1/broker-api/health'

  try {
    const message = timestamp + 'GET' + path
    const signature = crypto.createHmac('sha256', config.apiSecret).update(message).digest('hex')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS)

    const response = await fetch(`${config.apiUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      return { success: true, latencyMs: Date.now() - parseInt(timestamp) }
    }
    const data = await response.json().catch(() => ({}))
    return { success: false, error: data.error?.message || `HTTP ${response.status}` }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout - LP not responding' }
    }
    return { success: false, error: error.message }
  }
}

const runHeartbeat = async () => {
  const result = await pingCorecen()
  lastHeartbeat = new Date()
  lastHeartbeatSuccess = result.success

  if (result.success) {
    if (!isLpConnected || consecutiveFailures > 0) {
      console.log(`[LP Monitor] ✓ Corecen LP connected (latency: ${result.latencyMs}ms)`)
    }
    isLpConnected = true
    consecutiveFailures = 0
  } else {
    consecutiveFailures++
    isLpConnected = false
    console.error(`[LP Monitor] ✗ Corecen LP DISCONNECTED - ${result.error} (failure #${consecutiveFailures})`)

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT) {
      console.error(`[LP Monitor] ⚠️ CRITICAL: LP has been down for ${consecutiveFailures} consecutive checks!`)
      console.error('[LP Monitor] ⚠️ A-Book trades will NOT sync to Corecen until connection is restored!')
    }

    triggerWebSocketReconnect()
  }

  return result
}

const triggerWebSocketReconnect = async () => {
  if (reconnectTimeout) return

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, Math.min(consecutiveFailures - 1, 5)),
    RECONNECT_MAX_DELAY_MS
  )

  console.log(`[LP Monitor] Scheduling WebSocket reconnect in ${delay / 1000}s...`)

  reconnectTimeout = setTimeout(async () => {
    reconnectTimeout = null
    try {
      const corecenSocket = await import('./corecenSocketClient.js')
      corecenSocket.default.reconnect()
      console.log('[LP Monitor] WebSocket reconnect triggered')
    } catch (error) {
      console.error('[LP Monitor] Failed to trigger WebSocket reconnect:', error.message)
    }
  }, delay)
}

export const startMonitor = () => {
  if (heartbeatInterval) {
    console.log('[LP Monitor] Already running')
    return
  }

  console.log('[LP Monitor] Starting LP connection monitor...')
  console.log(`[LP Monitor] Heartbeat interval: ${HEARTBEAT_INTERVAL_MS / 1000}s`)
  console.log(`[LP Monitor] LP URL: ${getLpConfig().apiUrl}`)

  runHeartbeat()
  heartbeatInterval = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS)
  console.log('[LP Monitor] ✓ Monitor started')
}

export const stopMonitor = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  console.log('[LP Monitor] Monitor stopped')
}

export const getStatus = () => ({
  connected: isLpConnected,
  lastHeartbeat: lastHeartbeat?.toISOString() || null,
  lastHeartbeatSuccess,
  consecutiveFailures,
  lpUrl: getLpConfig().apiUrl,
  configured: !!(getLpConfig().apiKey && getLpConfig().apiSecret)
})

export const ensureLpHealthy = async () => {
  if (isLpConnected && lastHeartbeat && (Date.now() - lastHeartbeat.getTime() < 60000)) {
    return true
  }
  const result = await pingCorecen()
  isLpConnected = result.success
  lastHeartbeat = new Date()
  lastHeartbeatSuccess = result.success
  if (!result.success) {
    console.error(`[LP Monitor] Pre-trade health check FAILED: ${result.error}`)
  }
  return result.success
}

export const forceHealthCheck = async () => {
  console.log('[LP Monitor] Running forced health check...')
  const result = await runHeartbeat()
  return { ...getStatus(), lastCheckResult: result }
}

export default {
  startMonitor,
  stopMonitor,
  getStatus,
  pingCorecen,
  ensureLpHealthy,
  forceHealthCheck
}
