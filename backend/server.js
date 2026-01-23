import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import accountTypesRoutes from './routes/accountTypes.js'
import tradingAccountsRoutes from './routes/tradingAccounts.js'
import walletRoutes from './routes/wallet.js'
import paymentMethodsRoutes from './routes/paymentMethods.js'
import tradeRoutes from './routes/trade.js'
import walletTransferRoutes from './routes/walletTransfer.js'
import adminTradeRoutes from './routes/adminTrade.js'
import copyTradingRoutes from './routes/copyTrading.js'
import ibRoutes from './routes/ibNew.js'
import propTradingRoutes from './routes/propTrading.js'
import chargesRoutes from './routes/charges.js'
import pricesRoutes from './routes/prices.js'
import earningsRoutes from './routes/earnings.js'
import supportRoutes from './routes/support.js'
import kycRoutes from './routes/kyc.js'
import themeRoutes from './routes/theme.js'
import adminManagementRoutes from './routes/adminManagement.js'
import uploadRoutes from './routes/upload.js'
import newsRoutes from './routes/news.js'
import notificationsRoutes from './routes/notifications.js'
import bookManagementRoutes from './routes/bookManagement.js'
import referralRoutes from './routes/referralRoutes.js'
import superAdminRoutes from './routes/superAdmin.js'
import emailRoutes from './routes/email.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const httpServer = createServer(app)

// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const TRADE_URL = process.env.TRADE_URL || 'http://localhost:5173'
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5173'
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [FRONTEND_URL, TRADE_URL, ADMIN_URL, 'https://BlueStone.com', 'https://www.BlueStone.com', 'https://trade.BlueStone.com', 'https://admin.BlueStone.com', 'https://api.BlueStone.com'] 
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']

// Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Store connected clients
const connectedClients = new Map()
const priceSubscribers = new Set()

// Price cache for real-time streaming
const priceCache = new Map()
const BINANCE_SYMBOLS = {
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'BNBUSD': 'BNBUSDT',
  'SOLUSD': 'SOLUSDT', 'XRPUSD': 'XRPUSDT', 'ADAUSD': 'ADAUSDT',
  'DOGEUSD': 'DOGEUSDT', 'DOTUSD': 'DOTUSDT', 'LTCUSD': 'LTCUSDT'
}
// Priority order - XAUUSD first as it's most traded
const METAAPI_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'XAGUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY']
const META_API_TOKEN = process.env.META_API_TOKEN || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJiYmRlZGVjYWJjMDAzOTczNTQ3ODk2Y2NlYjgyNzY2NSIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiXSwicmVzb3VyY2VzIjpbImFjY291bnQ6JFVTRVJfSUQkOjVmYTc1OGVjLWIyNDEtNGM5Ny04MWM0LTlkZTNhM2JjMWYwNCJdfV0sImlhdCI6MTc2ODIxODA3MSwiZXhwIjoxNzc1OTk0MDcxfQ.stub'
const META_API_ACCOUNT_ID = process.env.META_API_ACCOUNT_ID || '5fa758ec-b241-4c97-81c4-9de3a3bc1f04'

// Fallback symbol mapping for Twelve Data API
const TWELVEDATA_SYMBOLS = {
  'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY', 'USDCHF': 'USD/CHF',
  'AUDUSD': 'AUD/USD', 'NZDUSD': 'NZD/USD', 'USDCAD': 'USD/CAD', 'EURGBP': 'EUR/GBP',
  'EURJPY': 'EUR/JPY', 'GBPJPY': 'GBP/JPY', 'XAUUSD': 'XAU/USD', 'XAGUSD': 'XAG/USD'
}

// Fetch price from Twelve Data (free fallback)
async function fetchTwelveDataPrice(symbol) {
  const tdSymbol = TWELVEDATA_SYMBOLS[symbol]
  if (!tdSymbol) return null
  try {
    const response = await fetch(`https://api.twelvedata.com/price?symbol=${tdSymbol}&apikey=demo`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.price) {
      const price = parseFloat(data.price)
      const spread = symbol.includes('XAU') ? 0.5 : symbol.includes('XAG') ? 0.02 : 0.0002
      return { bid: price - spread/2, ask: price + spread/2, time: Date.now() }
    }
    return null
  } catch (e) { return null }
}

// Fetch MetaAPI price with fallback
async function fetchMetaApiPrice(symbol) {
  try {
    const response = await fetch(
      `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${META_API_ACCOUNT_ID}/symbols/${symbol}/current-price`,
      { headers: { 'auth-token': META_API_TOKEN, 'Content-Type': 'application/json' } }
    )
    if (!response.ok) return await fetchTwelveDataPrice(symbol)
    const data = await response.json()
    if (data.error) return await fetchTwelveDataPrice(symbol)
    return data.bid ? { bid: data.bid, ask: data.ask || data.bid, time: Date.now() } : await fetchTwelveDataPrice(symbol)
  } catch (e) { return await fetchTwelveDataPrice(symbol) }
}

