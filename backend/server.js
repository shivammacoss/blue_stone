import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import compression from 'compression'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'
import WebSocket from 'ws'
import cron from 'node-cron'
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
import emailTemplatesRoutes from './routes/emailTemplates.js'
import bonusRoutes from './routes/bonus.js'
import bannerRoutes from './routes/banner.js'
import employeeRoutes from './routes/employee.js'
import employeeManagementRoutes from './routes/employeeManagement.js'
import oxapayRoutes from './routes/oxapay.js'
import bookManagementRoutes from './routes/bookManagement.js'
import lpIntegrationRoutes from './routes/lpIntegration.js'
import corecenSocketClient from './services/corecenSocketClient.js'
import lpConnectionMonitor from './services/lpConnectionMonitor.js'
import lpIntegration from './services/lpIntegration.js'
import mt5PushService from './services/mt5PushService.js'
import path from 'path'
import { fileURLToPath } from 'url'
import copyTradingEngine from './services/copyTradingEngine.js'
import tradeEngine from './services/tradeEngine.js'
import propTradingEngine from './services/propTradingEngine.js'
import infowayService from './services/infowayService.js'
import coinbaseService from './services/coinbaseService.js'
import EmailTemplate from './models/EmailTemplate.js'
import { seedEmailTemplates } from './routes/emailTemplates.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Price cache for real-time streaming (shared with Infoway service)
const priceCache = infowayService.getPriceCache()

// Price feeds:
//   - Infoway: Forex, Metals, Energy, Indices (and Stocks via REST)
//   - Coinbase: Crypto USD pairs (so quoted prices match TradingView's USD
//     exchanges rather than Binance's USDT pairs)
// Both feeds write to the same priceCache, so trade engines see one stream.

function broadcastPriceTick(symbol, price) {
  if (priceSubscribers.size === 0) return
  io.to('prices').emit('priceUpdate', { symbol, price })
  io.to('prices').emit('priceStream', {
    prices: { [symbol]: price },
    updated: { [symbol]: true },
    timestamp: Date.now()
  })
}

// Infoway WebSocket price update handler - emit tick-to-tick updates
infowayService.setOnPriceUpdate(broadcastPriceTick)

// Infoway connection status handler
infowayService.setOnConnectionChange((connected) => {
  console.log(`[Infoway] ${connected ? 'Connected' : 'Disconnected'}`)
})

// Start Infoway WebSocket connections
infowayService.connect()

// Coinbase: share the same priceCache + broadcast function
coinbaseService.init(
  priceCache,
  broadcastPriceTick,
  (connected) => console.log(`[Coinbase] ${connected ? 'Connected' : 'Disconnected'}`)
)
coinbaseService.connect()

// Background stop-out check every 5 seconds
setInterval(async () => {
  try {
    if (priceCache.size === 0) return
    
    const currentPrices = {}
    priceCache.forEach((data, symbol) => {
      currentPrices[symbol] = { bid: data.bid, ask: data.ask }
    })
    
    const result = await tradeEngine.checkAllAccountsStopOut(currentPrices)
    if (result.stopOuts && result.stopOuts.length > 0) {
      console.log(`[STOP-OUT] ${result.stopOuts.length} accounts stopped out`)
    }
  } catch (error) {}
}, 5000)

// Background SL/TP check every 1 second
setInterval(async () => {
  try {
    if (priceCache.size === 0) return
    
    const currentPrices = {}
    priceCache.forEach((data, symbol) => {
      currentPrices[symbol] = { bid: data.bid, ask: data.ask }
    })
    
    const closedRegularTrades = await tradeEngine.checkSlTpForAllTrades(currentPrices)
    const closedChallengeTrades = await propTradingEngine.checkSlTpForAllTrades(currentPrices)
    
    const allClosed = [...closedRegularTrades, ...closedChallengeTrades]
    if (allClosed.length > 0) {
      console.log(`[SL/TP AUTO] ${allClosed.length} trades closed by SL/TP`)
      allClosed.forEach(ct => {
        console.log(`[SL/TP AUTO] ${ct.trade?.symbol || 'Unknown'} closed by ${ct.trigger || ct.reason} - PnL: ${ct.pnl?.toFixed(2) || 0}`)
      })
    }
  } catch (error) {}
}, 1000)

