/**
 * LP Integration Routes
 *
 * Inbound webhook endpoints — Corecen LP pushes data TO BlueStone here:
 *   - Instrument catalog updates (logged, not mirrored into our Instrument
 *     table; BlueStone owns its own instrument metadata).
 *   - Real-time price ticks (cached in-memory for the admin A-Book dashboard
 *     and any internal consumer that wants LP-side bid/ask).
 *
 * Requests are authenticated with the same HMAC scheme used outbound, so
 * Corecen and BlueStone share LP_API_KEY / LP_API_SECRET.
 */

import express from 'express'
import crypto from 'crypto'

const router = express.Router()

const LP_API_KEY = process.env.LP_API_KEY || ''
const LP_API_SECRET = process.env.LP_API_SECRET || ''

// In-memory cache of last LP price per symbol. Used by the admin A-Book page
// for live floating-PnL on synced trades.
const lpPriceCache = new Map()

function validateLpRequest(req, res, next) {
  try {
    if (!LP_API_KEY || !LP_API_SECRET) {
      return res.status(503).json({ success: false, message: 'LP credentials not configured on broker' })
    }

    const apiKey = req.headers['x-api-key']
    const timestamp = req.headers['x-timestamp']
    const signature = req.headers['x-signature']

    if (!apiKey || !timestamp || !signature) {
      return res.status(401).json({ success: false, message: 'Missing authentication headers' })
    }

    if (apiKey !== LP_API_KEY) {
      return res.status(401).json({ success: false, message: 'Invalid API key' })
    }

    const now = Date.now()
    const requestTime = parseInt(timestamp, 10)
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({ success: false, message: 'Request expired' })
    }

    const body = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : ''
    const method = req.method.toUpperCase()
    const path = req.originalUrl
    const message = `${method}${path}${timestamp}${body}`
    const expectedSignature = crypto.createHmac('sha256', LP_API_SECRET).update(message).digest('hex')

    if (signature !== expectedSignature) {
      return res.status(401).json({ success: false, message: 'Invalid signature' })
    }

    next()
  } catch (error) {
    console.error('[LP Routes] Auth error:', error)
    res.status(500).json({ success: false, message: 'Authentication error' })
  }
}

// ─── INSTRUMENTS ────────────────────────────────────────────────────────────
// We acknowledge instrument pushes for protocol compatibility but do not
// mirror them into BlueStone's Instrument table — that catalog is managed
// internally.

router.post('/instruments/bulk', validateLpRequest, (req, res) => {
  const { instruments } = req.body || {}
  if (!Array.isArray(instruments)) {
    return res.status(400).json({ success: false, message: 'instruments array required' })
  }
  console.log(`[LP] Received ${instruments.length} instruments from Corecen (acknowledged, not mirrored)`)
  res.json({
    success: true,
    received: instruments.length,
    message: 'Acknowledged. BlueStone manages its own instrument catalog.'
  })
})

router.post('/instruments', validateLpRequest, (req, res) => {
  const { symbol } = req.body || {}
  if (!symbol) {
    return res.status(400).json({ success: false, message: 'symbol required' })
  }
  console.log(`[LP] Received instrument ${symbol} from Corecen (acknowledged)`)
  res.json({ success: true, symbol })
})

// ─── PRICES ─────────────────────────────────────────────────────────────────

router.post('/prices/batch', validateLpRequest, (req, res) => {
  try {
    const { ticks } = req.body || {}
    if (!Array.isArray(ticks)) {
      return res.status(400).json({ success: false, message: 'ticks array required' })
    }

    const now = Date.now()
    for (const tick of ticks) {
      lpPriceCache.set(tick.symbol, {
        bid: tick.bid,
        ask: tick.ask,
        spread: tick.spread !== undefined ? tick.spread : (tick.ask - tick.bid),
        timestamp: tick.timestamp || now,
        source: 'CORECEN_LP'
      })
    }

    // Fan out to any internal socket subscribers so admin pages get live ticks.
    if (global.io) {
      global.io.emit('lp:prices:update', { ticks, timestamp: now })
    }

    res.json({ success: true, received: ticks.length })
  } catch (error) {
    console.error('[LP] prices/batch error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/prices', validateLpRequest, (req, res) => {
  try {
    const { symbol, bid, ask, spread, timestamp } = req.body || {}
    if (!symbol || bid === undefined || ask === undefined) {
      return res.status(400).json({ success: false, message: 'symbol, bid, ask required' })
    }
    const now = Date.now()
    lpPriceCache.set(symbol, {
      bid,
      ask,
      spread: spread !== undefined ? spread : (ask - bid),
      timestamp: timestamp || now,
      source: 'CORECEN_LP'
    })
    res.json({ success: true, symbol })
  } catch (error) {
    console.error('[LP] prices error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Internal read endpoints (no HMAC — consumed by our own frontend).
router.get('/prices', (req, res) => {
  const prices = {}
  for (const [symbol, data] of lpPriceCache) prices[symbol] = data
  res.json({ success: true, prices, count: lpPriceCache.size })
})

router.get('/prices/:symbol', (req, res) => {
  const price = lpPriceCache.get(req.params.symbol)
  if (price) return res.json({ success: true, price })
  res.status(404).json({ success: false, message: 'Price not available' })
})

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', priceCount: lpPriceCache.size, timestamp: Date.now() })
})

export const getLpPrice = (symbol) => lpPriceCache.get(symbol)
export const getAllLpPrices = () => lpPriceCache

export default router
