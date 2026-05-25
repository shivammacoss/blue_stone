// Infoway.io Price Service - Real-time market data via WebSocket
// Supports: Forex, Crypto, US Stocks, Metals, Energy
// Docs: https://docs.infoway.io/en-docs

import WebSocket from 'ws'
import dotenv from 'dotenv'

dotenv.config()

const INFOWAY_API_KEY = process.env.INFOWAY_API_KEY || ''
const API_BASE_URL = 'https://data.infoway.io'

// WebSocket endpoints for different asset classes
const WS_ENDPOINTS = {
  stock: `wss://data.infoway.io/ws?business=stock&apikey=${INFOWAY_API_KEY}`,
  crypto: `wss://data.infoway.io/ws?business=crypto&apikey=${INFOWAY_API_KEY}`,
  common: `wss://data.infoway.io/ws?business=common&apikey=${INFOWAY_API_KEY}` // Forex, Metals, Energy
}

// Protocol codes
const PROTOCOL = {
  SUBSCRIBE_TRADE: 10000,
  TRADE_RESPONSE: 10001,
  TRADE_PUSH: 10002,
  SUBSCRIBE_DEPTH: 10003,
  DEPTH_RESPONSE: 10004,
  DEPTH_PUSH: 10005,
  HEARTBEAT: 10010
}

// Price cache
const priceCache = new Map()

// Day-open cache: { symbol -> { price, dateKey } } where dateKey is UTC YYYY-MM-DD
// Used to compute 24h change% the same way TradingView/exchanges do:
// change = current - dayOpen, changePercent = (change / dayOpen) * 100
// Resets automatically when a new UTC day rolls over.
const dayOpenCache = new Map()

function getUtcDateKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10) // YYYY-MM-DD
}

// Callbacks
let onPriceUpdate = null
let onConnectionChange = null

// Connection state
let isConnected = false
const connections = {}
let heartbeatIntervals = {}

// Dynamic symbol lists (fetched from Infoway API)
let dynamicSymbols = {
  forex: [],
  crypto: [],
  stocks: [],
  metals: [],
  energy: [],
  indices: []
}

// Symbol name mappings (fetched from API)
const symbolNames = {}

// Fallback symbol lists (used if API fetch fails)
const FOREX_SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'AUDCAD',
  'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY', 'AUDNZD', 'CADCHF', 'GBPCHF',
  'GBPNZD', 'EURNZD', 'NZDCAD', 'NZDCHF', 'AUDCHF', 'GBPAUD', 'GBPCAD',
  'USDSGD', 'USDHKD', 'USDZAR', 'USDTRY', 'USDMXN', 'USDPLN', 'USDSEK',
  'USDNOK', 'USDDKK', 'USDCNH', 'EURPLN', 'EURSEK', 'EURNOK', 'EURDKK',
  'GBPSEK', 'GBPNOK', 'CHFSEK', 'SEKJPY', 'NOKJPY', 'SGDJPY', 'ZARJPY'
]

const CRYPTO_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
  'TRXUSDT', 'LINKUSDT', 'MATICUSDT', 'DOTUSDT', 'SHIBUSDT', 'LTCUSDT', 'BCHUSDT',
  'AVAXUSDT', 'XLMUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'ICPUSDT',
  'VETUSDT', 'NEARUSDT', 'GRTUSDT', 'AAVEUSDT', 'MKRUSDT', 'ALGOUSDT', 'FTMUSDT',
  'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'THETAUSDT', 'FLOWUSDT', 'SNXUSDT', 'EOSUSDT',
  'CHZUSDT', 'ENJUSDT', 'PEPEUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'APTUSDT',
  'INJUSDT', 'TONUSDT', 'HBARUSDT', 'NEOUSDT', 'FETUSDT', 'RNDRUSDT', 'WLDUSDT',
  'SEIUSDT', 'TIAUSDT', 'BLURUSDT', '1INCHUSDT', 'BONKUSDT', 'FLOKIUSDT', 'ORDIUSDT',
  'BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'TRXUSD',
  'LINKUSD', 'MATICUSD', 'DOTUSD', 'SHIBUSD', 'LTCUSD', 'BCHUSD', 'AVAXUSD',
  'XLMUSD', 'UNIUSD', 'ATOMUSD', 'ETCUSD', 'FILUSD', 'ICPUSD', 'VETUSD', 'NEARUSD'
]

