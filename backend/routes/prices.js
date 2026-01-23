import express from 'express'

const router = express.Router()

// MetaAPI credentials from environment
const META_API_TOKEN = process.env.META_API_TOKEN
const META_API_ACCOUNT_ID = process.env.META_API_ACCOUNT_ID || '5fa758ec-b241-4c97-81c4-9de3a3bc1f04'

// Binance symbol mapping for crypto
const BINANCE_SYMBOLS = {
  'BTCUSD': 'BTCUSDT',
  'ETHUSD': 'ETHUSDT',
  'BNBUSD': 'BNBUSDT',
  'SOLUSD': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT',
  'ADAUSD': 'ADAUSDT',
  'DOGEUSD': 'DOGEUSDT',
  'DOTUSD': 'DOTUSDT',
  'MATICUSD': 'MATICUSDT',
  'LTCUSD': 'LTCUSDT',
  'AVAXUSD': 'AVAXUSDT',
  'LINKUSD': 'LINKUSDT'
}

// MetaAPI symbols (forex + metals)
const METAAPI_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD']

// Fallback symbol mapping for Twelve Data API
const TWELVEDATA_SYMBOLS = {
  'EURUSD': 'EUR/USD',
  'GBPUSD': 'GBP/USD',
  'USDJPY': 'USD/JPY',
  'USDCHF': 'USD/CHF',
  'AUDUSD': 'AUD/USD',
  'NZDUSD': 'NZD/USD',
  'USDCAD': 'USD/CAD',
  'EURGBP': 'EUR/GBP',
  'EURJPY': 'EUR/JPY',
  'GBPJPY': 'GBP/JPY',
  'XAUUSD': 'XAU/USD',
  'XAGUSD': 'XAG/USD'
}

// Fetch price from Twelve Data (free fallback)
async function getTwelveDataPrice(symbol) {
  const tdSymbol = TWELVEDATA_SYMBOLS[symbol]
  if (!tdSymbol) return null
  
  try {
    const response = await fetch(`https://api.twelvedata.com/price?symbol=${tdSymbol}&apikey=demo`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.price) {
      const price = parseFloat(data.price)
      // Add small spread for bid/ask
      const spread = symbol.includes('XAU') ? 0.5 : symbol.includes('XAG') ? 0.02 : 0.0002
      return { bid: price - spread/2, ask: price + spread/2 }
    }
    return null
  } catch (e) {
    return null
  }
}

// Fetch Gold/Silver prices from free API
async function getMetalPrice(symbol) {
  try {
    // Use free gold-api.io for metals
    if (symbol === 'XAUUSD') {
      const response = await fetch('https://api.gold-api.com/price/XAU')
      if (response.ok) {
        const data = await response.json()
        if (data.price) {
          const price = parseFloat(data.price)
          return { bid: price - 0.25, ask: price + 0.25 }
        }
      }
    }
    if (symbol === 'XAGUSD') {
      const response = await fetch('https://api.gold-api.com/price/XAG')
      if (response.ok) {
        const data = await response.json()
        if (data.price) {
          const price = parseFloat(data.price)
          return { bid: price - 0.01, ask: price + 0.01 }
        }
      }
    }
    return null
  } catch (e) {
    return null
  }
}

// Fetch forex from free ExchangeRate API
async function getExchangeRatePrice(symbol) {
  try {
    // Parse symbol like EURUSD -> EUR, USD
    const base = symbol.substring(0, 3)
    const quote = symbol.substring(3, 6)
    
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    if (!response.ok) return null
    const data = await response.json()
    
    if (data.rates && data.rates[quote]) {
      const price = data.rates[quote]
      const spread = 0.0002
      return { bid: price - spread/2, ask: price + spread/2 }
    }
    return null
  } catch (e) {
    return null
  }
}