// Background price streaming - runs every 500ms for Binance, every 3s for MetaAPI
let lastMetaApiRefresh = 0
let metaApiIndex = 0
async function streamPrices() {
  if (priceSubscribers.size === 0) return
  
  const now = Date.now()
  const updatedPrices = {}
  
  // Binance - fast refresh (every call)
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/bookTicker')
    if (response.ok) {
      const tickers = await response.json()
      const tickerMap = {}
      tickers.forEach(t => { tickerMap[t.symbol] = t })
      
      Object.keys(BINANCE_SYMBOLS).forEach(symbol => {
        const ticker = tickerMap[BINANCE_SYMBOLS[symbol]]
        if (ticker) {
          const price = { bid: parseFloat(ticker.bidPrice), ask: parseFloat(ticker.askPrice), time: now }
          priceCache.set(symbol, price)
          updatedPrices[symbol] = price
        }
      })
    }
  } catch (e) {}
  
  // MetaAPI - fetch 3 symbols every 3 seconds (rate limit friendly)
  if (now - lastMetaApiRefresh > 3000) {
    lastMetaApiRefresh = now
    
    // Always fetch XAUUSD (index 0) plus 2 rotating symbols
    const symbolsToFetch = ['XAUUSD']
    const otherSymbols = METAAPI_SYMBOLS.slice(1) // All except XAUUSD
    symbolsToFetch.push(otherSymbols[metaApiIndex % otherSymbols.length])
    symbolsToFetch.push(otherSymbols[(metaApiIndex + 1) % otherSymbols.length])
    metaApiIndex = (metaApiIndex + 2) % otherSymbols.length
    
    // Fetch in parallel for speed
    const results = await Promise.allSettled(
      symbolsToFetch.map(symbol => fetchMetaApiPrice(symbol))
    )
    
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        priceCache.set(symbolsToFetch[i], result.value)
        updatedPrices[symbolsToFetch[i]] = result.value
      }
    })
  }
  
  // Always broadcast full cache so clients have all prices
  io.to('prices').emit('priceStream', {
    prices: Object.fromEntries(priceCache),
    updated: updatedPrices,
    timestamp: now
  })
}

// Start price streaming interval
setInterval(streamPrices, 500)

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Subscribe to real-time price stream
  socket.on('subscribePrices', async () => {
    socket.join('prices')
    priceSubscribers.add(socket.id)
    
    // If cache is empty, fetch prices immediately
    if (priceCache.size === 0) {
      console.log('Price cache empty, fetching initial prices...')
      // Fetch Binance prices first (fast)
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/bookTicker')
        if (response.ok) {
          const tickers = await response.json()
          const tickerMap = {}
          tickers.forEach(t => { tickerMap[t.symbol] = t })
          Object.keys(BINANCE_SYMBOLS).forEach(symbol => {
            const ticker = tickerMap[BINANCE_SYMBOLS[symbol]]
            if (ticker) {
              priceCache.set(symbol, { bid: parseFloat(ticker.bidPrice), ask: parseFloat(ticker.askPrice), time: Date.now() })
            }
          })
        }
      } catch (e) { console.error('Initial Binance fetch error:', e.message) }
      
      // Fetch a few forex prices
      const forexToFetch = ['XAUUSD', 'EURUSD', 'GBPUSD']
      await Promise.allSettled(forexToFetch.map(async (symbol) => {
        const price = await fetchMetaApiPrice(symbol)
        if (price) priceCache.set(symbol, price)
      }))
    }
    
    // Send current prices immediately
    socket.emit('priceStream', {
      prices: Object.fromEntries(priceCache),
      updated: {},
      timestamp: Date.now()
    })
    console.log(`Socket ${socket.id} subscribed to price stream, cache size: ${priceCache.size}`)
  })

  // Unsubscribe from price stream
  socket.on('unsubscribePrices', () => {
    socket.leave('prices')
    priceSubscribers.delete(socket.id)
  })

  // Subscribe to account updates
  socket.on('subscribe', (data) => {
    const { tradingAccountId } = data
    if (tradingAccountId) {
      socket.join(`account:${tradingAccountId}`)
      connectedClients.set(socket.id, tradingAccountId)
      console.log(`Socket ${socket.id} subscribed to account ${tradingAccountId}`)
    }
  })

  // Unsubscribe from account updates
  socket.on('unsubscribe', (data) => {
    const { tradingAccountId } = data
    if (tradingAccountId) {
      socket.leave(`account:${tradingAccountId}`)
      connectedClients.delete(socket.id)
    }
  })

  // Handle price updates from client (for PnL calculation)
  socket.on('priceUpdate', async (data) => {
    const { tradingAccountId, prices } = data
    if (tradingAccountId && prices) {
      // Broadcast updated account summary to all subscribers
      io.to(`account:${tradingAccountId}`).emit('accountUpdate', {
        tradingAccountId,
        prices,
        timestamp: Date.now()
      })
    }
  })

  socket.on('disconnect', () => {
    connectedClients.delete(socket.id)
    priceSubscribers.delete(socket.id)
    console.log('Client disconnected:', socket.id)
  })
})

// Make io accessible to routes
app.set('io', io)

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true)
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/account-types', accountTypesRoutes)
app.use('/api/trading-accounts', tradingAccountsRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/payment-methods', paymentMethodsRoutes)
app.use('/api/trade', tradeRoutes)
app.use('/api/wallet-transfer', walletTransferRoutes)
app.use('/api/admin/trade', adminTradeRoutes)
app.use('/api/copy', copyTradingRoutes)
app.use('/api/ib', ibRoutes)
app.use('/api/prop', propTradingRoutes)
app.use('/api/charges', chargesRoutes)
app.use('/api/prices', pricesRoutes)
app.use('/api/earnings', earningsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/theme', themeRoutes)
app.use('/api/admin-mgmt', adminManagementRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/book-management', bookManagementRoutes)
app.use('/api/referral', referralRoutes)
app.use('/api/super-admin', superAdminRoutes)
app.use('/api/email', emailRoutes)

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'BlueStone API is running', version: '1.0.0' })
})

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
