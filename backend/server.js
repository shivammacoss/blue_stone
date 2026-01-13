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

dotenv.config()

const app = express()
const httpServer = createServer(app)

// Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
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
const METAAPI_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD']
const META_API_TOKEN = process.env.META_API_TOKEN || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJiYmRlZGVjYWJjMDAzOTczNTQ3ODk2Y2NlYjgyNzY2NSIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiXSwicmVzb3VyY2VzIjpbImFjY291bnQ6JFVTRVJfSUQkOjVmYTc1OGVjLWIyNDEtNGM5Ny04MWM0LTlkZTNhM2JjMWYwNCJdfV0sImlhdCI6MTc2ODIxODA3MSwiZXhwIjoxNzc1OTk0MDcxfQ.stub'
const META_API_ACCOUNT_ID = process.env.META_API_ACCOUNT_ID || '5fa758ec-b241-4c97-81c4-9de3a3bc1f04'

// Fetch MetaAPI price
async function fetchMetaApiPrice(symbol) {
  try {
    const response = await fetch(
      `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${META_API_ACCOUNT_ID}/symbols/${symbol}/current-price`,
      { headers: { 'auth-token': META_API_TOKEN, 'Content-Type': 'application/json' } }
    )
    if (!response.ok) return null
    const data = await response.json()
    return data.bid ? { bid: data.bid, ask: data.ask || data.bid, time: Date.now() } : null
  } catch (e) { return null }
}

// Background price streaming - runs every 500ms for Binance, every 2s for MetaAPI
let lastMetaApiRefresh = 0
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
  
  // MetaAPI - slower refresh (every 2 seconds to respect rate limits)
  if (now - lastMetaApiRefresh > 2000) {
    lastMetaApiRefresh = now
    // Fetch 2 symbols per cycle to spread load
    const symbolIndex = Math.floor((now / 2000) % METAAPI_SYMBOLS.length)
    const symbolsToFetch = [
      METAAPI_SYMBOLS[symbolIndex],
      METAAPI_SYMBOLS[(symbolIndex + 1) % METAAPI_SYMBOLS.length]
    ]
    
    for (const symbol of symbolsToFetch) {
      const price = await fetchMetaApiPrice(symbol)
      if (price) {
        priceCache.set(symbol, price)
        updatedPrices[symbol] = price
      }
    }
  }
  
  // Broadcast to all price subscribers
  if (Object.keys(updatedPrices).length > 0) {
    io.to('prices').emit('priceStream', {
      prices: Object.fromEntries(priceCache),
      updated: updatedPrices,
      timestamp: now
    })
  }
}

// Start price streaming interval
setInterval(streamPrices, 500)

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Subscribe to real-time price stream
  socket.on('subscribePrices', () => {
    socket.join('prices')
    priceSubscribers.add(socket.id)
    // Send current prices immediately
    socket.emit('priceStream', {
      prices: Object.fromEntries(priceCache),
      updated: {},
      timestamp: Date.now()
    })
    console.log(`Socket ${socket.id} subscribed to price stream`)
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
app.use(cors())
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'CoinLytix API is running' })
})

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