// Background pending order check every 1 second
setInterval(async () => {
  try {
    if (priceCache.size === 0) return
    
    const currentPrices = {}
    priceCache.forEach((data, symbol) => {
      currentPrices[symbol] = { bid: data.bid, ask: data.ask }
    })
    
    const executedTrades = await tradeEngine.checkPendingOrders(currentPrices)
    if (executedTrades.length > 0) {
      console.log(`[PENDING] ${executedTrades.length} pending orders executed`)
      executedTrades.forEach(et => {
        console.log(`[PENDING] ${et.trade.orderType} ${et.trade.symbol} executed at ${et.executionPrice}`)
      })
    }
  } catch (error) {}
}, 1000)

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('subscribePrices', () => {
    socket.join('prices')
    priceSubscribers.add(socket.id)
    socket.emit('priceStream', {
      prices: Object.fromEntries(priceCache),
      updated: {},
      timestamp: Date.now()
    })
    console.log(`Socket ${socket.id} subscribed to price stream`)
  })

  socket.on('unsubscribePrices', () => {
    socket.leave('prices')
    priceSubscribers.delete(socket.id)
  })

  socket.on('subscribe', (data) => {
    const { tradingAccountId } = data
    if (tradingAccountId) {
      socket.join(`account:${tradingAccountId}`)
      connectedClients.set(socket.id, tradingAccountId)
      console.log(`Socket ${socket.id} subscribed to account ${tradingAccountId}`)
    }
  })

  socket.on('unsubscribe', (data) => {
    const { tradingAccountId } = data
    if (tradingAccountId) {
      socket.leave(`account:${tradingAccountId}`)
      connectedClients.delete(socket.id)
    }
  })

  socket.on('priceUpdate', async (data) => {
    const { tradingAccountId, prices } = data
    if (tradingAccountId && prices) {
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

// Make io accessible to routes (app-scoped) and to LP routes (global, mirrors
// concordex so LP price webhooks can fan out without ref-passing).
app.set('io', io)
global.io = io

// Middleware
app.use(compression())
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB')
    // Auto-seed/sync email templates on startup
    await seedEmailTemplates()
  })
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
app.use('/api/email-templates', emailTemplatesRoutes)
app.use('/api/bonus', bonusRoutes)
app.use('/api/banners', bannerRoutes)
app.use('/api/employee', employeeRoutes)
app.use('/api/employee-mgmt', employeeManagementRoutes)
app.use('/api/oxapay', oxapayRoutes)
app.use('/api/book', bookManagementRoutes)
app.use('/api/lp', lpIntegrationRoutes)

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Serve APK download
app.get('/downloads/BlueStone.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'apk', 'BlueStone.apk')
  res.download(apkPath, 'BlueStone.apk', (err) => {
    if (err) {
      console.error('APK download error:', err)
      res.status(404).json({ error: 'APK not found' })
    }
  })
})

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'BlueStone API is running' })
})

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  // MT5 direct-push (primary A-Book venue when configured). Pre-warm the
  // SDK so the first trade doesn't pay the ~10s sync cost. The connect()
  // call has its own circuit breaker + backoff — on failure we just log
  // once and let admins force a reconnect via /api/book/mt5/connect rather
  // than letting the SDK enter an internal 1.5s reconnect spam loop.
  if (mt5PushService.isPushConfigured()) {
    mt5PushService.connect()
      .then(() => console.log('[LP] MT5 push connection ready'))
      .catch(err => {
        console.error('[LP] MT5 push initial connect failed:', err.message)
        console.error('[LP] Push will retry on next trade or via POST /api/book/mt5/connect')
      })
  } else {
    console.log('[LP] MT5 push disabled (set MT5_PUSH_ENABLED=true + METAAPI_TOKEN + METAAPI_ACCOUNT_ID to enable)')
  }

  // Corecen LP (fallback venue / secondary path). Only start if credentials are
  // configured — avoids noisy reconnect loops in unconfigured dev environments.
  if (lpIntegration.isConfigured()) {
    try {
      corecenSocketClient.initConnection()
      lpConnectionMonitor.startMonitor()
      console.log('[LP] Corecen LP integration started')
    } catch (lpErr) {
      console.error('[LP] Failed to start Corecen LP:', lpErr.message)
    }
  } else {
    console.log('[LP] Corecen LP not configured — skipping (set LP_API_URL/LP_API_KEY/LP_API_SECRET to enable)')
  }
  
  // Schedule daily commission calculation for copy trading
  cron.schedule('59 23 * * *', async () => {
    console.log('[CRON] Running daily copy trade commission calculation...')
    try {
      const results = await copyTradingEngine.calculateDailyCommission()
      console.log(`[CRON] Daily commission calculated: ${results.length} commission records processed`)
    } catch (error) {
      console.error('[CRON] Error calculating daily commission:', error)
    }
  }, {
    timezone: 'UTC'
  })
  console.log('[CRON] Daily commission calculation scheduled for 23:59 UTC')
  
  // Schedule daily swap application for all open trades
  cron.schedule('0 22 * * *', async () => {
    console.log('[CRON] Applying daily swap to all open trades...')
    try {
      await tradeEngine.applySwap()
      console.log('[CRON] Swap applied successfully')
    } catch (error) {
      console.error('[CRON] Error applying swap:', error)
    }
  }, {
    timezone: 'UTC'
  })
  console.log('[CRON] Daily swap application scheduled for 22:00 UTC')
})