const STOCK_SYMBOLS = [
  'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'NVDA.US', 'META.US', 'TSLA.US',
  'BRK-B.US', 'JPM.US', 'V.US', 'JNJ.US', 'WMT.US', 'PG.US', 'MA.US', 'UNH.US',
  'HD.US', 'DIS.US', 'BAC.US', 'ADBE.US', 'CRM.US', 'NFLX.US', 'CSCO.US',
  'PFE.US', 'TMO.US', 'ABT.US', 'COST.US', 'PEP.US', 'AVGO.US', 'NKE.US',
  'MRK.US', 'ABBV.US', 'KO.US', 'LLY.US', 'CVX.US', 'MCD.US', 'WFC.US',
  'DHR.US', 'ACN.US', 'NEE.US', 'TXN.US', 'PM.US', 'BMY.US', 'UPS.US',
  'QCOM.US', 'RTX.US', 'HON.US', 'INTC.US', 'AMD.US', 'PYPL.US', 'SBUX.US'
]

const METAL_SYMBOLS = [
  'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XAUEUR', 'XAUAUD', 'XAUGBP',
  'XAUCHF', 'XAUJPY', 'XAGEUR', 'XAGAUD', 'XAGGBP'
]

const ENERGY_SYMBOLS = [
  'USOIL', 'UKOIL', 'NGAS', 'BRENT', 'WTI', 'GASOLINE', 'HEATING'
]

const INDICES_SYMBOLS = [
  'US30', 'US500', 'NAS100', 'UK100', 'GER40', 'FRA40', 'JPN225', 'AUS200',
  'SPX500', 'DJ30', 'USTEC', 'USDX', 'VIX'
]

// Map internal symbols to Infoway format
let SYMBOL_MAP = {}

// Build ALL_SYMBOLS list (will be updated after API fetch)
let ALL_SYMBOLS = []

// Map crypto symbols: internal (BTCUSD) -> Infoway (BTCUSDT)
const CRYPTO_INTERNAL_TO_INFOWAY = {}
const CRYPTO_INFOWAY_TO_INTERNAL = {}