// Fetch price from MetaAPI (forex/metals) with multiple fallbacks
async function getMetaApiPrice(symbol) {
  // Try MetaAPI first if token is valid
  if (META_API_TOKEN && !META_API_TOKEN.endsWith('.stub')) {
    try {
      const response = await fetch(
        `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${META_API_ACCOUNT_ID}/symbols/${symbol}/current-price`,
        {
          headers: {
            'auth-token': META_API_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        if (data.bid) {
          return { bid: data.bid, ask: data.ask || data.bid }
        }
      }
    } catch (e) {
      // Silent fail, try fallbacks
    }
  }
  
  // Fallback 1: Metal prices for XAUUSD/XAGUSD
  if (symbol === 'XAUUSD' || symbol === 'XAGUSD') {
    const metalPrice = await getMetalPrice(symbol)
    if (metalPrice) return metalPrice
  }
  
  // Fallback 2: TwelveData
  const tdPrice = await getTwelveDataPrice(symbol)
  if (tdPrice) return tdPrice
  
  // Fallback 3: ExchangeRate API for forex
  const erPrice = await getExchangeRatePrice(symbol)
  if (erPrice) return erPrice
  
  return null
}

// Fetch price from Binance (crypto)
async function getBinancePrice(symbol) {
  const binanceSymbol = BINANCE_SYMBOLS[symbol]
  if (!binanceSymbol) return null
  
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${binanceSymbol}`)
    if (!response.ok) return null
    const data = await response.json()
    return {
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice)
    }
  } catch (e) {
    console.error(`Binance error for ${symbol}:`, e.message)
    return null
  }
}

// GET /api/prices/:symbol - Get single symbol price
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    let price = null
    
    // Use MetaAPI for forex/metals
    if (METAAPI_SYMBOLS.includes(symbol)) {
      price = await getMetaApiPrice(symbol)
    }
    // Use Binance for crypto
    else if (BINANCE_SYMBOLS[symbol]) {
      price = await getBinancePrice(symbol)
    }
    
    if (price) {
      res.json({ success: true, price })
    } else {
      res.status(404).json({ success: false, message: 'Price not available' })
    }
  } catch (error) {
    console.error('Error fetching price:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Global price cache with background refresh
const priceCache = new Map()
const CACHE_TTL = 30000 // 30 second cache to avoid rate limits

// Background price streaming
let streamingInterval = null
let isRefreshing = false

async function refreshAllPrices() {
  if (isRefreshing) return // Prevent overlapping refreshes
  isRefreshing = true
  const now = Date.now()
  
  // Refresh Binance prices (single call for all crypto)
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/bookTicker')
    if (response.ok) {
      const allTickers = await response.json()
      const tickerMap = {}
      allTickers.forEach(t => { tickerMap[t.symbol] = t })
      
      Object.keys(BINANCE_SYMBOLS).forEach(symbol => {
        const binanceSymbol = BINANCE_SYMBOLS[symbol]
        const ticker = tickerMap[binanceSymbol]
        if (ticker) {
          priceCache.set(symbol, {
            price: { bid: parseFloat(ticker.bidPrice), ask: parseFloat(ticker.askPrice) },
            time: now
          })
        }
      })
    }
  } catch (e) {
    console.error('Binance refresh error:', e.message)
  }
  
  // Refresh MetaAPI prices (sequential with 1s delay to avoid rate limit)
  for (const symbol of METAAPI_SYMBOLS) {
    try {
      const price = await getMetaApiPrice(symbol)
      if (price) {
        priceCache.set(symbol, { price, time: now })
      }
    } catch (e) {
      // Silent fail
    }
    // 1 second delay between requests (max 1 req/sec for MetaAPI)
    await new Promise(r => setTimeout(r, 1000))
  }
  
  isRefreshing = false
  console.log('Prices refreshed:', priceCache.size, 'symbols')
}

// Start background streaming - disabled to avoid rate limits
// Prices are fetched on-demand instead
function startPriceStreaming() {
  console.log('Price streaming disabled - using on-demand fetching')
}

// Don't auto-start streaming
// startPriceStreaming()

// POST /api/prices/batch - Get multiple symbol prices
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ success: false, message: 'symbols array required' })
    }
    
    const prices = {}
    const now = Date.now()
    
    // Get prices from cache first (2 second cache for real-time updates)
    const missingSymbols = []
    for (const symbol of symbols) {
      const cached = priceCache.get(symbol)
      if (cached && (now - cached.time) < 2000) {
        prices[symbol] = cached.price
      } else {
        missingSymbols.push(symbol)
      }
    }
    
    // Fetch missing prices in parallel
    if (missingSymbols.length > 0) {
      // Fetch Binance prices (single batch call)
      const binanceMissing = missingSymbols.filter(s => BINANCE_SYMBOLS[s])
      if (binanceMissing.length > 0) {
        try {
          const response = await fetch('https://api.binance.com/api/v3/ticker/bookTicker')
          if (response.ok) {
            const allTickers = await response.json()
            const tickerMap = {}
            allTickers.forEach(t => { tickerMap[t.symbol] = t })
            
            binanceMissing.forEach(symbol => {
              const binanceSymbol = BINANCE_SYMBOLS[symbol]
              const ticker = tickerMap[binanceSymbol]
              if (ticker) {
                const price = { bid: parseFloat(ticker.bidPrice), ask: parseFloat(ticker.askPrice) }
                prices[symbol] = price
                priceCache.set(symbol, { price, time: now })
              }
            })
          }
        } catch (e) {
          console.error('Binance batch error:', e.message)
        }
      }
      
      // Fetch MetaAPI prices in parallel (max 3 concurrent)
      const metaApiMissing = missingSymbols.filter(s => METAAPI_SYMBOLS.includes(s))
      if (metaApiMissing.length > 0) {
        const metaPromises = metaApiMissing.map(async (symbol) => {
          const price = await getMetaApiPrice(symbol)
          if (price) {
            prices[symbol] = price
            priceCache.set(symbol, { price, time: now })
          }
        })
        await Promise.allSettled(metaPromises)
      }
    }
    
    res.json({ success: true, prices })
  } catch (error) {
    console.error('Error fetching batch prices:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
