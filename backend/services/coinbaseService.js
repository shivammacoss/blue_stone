// Coinbase Exchange Public WebSocket - Real-time crypto USD prices
// Free, no API key. Used for crypto pairs so quoted prices match the
// USD-priced exchanges (Coinbase/Bitstamp) shown on TradingView,
// instead of Binance's USDT pairs delivered by Infoway.
// Docs: https://docs.cloud.coinbase.com/exchange/docs/websocket-overview

import WebSocket from 'ws'

const WS_URL = 'wss://ws-feed.exchange.coinbase.com'

// Coinbase product_id -> internal symbol (BTC-USD -> BTCUSD)
// Order here also determines subscription priority.
const PAIRS = [
  ['BTC-USD',  'BTCUSD'],
  ['ETH-USD',  'ETHUSD'],
  ['SOL-USD',  'SOLUSD'],
  ['XRP-USD',  'XRPUSD'],
  ['ADA-USD',  'ADAUSD'],
  ['DOGE-USD', 'DOGEUSD'],
  ['DOT-USD',  'DOTUSD'],
  ['MATIC-USD','MATICUSD'],
  ['LTC-USD',  'LTCUSD'],
  ['AVAX-USD', 'AVAXUSD'],
  ['LINK-USD', 'LINKUSD'],
  ['SHIB-USD', 'SHIBUSD'],
  ['UNI-USD',  'UNIUSD'],
  ['ATOM-USD', 'ATOMUSD'],
  ['BCH-USD',  'BCHUSD'],
  ['XLM-USD',  'XLMUSD'],
  ['ETC-USD',  'ETCUSD'],
  ['FIL-USD',  'FILUSD'],
  ['ICP-USD',  'ICPUSD'],
  ['NEAR-USD', 'NEARUSD'],
  ['AAVE-USD', 'AAVEUSD'],
  ['MKR-USD',  'MKRUSD'],
  ['ALGO-USD', 'ALGOUSD'],
  ['MANA-USD', 'MANAUSD'],
  ['AXS-USD',  'AXSUSD'],
  ['SNX-USD',  'SNXUSD'],
  ['EOS-USD',  'EOSUSD'],
  ['CHZ-USD',  'CHZUSD'],
  ['ENJ-USD',  'ENJUSD'],
  ['PEPE-USD', 'PEPEUSD'],
  ['ARB-USD',  'ARBUSD'],
  ['OP-USD',   'OPUSD'],
  ['SUI-USD',  'SUIUSD'],
  ['APT-USD',  'APTUSD'],
  ['INJ-USD',  'INJUSD'],
  ['HBAR-USD', 'HBARUSD'],
  ['FET-USD',  'FETUSD'],
  ['RNDR-USD', 'RNDRUSD'],
  ['SEI-USD',  'SEIUSD'],
  ['TIA-USD',  'TIAUSD'],
  ['1INCH-USD','1INCHUSD'],
  ['GRT-USD',  'GRTUSD'],
  ['SAND-USD', 'SANDUSD'],
  ['FLOW-USD', 'FLOWUSD']
]

const PRODUCT_TO_SYMBOL = Object.fromEntries(PAIRS.map(([p, s]) => [p, s]))
const PRODUCT_IDS = PAIRS.map(([p]) => p)
// Internal symbols this service owns — used by infowayService to skip these.
export const MANAGED_SYMBOLS = new Set(PAIRS.map(([, s]) => s))

let ws = null
let isConnected = false
let priceCache = null
let onPriceUpdate = null
let onConnectionChange = null
let reconnectTimer = null

// Day-open tracking for 24h change% (mirrors infowayService logic so the API
// shape stays identical no matter which feed wrote the entry).
const dayOpenCache = new Map()
function getUtcDateKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10)
}
function trackDayOpenAndComputeChange(symbol, midPrice, ts) {
  if (!midPrice || midPrice <= 0) return { change: 0, changePercent: 0, dayOpen: 0 }
  const todayKey = getUtcDateKey(ts)
  let entry = dayOpenCache.get(symbol)
  if (!entry || entry.dateKey !== todayKey) {
    entry = { price: midPrice, dateKey: todayKey }
    dayOpenCache.set(symbol, entry)
  }
  const dayOpen = entry.price
  const change = midPrice - dayOpen
  const changePercent = dayOpen > 0 ? (change / dayOpen) * 100 : 0
  return { change, changePercent, dayOpen }
}

function connect() {
  if (!priceCache) {
    console.log('[Coinbase] init() must be called before connect()')
    return
  }
  if (ws && ws.readyState === WebSocket.OPEN) return

  console.log('[Coinbase] Connecting to', WS_URL)
  ws = new WebSocket(WS_URL)

  ws.on('open', () => {
    console.log('[Coinbase] Connected, subscribing to', PRODUCT_IDS.length, 'pairs')
    ws.send(JSON.stringify({
      type: 'subscribe',
      product_ids: PRODUCT_IDS,
      channels: ['ticker']
    }))
    isConnected = true
    if (onConnectionChange) onConnectionChange(true)
  })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.type === 'ticker' && msg.product_id) {
      const symbol = PRODUCT_TO_SYMBOL[msg.product_id]
      if (!symbol) return
      const bid = parseFloat(msg.best_bid)
      const ask = parseFloat(msg.best_ask)
      if (!(bid > 0) || !(ask > 0)) return

      const mid = (bid + ask) / 2
      const ts = msg.time ? Date.parse(msg.time) : Date.now()
      const { change, changePercent, dayOpen } = trackDayOpenAndComputeChange(symbol, mid, ts)

      const priceData = { bid, ask, mid, dayOpen, change, changePercent, time: ts }
      priceCache.set(symbol, priceData)
      if (onPriceUpdate) onPriceUpdate(symbol, priceData)
    } else if (msg.type === 'subscriptions') {
      const tickerSubs = msg.channels?.find(c => c.name === 'ticker')
      console.log('[Coinbase] Subscription confirmed:', tickerSubs?.product_ids?.length || 0, 'pairs')
    } else if (msg.type === 'error') {
      console.error('[Coinbase] Server error:', msg.message)
    }
  })

  ws.on('close', (code, reason) => {
    console.log(`[Coinbase] Disconnected (${code}): ${reason}`)
    isConnected = false
    if (onConnectionChange) onConnectionChange(false)
    ws = null
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, 5000)
    }
  })

  ws.on('error', (err) => {
    console.error('[Coinbase] WebSocket error:', err.message)
  })
}

function init(sharedPriceCache, priceUpdateCallback, connectionCallback) {
  priceCache = sharedPriceCache
  onPriceUpdate = priceUpdateCallback
  onConnectionChange = connectionCallback
}

function isWsConnected() {
  return isConnected
}

export default {
  init,
  connect,
  isWsConnected,
  MANAGED_SYMBOLS
}