// Fetch symbols from Infoway API
async function fetchSymbolsFromAPI(type) {
  try {
    const url = `${API_BASE_URL}/common/basic/symbols?type=${type}&apikey=${INFOWAY_API_KEY}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (data.ret === 200 && data.data) {
      return data.data.map(item => ({
        symbol: item.symbol,
        name: item.name_en || item.symbol
      }))
    }
    return []
  } catch (e) {
    console.log(`[Infoway] Failed to fetch ${type} symbols:`, e.message)
    return []
  }
}

// Fetch all symbols from Infoway API
async function fetchAllSymbolsFromAPI() {
  console.log('[Infoway] Fetching symbols from API...')
  
  const [forex, crypto, stocks, metals, energy, indices] = await Promise.all([
    fetchSymbolsFromAPI('FOREX'),
    fetchSymbolsFromAPI('CRYPTO'),
    fetchSymbolsFromAPI('STOCK_US'),
    fetchSymbolsFromAPI('METAL'),
    fetchSymbolsFromAPI('ENERGY'),
    fetchSymbolsFromAPI('INDEX')
  ])
  
  // Update dynamic symbols
  dynamicSymbols.forex = forex.length > 0 ? forex.map(s => s.symbol) : FOREX_SYMBOLS
  dynamicSymbols.crypto = crypto.length > 0 ? crypto.map(s => s.symbol) : CRYPTO_SYMBOLS
  dynamicSymbols.stocks = stocks.length > 0 ? stocks.map(s => s.symbol) : STOCK_SYMBOLS
  dynamicSymbols.metals = metals.length > 0 ? metals.map(s => s.symbol) : METAL_SYMBOLS
  dynamicSymbols.energy = energy.length > 0 ? energy.map(s => s.symbol) : ENERGY_SYMBOLS
  dynamicSymbols.indices = indices.length > 0 ? indices.map(s => s.symbol) : INDICES_SYMBOLS
  
  // Store symbol names
  ;[...forex, ...crypto, ...stocks, ...metals, ...energy, ...indices].forEach(item => {
    symbolNames[item.symbol] = item.name
  })
  
  // Build crypto mappings
  dynamicSymbols.crypto.forEach(s => {
    if (s.endsWith('USDT')) {
      const internal = s.replace('USDT', 'USD')
      CRYPTO_INTERNAL_TO_INFOWAY[internal] = s
      CRYPTO_INFOWAY_TO_INTERNAL[s] = internal
    }
  })
  
  // Build ALL_SYMBOLS and SYMBOL_MAP
  const allSymbols = new Set()
  
  // Add forex symbols
  dynamicSymbols.forex.forEach(s => {
    allSymbols.add(s)
    SYMBOL_MAP[s] = s
  })
  
  // Add crypto symbols (convert USDT to USD for internal use)
  dynamicSymbols.crypto.forEach(s => {
    const internal = s.endsWith('USDT') ? s.replace('USDT', 'USD') : s
    allSymbols.add(internal)
    SYMBOL_MAP[internal] = s
  })
  
  // Add stock symbols (remove .US suffix for internal use)
  dynamicSymbols.stocks.forEach(s => {
    const internal = s.replace('.US', '')
    allSymbols.add(internal)
    SYMBOL_MAP[internal] = s
  })
  
  // Add metal symbols
  dynamicSymbols.metals.forEach(s => {
    allSymbols.add(s)
    SYMBOL_MAP[s] = s
  })
  
  // Add energy symbols
  dynamicSymbols.energy.forEach(s => {
    allSymbols.add(s)
    SYMBOL_MAP[s] = s
  })
  
  // Add indices symbols
  dynamicSymbols.indices.forEach(s => {
    allSymbols.add(s)
    SYMBOL_MAP[s] = s
  })
  
  ALL_SYMBOLS = Array.from(allSymbols)
  
  console.log(`[Infoway] Loaded symbols - Forex: ${dynamicSymbols.forex.length}, Crypto: ${dynamicSymbols.crypto.length}, Stocks: ${dynamicSymbols.stocks.length}, Metals: ${dynamicSymbols.metals.length}, Energy: ${dynamicSymbols.energy.length}, Indices: ${dynamicSymbols.indices.length}`)
  console.log(`[Infoway] Total symbols: ${ALL_SYMBOLS.length}`)
}

// Generate unique trace ID
function generateTraceId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Create WebSocket connection for a business type
function createConnection(businessType, endpoint, symbols) {
  if (!INFOWAY_API_KEY) {
    console.log(`[Infoway] Skipping ${businessType} - no API key`)
    return null
  }

  console.log(`[Infoway] Connecting to ${businessType}...`)
  
  const ws = new WebSocket(endpoint)
  
  ws.on('open', () => {
    console.log(`[Infoway] ${businessType} connected`)
    
    // Subscribe to depth data for bid/ask prices
    const subscribeMsg = {
      code: PROTOCOL.SUBSCRIBE_DEPTH,
      trace: generateTraceId(),
      data: {
        codes: symbols.join(',')
      }
    }
    
    ws.send(JSON.stringify(subscribeMsg))
    console.log(`[Infoway] Subscribed to ${symbols.length} ${businessType} symbols`)
    
    // Start heartbeat every 30 seconds
    heartbeatIntervals[businessType] = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          code: PROTOCOL.HEARTBEAT,
          trace: generateTraceId()
        }))
      }
    }, 30000)
  })

  ws.on('message', (data) => {
    try {
      const dataStr = data.toString()
      // Skip non-JSON messages (welcome messages, etc.)
      if (!dataStr.startsWith('{')) {
        return
      }
      const message = JSON.parse(dataStr)
      
      // Handle depth push (bid/ask data)
      if (message.code === PROTOCOL.DEPTH_PUSH && message.data) {
        const { s: symbol, a: asks, b: bids, t: timestamp } = message.data
        
        if (symbol && asks && bids) {
          // Get best ask (first price in ask array) and best bid (first price in bid array)
          const bestAsk = parseFloat(asks[0]?.[0]) || 0
          const bestBid = parseFloat(bids[0]?.[0]) || 0
          
          if (bestAsk > 0 && bestBid > 0) {
            // Convert symbol to internal format if needed
            let internalSymbol = symbol
            if (CRYPTO_INFOWAY_TO_INTERNAL[symbol]) {
              internalSymbol = CRYPTO_INFOWAY_TO_INTERNAL[symbol]
            }

            const mid = (bestBid + bestAsk) / 2
            const ts = timestamp || Date.now()
            const { change, changePercent, dayOpen } = trackDayOpenAndComputeChange(internalSymbol, mid, ts)

            const priceData = {
              bid: bestBid,
              ask: bestAsk,
              mid,
              dayOpen,
              change,
              changePercent,
              time: ts
            }

            priceCache.set(internalSymbol, priceData)

            if (onPriceUpdate) {
              onPriceUpdate(internalSymbol, priceData)
            }
          }
        }
      }
      
      // Handle trade push (for additional price data)
      if (message.code === PROTOCOL.TRADE_PUSH && message.data) {
        const { s: symbol, p: price, t: timestamp } = message.data
        
        if (symbol && price) {
          let internalSymbol = symbol
          if (CRYPTO_INFOWAY_TO_INTERNAL[symbol]) {
            internalSymbol = CRYPTO_INFOWAY_TO_INTERNAL[symbol]
          }
          
          // Only update if we don't have depth data
          if (!priceCache.has(internalSymbol)) {
            const priceValue = parseFloat(price)
            const ts = timestamp || Date.now()
            const { change, changePercent, dayOpen } = trackDayOpenAndComputeChange(internalSymbol, priceValue, ts)

            const priceData = {
              bid: priceValue,
              ask: priceValue,
              mid: priceValue,
              dayOpen,
              change,
              changePercent,
              time: ts
            }

            priceCache.set(internalSymbol, priceData)

            if (onPriceUpdate) {
              onPriceUpdate(internalSymbol, priceData)
            }
          }
        }
      }
      
      // Handle subscription responses
      if (message.code === PROTOCOL.DEPTH_RESPONSE || message.code === PROTOCOL.TRADE_RESPONSE) {
        if (message.msg === 'ok') {
          console.log(`[Infoway] ${businessType} subscription confirmed`)
        } else {
          console.log(`[Infoway] ${businessType} subscription response:`, message.msg)
        }
      }
      
    } catch (e) {
      console.error(`[Infoway] ${businessType} parse error:`, e.message)
    }
  })

  ws.on('error', (error) => {
    console.error(`[Infoway] ${businessType} error:`, error.message)
  })

  ws.on('close', (code, reason) => {
    console.log(`[Infoway] ${businessType} disconnected (${code}): ${reason}`)
    
    // Clear heartbeat
    if (heartbeatIntervals[businessType]) {
      clearInterval(heartbeatIntervals[businessType])
      delete heartbeatIntervals[businessType]
    }
    
    connections[businessType] = null
    
    // Check if all connections are down
    const anyConnected = Object.values(connections).some(conn => conn && conn.readyState === WebSocket.OPEN)
    if (!anyConnected && isConnected) {
      isConnected = false
      if (onConnectionChange) onConnectionChange(false)
    }
    
    // Reconnect after 5 seconds
    setTimeout(() => {
      if (!connections[businessType]) {
        console.log(`[Infoway] Reconnecting ${businessType}...`)
        connections[businessType] = createConnection(businessType, endpoint, symbols)
      }
    }, 5000)
  })

  return ws
}

// Connect to all Infoway WebSocket endpoints
async function connect() {
  if (!INFOWAY_API_KEY) {
    console.log('[Infoway] ERROR: Missing API key - set INFOWAY_API_KEY in .env')
    console.log('[Infoway] Get your API key from https://infoway.io')
    return
  }

  console.log('[Infoway] Premium API - Initializing connections...')
  console.log('[Infoway] Plan: 600 API calls/min, 2 WS connections, 600 subscriptions/WS')

  // Fetch all symbols from Infoway API first
  await fetchAllSymbolsFromAPI()

  try {
    // With 2 WS connections limit, we need to be strategic
    // Connection 1: common (Forex + Metals + Energy + Indices) - most important for trading
    // Connection 2: crypto - popular for trading
    // Note: Stocks will use REST API fallback if needed (3rd connection not available)
    
    const commonSymbols = [...dynamicSymbols.forex, ...dynamicSymbols.metals, ...dynamicSymbols.energy, ...dynamicSymbols.indices]

    // Connect to common (Forex + Metals + Energy + Indices)
    connections.common = createConnection('common', WS_ENDPOINTS.common, commonSymbols)

    // Crypto is served by coinbaseService (USD-priced from Coinbase Exchange)
    // instead of Infoway's USDT pairs from Binance — keeps quoted prices in
    // line with the USD exchanges shown on TradingView.
    console.log('[Infoway] Crypto WS skipped — coinbaseService owns crypto USD pairs')
    console.log(`[Infoway] Common (Forex+Metals+Energy+Indices): ${commonSymbols.length} symbols`)
    console.log(`[Infoway] Stocks: ${dynamicSymbols.stocks.length} symbols (REST API only)`)

    // Wait a bit then check connection status
    setTimeout(() => {
      const activeConns = Object.values(connections).filter(conn => conn && conn.readyState === WebSocket.OPEN)
      const total = Object.keys(connections).length
      console.log(`[Infoway] ${activeConns.length}/${total} WebSocket connections active`)

      if (activeConns.length > 0) {
        isConnected = true
        if (onConnectionChange) onConnectionChange(true)
        console.log('[Infoway] Connected successfully')
      } else {
        console.log('[Infoway] WARNING: No connections established - check API key')
      }
    }, 3000)

    // Log detailed price cache status after 10 seconds
    setTimeout(() => {
      const forexCount = dynamicSymbols.forex.filter(s => priceCache.has(s)).length
      const cryptoCount = dynamicSymbols.crypto.filter(s => {
        const internal = s.endsWith('USDT') ? s.replace('USDT', 'USD') : s
        return priceCache.has(internal) || priceCache.has(s)
      }).length
      const metalCount = dynamicSymbols.metals.filter(s => priceCache.has(s)).length
      const energyCount = dynamicSymbols.energy.filter(s => priceCache.has(s)).length
      
      console.log(`[Infoway] Price cache: ${priceCache.size} total symbols`)
      console.log(`[Infoway] Forex: ${forexCount}/${dynamicSymbols.forex.length}, Crypto: ${cryptoCount}/${dynamicSymbols.crypto.length}`)
      console.log(`[Infoway] Metals: ${metalCount}/${dynamicSymbols.metals.length}, Energy: ${energyCount}/${dynamicSymbols.energy.length}`)
    }, 10000)

  } catch (error) {
    console.error('[Infoway] Connection error:', error.message)
    isConnected = false
    setTimeout(connect, 30000)
  }
}

function disconnect() {
  // Clear all heartbeat intervals
  Object.keys(heartbeatIntervals).forEach(key => {
    clearInterval(heartbeatIntervals[key])
  })
  heartbeatIntervals = {}
  
  // Close all connections
  Object.entries(connections).forEach(([type, ws]) => {
    if (ws) {
      ws.close()
      connections[type] = null
    }
  })
  isConnected = false
  console.log('[Infoway] Disconnected all connections')
}

// Tracks the first price seen for a symbol on each UTC day and computes
// the 24h change relative to that open price. If a new UTC day has begun,
// the day-open is reset to the current price (so the first tick of the day
// shows 0% change, exactly like the open candle).
function trackDayOpenAndComputeChange(symbol, midPrice, ts) {
  if (!midPrice || midPrice <= 0) {
    return { change: 0, changePercent: 0, dayOpen: 0 }
  }
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

function getPrice(symbol) {
  return priceCache.get(symbol) || null
}

function getChange(symbol) {
  const p = priceCache.get(symbol)
  if (!p) return { change: 0, changePercent: 0, dayOpen: 0 }
  return {
    change: p.change || 0,
    changePercent: p.changePercent || 0,
    dayOpen: p.dayOpen || 0
  }
}

function getAllPrices() {
  return Object.fromEntries(priceCache)
}

function getPriceCache() {
  return priceCache
}

async function fetchPriceREST(symbol) {
  return priceCache.get(symbol) || null
}

async function fetchBatchPricesREST(symbols) {
  const prices = {}
  for (const symbol of symbols) {
    const cached = priceCache.get(symbol)
    if (cached) prices[symbol] = cached
  }
  return prices
}

function setOnPriceUpdate(callback) {
  onPriceUpdate = callback
}

function setOnConnectionChange(callback) {
  onConnectionChange = callback
}

function isWebSocketConnected() {
  return isConnected
}

function getConnectionStatus() {
  return {
    isConnected,
    connections: Object.entries(connections).map(([type, ws]) => ({
      type,
      connected: ws && ws.readyState === WebSocket.OPEN
    })),
    priceCount: priceCache.size
  }
}

// Categorize symbol for frontend
function categorizeSymbol(symbol) {
  // Check dynamic symbols first
  if (dynamicSymbols.forex.includes(symbol)) return 'Forex'
  if (dynamicSymbols.metals.includes(symbol)) return 'Metals'
  if (dynamicSymbols.energy.includes(symbol)) return 'Commodities' // Energy = Commodities in UI
  if (dynamicSymbols.indices.includes(symbol)) return 'Indices'
  if (dynamicSymbols.stocks.includes(symbol) || dynamicSymbols.stocks.includes(symbol + '.US')) return 'Stocks'
  
  // Check crypto (both USDT and USD versions)
  const cryptoInternal = symbol.endsWith('USD') ? symbol.replace('USD', 'USDT') : symbol
  if (dynamicSymbols.crypto.includes(symbol) || dynamicSymbols.crypto.includes(cryptoInternal)) return 'Crypto'
  
  // Fallback to static lists
  if (FOREX_SYMBOLS.includes(symbol)) return 'Forex'
  if (METAL_SYMBOLS.includes(symbol)) return 'Metals'
  if (ENERGY_SYMBOLS.includes(symbol)) return 'Commodities' // Energy = Commodities in UI
  if (INDICES_SYMBOLS.includes(symbol)) return 'Indices'
  if (STOCK_SYMBOLS.includes(symbol) || STOCK_SYMBOLS.includes(symbol + '.US')) return 'Stocks'
  if (CRYPTO_SYMBOLS.includes(symbol) || CRYPTO_SYMBOLS.includes(cryptoInternal)) return 'Crypto'
  
  return 'Other'
}

// Get symbol name from API data
function getSymbolName(symbol) {
  return symbolNames[symbol] || symbolNames[SYMBOL_MAP[symbol]] || symbol
}

// Get dynamic symbols for frontend
function getDynamicSymbols() {
  return dynamicSymbols
}

export default {
  connect,
  disconnect,
  getPrice,
  getChange,
  getAllPrices,
  getPriceCache,
  fetchPriceREST,
  fetchBatchPricesREST,
  setOnPriceUpdate,
  setOnConnectionChange,
  isWebSocketConnected,
  getConnectionStatus,
  categorizeSymbol,
  getSymbolName,
  getDynamicSymbols,
  get SYMBOL_MAP() { return SYMBOL_MAP },
  get ALL_SYMBOLS() { return ALL_SYMBOLS },
  FOREX_SYMBOLS,
  CRYPTO_SYMBOLS,
  STOCK_SYMBOLS,
  METAL_SYMBOLS,
  ENERGY_SYMBOLS,
  INDICES_SYMBOLS
}
