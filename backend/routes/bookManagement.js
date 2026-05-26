import express from 'express'
import crypto from 'crypto'
import BookAssignment from '../models/BookAssignment.js'
import BookSettings from '../models/BookSettings.js'
import User from '../models/User.js'
import TradingAccount from '../models/TradingAccount.js'
import Trade from '../models/Trade.js'
import lpService from '../services/lpService.js'
import lpIntegration from '../services/lpIntegration.js'
import corecenSocketClient from '../services/corecenSocketClient.js'
import lpConnectionMonitor from '../services/lpConnectionMonitor.js'
import mt5PushService from '../services/mt5PushService.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Helper: read current LP settings (env-backed; can be overridden at runtime
// via PUT /api/book/lp-settings).
const getLpSettings = () => ({
  lpApiKey: process.env.LP_API_KEY || '',
  lpApiSecret: process.env.LP_API_SECRET || '',
  lpApiUrl: process.env.LP_API_URL || 'http://localhost:3001',
  corecenWsUrl: process.env.CORECEN_WS_URL || process.env.LP_API_URL || 'http://localhost:3001',
  enabled: process.env.LP_ENABLED === 'true'
})

// Helper: when a user is moved B → A, push every existing OPEN trade to the
// active venue (MT5 if configured, Corecen otherwise) so the LP/MT5 starts
// from the same picture the user has. Delegates to lpService.routeTrade so
// routing rules stay in one place — including symbol mapping, mt5PositionId
// capture, sync state, and socket emit. Returns counts + per-trade errors.
async function syncOpenTradesToLp(user) {
  // Include trades with ANY bookType (B_BOOK / null / even A_BOOK from a prior
  // stint that wasn't synced). What matters is they're OPEN and not yet on LP.
  const openTrades = await Trade.find({
    userId: user._id,
    status: 'OPEN'
  })

  if (openTrades.length === 0) {
    console.log(`[Book Management] ${user.email}: no open trades to sync`)
    return { synced: 0, failed: 0, total: 0, errors: [] }
  }

  console.log(`[Book Management] ${user.email}: syncing ${openTrades.length} open trade(s) to LP/MT5...`)

  let synced = 0
  let failed = 0
  const errors = []

  for (const trade of openTrades) {
    try {
      // Skip if already synced (e.g., trade already on MT5 from previous run).
      if (trade.lpSyncStatus === 'SYNCED' && trade.mt5PositionId) {
        console.log(`[Book Management] ⊙ Trade ${trade.tradeId} already on MT5 (positionId=${trade.mt5PositionId}), skipping`)
        synced++
        continue
      }

      // routeTrade mutates trade with bookType, lpSyncStatus, mt5PositionId,
      // mt5Symbol, lpOrderId, etc. We persist after.
      const result = await lpService.routeTrade(trade, user._id, trade.tradingAccountId)
      await trade.save()

      if (trade.lpSyncStatus === 'SYNCED') {
        synced++
        const venue = result.venue || (trade.mt5PositionId ? 'MT5' : 'LP')
        const id = trade.mt5PositionId || trade.lpOrderId || '-'
        console.log(`[Book Management] ✓ Trade ${trade.tradeId} (${trade.symbol} ${trade.side} ${trade.quantity}) → ${venue} positionId=${id}`)
      } else {
        failed++
        const errMsg = trade.lpSyncError || result.message || 'Unknown error'
        errors.push({ tradeId: trade.tradeId, symbol: trade.symbol, error: errMsg })
        console.error(`[Book Management] ✗ Trade ${trade.tradeId} (${trade.symbol}) FAILED: ${errMsg}`)
      }
    } catch (err) {
      failed++
      errors.push({ tradeId: trade.tradeId, symbol: trade.symbol, error: err.message })
      console.error(`[Book Management] ✗ Trade ${trade.tradeId} threw: ${err.message}`)
    }
  }

  console.log(`[Book Management] ${user.email}: done — ${synced}/${openTrades.length} synced, ${failed} failed`)
  return { synced, failed, total: openTrades.length, errors }
}

// Helper: when a user is moved A → B, close all their open A-Book hedges on
// whichever venue holds them (MT5 or Corecen). lpService.closeOnLP picks the
// right one based on the trade's mt5PositionId / lpSyncStatus.
async function closeOpenTradesOnLp(user) {
  const openTrades = await Trade.find({
    userId: user._id,
    bookType: 'A_BOOK',
    status: 'OPEN',
    lpSyncStatus: 'SYNCED'
  })

  if (openTrades.length === 0) {
    console.log(`[Book Management] ${user.email}: no synced A-Book trades to close on LP`)
    return { closed: 0, failed: 0, total: 0 }
  }

  console.log(`[Book Management] ${user.email}: closing ${openTrades.length} A-Book hedge(s) on LP/MT5...`)

  let closed = 0
  let failed = 0
  for (const trade of openTrades) {
    try {
      // Stage close data on the trade for the LP/MT5 close request. LP/MT5
      // recomputes its own P/L; we don't mark the local trade as CLOSED
      // (user's trade continues — only the hedge is unwound).
      trade.closePrice = trade.currentPrice || trade.openPrice
      trade.closedAt = new Date()
      trade.closedBy = 'ADMIN'
      trade.realizedPnl = 0

      const result = await lpService.closeOnLP(trade)
      // Reset the staged close fields so the local trade still looks OPEN.
      trade.closePrice = null
      trade.closedAt = null
      trade.closedBy = null
      trade.realizedPnl = null
      // Mark as B going forward so future routing skips LP.
      trade.bookType = 'B_BOOK'
      await trade.save()

      if (result.success) {
        closed++
        console.log(`[Book Management] ✓ Trade ${trade.tradeId} hedge closed on ${result.venue || 'LP'}`)
      } else {
        failed++
        console.error(`[Book Management] ✗ Trade ${trade.tradeId} close failed: ${result.message}`)
      }
    } catch (err) {
      console.error(`[Book Management] Error closing trade ${trade.tradeId} on LP:`, err.message)
      failed++
    }
  }
  console.log(`[Book Management] ${user.email}: done — closed ${closed}/${openTrades.length} hedges (${failed} failed)`)
  return { closed, failed, total: openTrades.length }
}

// ==================== DASHBOARD STATS ====================

// GET /api/book/dashboard - Get A-Book/B-Book dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const aBookCount = await BookAssignment.countDocuments({ bookType: 'A_BOOK', isActive: true })
    const bBookCount = await BookAssignment.countDocuments({ bookType: 'B_BOOK', isActive: true })
    
    // Get total users without assignment (default B-Book).
    // The User schema has no `role` field — all User docs are traders, so we
    // count everyone (admins live in a separate Admin collection).
    const assignedUserIds = await BookAssignment.distinct('userId', { isActive: true })
    const totalUsers = await User.countDocuments({})
    const unassignedCount = totalUsers - assignedUserIds.length
    
    // Calculate exposure
    const aBookAssignments = await BookAssignment.find({ bookType: 'A_BOOK', isActive: true })
    const bBookAssignments = await BookAssignment.find({ bookType: 'B_BOOK', isActive: true })
    
    let aBookExposure = 0
    let bBookExposure = 0
    
    // Get open trades for A-Book users
    for (const assignment of aBookAssignments) {
      const trades = await Trade.find({ 
        userId: assignment.userId, 
        status: 'OPEN' 
      })
      for (const trade of trades) {
        aBookExposure += Math.abs(trade.quantity * trade.contractSize * trade.openPrice)
      }
    }
    
    // Get open trades for B-Book users (including unassigned)
    const bBookUserIds = bBookAssignments.map(a => a.userId)
    const allBBookUserIds = [...bBookUserIds]
    
    // Add unassigned users to B-Book
    const allUsers = await User.find({}).select('_id')
    for (const user of allUsers) {
      if (!assignedUserIds.includes(user._id.toString())) {
        allBBookUserIds.push(user._id)
      }
    }
    
    for (const userId of allBBookUserIds) {
      const trades = await Trade.find({ 
        userId: userId, 
        status: 'OPEN' 
      })
      for (const trade of trades) {
        bBookExposure += Math.abs(trade.quantity * trade.contractSize * trade.openPrice)
      }
    }
    
    const settings = await BookSettings.getSettings()
    
    res.json({
      success: true,
      stats: {
        aBookUsers: aBookCount,
        bBookUsers: bBookCount + unassignedCount,
        unassignedUsers: unassignedCount,
        aBookExposure: Math.round(aBookExposure * 100) / 100,
        bBookExposure: Math.round(bBookExposure * 100) / 100,
        totalExposure: Math.round((aBookExposure + bBookExposure) * 100) / 100,
        aBookPercentage: totalUsers > 0 ? Math.round((aBookCount / totalUsers) * 100) : 0
      },
      settings
    })
  } catch (error) {
    console.error('Error fetching book dashboard:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== USER ASSIGNMENTS ====================

// GET /api/book/users - Get all users with their book assignments
router.get('/users', async (req, res) => {
  try {
    const { bookType, search, page = 1, limit = 50 } = req.query
    
    // Get all users (no role filter — User collection only contains traders).
    let userQuery = {}
    if (search) {
      userQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }
    
    const users = await User.find(userQuery)
      .select('firstName lastName email createdAt isBlocked isActive status')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
    
    // Get assignments for these users
    const userIds = users.map(u => u._id)
    const assignments = await BookAssignment.find({ 
      userId: { $in: userIds }, 
      isActive: true 
    }).populate('assignedBy', 'name email')
    
    // Get trading accounts for these users
    const accounts = await TradingAccount.find({ userId: { $in: userIds } })
      .select('userId accountNumber balance equity')
    
    // Get trade stats for these users
    const tradeStats = await Trade.aggregate([
      { $match: { userId: { $in: userIds }, status: 'CLOSED' } },
      { $group: {
        _id: '$userId',
        totalTrades: { $sum: 1 },
        totalVolume: { $sum: '$quantity' },
        totalPnl: { $sum: '$pnl' },
        wins: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } }
      }}
    ])
    
    // Combine data
    const usersWithBook = users.map(user => {
      const assignment = assignments.find(a => a.userId.toString() === user._id.toString())
      const userAccounts = accounts.filter(a => a.userId.toString() === user._id.toString())
      const stats = tradeStats.find(s => s._id.toString() === user._id.toString())
      
      // Status — user is "Active" unless explicitly blocked/inactive.
      const isActive = user.isBlocked ? false
        : (user.isActive === false ? false
        : (user.status && user.status !== 'active' && user.status !== 'Active' ? false : true))

      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
        status: isActive ? 'Active' : 'Inactive',
        bookType: assignment?.bookType || 'B_BOOK',
        bookChangedAt: assignment?.createdAt || null,
        assignedBy: assignment?.assignedBy || null,
        assignedAt: assignment?.createdAt || null,
        reason: assignment?.reason || '',
        accounts: userAccounts,
        totalBalance: userAccounts.reduce((sum, a) => sum + (a.balance || 0), 0),
        stats: stats ? {
          totalTrades: stats.totalTrades,
          totalVolume: stats.totalVolume,
          totalPnl: Math.round(stats.totalPnl * 100) / 100,
          winRate: stats.totalTrades > 0 ? Math.round((stats.wins / stats.totalTrades) * 100) : 0
        } : { totalTrades: 0, totalVolume: 0, totalPnl: 0, winRate: 0 }
      }
    })
    
    // Filter by book type if specified
    let filteredUsers = usersWithBook
    if (bookType) {
      filteredUsers = usersWithBook.filter(u => u.bookType === bookType)
    }
    
    const totalCount = await User.countDocuments(userQuery)
    
    res.json({
      success: true,
      users: filteredUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching book users:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/book/assign - Assign user to A-Book or B-Book
router.post('/assign', async (req, res) => {
  try {
    const { userId, tradingAccountId, bookType, reason, adminId } = req.body
    
    if (!userId || !bookType || !adminId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId, bookType, and adminId are required' 
      })
    }
    
    if (!['A_BOOK', 'B_BOOK'].includes(bookType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'bookType must be A_BOOK or B_BOOK' 
      })
    }
    
    // Check if user exists
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    
    // Read previous book type before deactivating, so we know whether this
    // is a B→A or A→B transition (drives LP sync).
    const previousAssignment = await BookAssignment.findOne({ userId, isActive: true })
    const previousBookType = previousAssignment?.bookType || 'B_BOOK'

    // Deactivate previous assignments for this user
    await BookAssignment.updateMany(
      { userId, isActive: true },
      { isActive: false }
    )

    // Create new assignment
    const assignment = await BookAssignment.create({
      userId,
      tradingAccountId: tradingAccountId || null,
      bookType,
      assignedBy: adminId,
      reason: reason || '',
      autoAssignRule: 'MANUAL'
    })

    await assignment.populate('userId', 'firstName lastName email')
    await assignment.populate('assignedBy', 'name email')

    // LP sync: when transitioning B→A push open trades; A→B close them on LP.
    let syncResult = null
    let closeResult = null
    try {
      if (bookType === 'A_BOOK' && previousBookType !== 'A_BOOK') {
        syncResult = await syncOpenTradesToLp(user)
        try { corecenSocketClient.emitUserAdded(user) } catch (_) {}
      } else if (bookType === 'B_BOOK' && previousBookType === 'A_BOOK') {
        closeResult = await closeOpenTradesOnLp(user)
        try { corecenSocketClient.emitUserRemoved(user) } catch (_) {}
      }
    } catch (lpError) {
      console.error('[Book Management] LP sync on assign failed:', lpError.message)
    }

    let message = `User assigned to ${bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'} successfully`
    if (syncResult?.total > 0) {
      message += `. Synced ${syncResult.synced}/${syncResult.total} open trades to MT5/LP`
      if (syncResult.failed > 0) message += ` (${syncResult.failed} failed)`
      message += '.'
    }
    if (closeResult?.total > 0) {
      message += `. Closed ${closeResult.closed}/${closeResult.total} hedge(s) on MT5/LP`
      if (closeResult.failed > 0) message += ` (${closeResult.failed} failed)`
      message += '.'
    }

    res.json({
      success: true,
      message,
      assignment,
      lpSync: syncResult,
      lpClose: closeResult
    })
  } catch (error) {
    console.error('Error assigning book:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/book/bulk-assign - Bulk assign users to A-Book or B-Book
router.post('/bulk-assign', async (req, res) => {
  try {
    const { userIds, bookType, reason, adminId } = req.body
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'userIds array is required' 
      })
    }
    
    if (!['A_BOOK', 'B_BOOK'].includes(bookType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'bookType must be A_BOOK or B_BOOK' 
      })
    }
    
    // Snapshot previous book types so we can correctly fire user added/removed.
    const previousAssignments = await BookAssignment.find({ userId: { $in: userIds }, isActive: true })
      .select('userId bookType')
    const previousMap = new Map(previousAssignments.map(a => [a.userId.toString(), a.bookType]))

    // Deactivate previous assignments
    await BookAssignment.updateMany(
      { userId: { $in: userIds }, isActive: true },
      { isActive: false }
    )

    // Create new assignments
    const assignments = await BookAssignment.insertMany(
      userIds.map(userId => ({
        userId,
        bookType,
        assignedBy: adminId,
        reason: reason || 'Bulk assignment',
        autoAssignRule: 'MANUAL'
      }))
    )

    // LP sync per user. Best-effort — bulk operation, don't block on any single failure.
    let totalSynced = 0
    let totalClosed = 0
    if (lpIntegration.isConfigured()) {
      const users = await User.find({ _id: { $in: userIds } })
      for (const user of users) {
        const previousBookType = previousMap.get(user._id.toString()) || 'B_BOOK'
        try {
          if (bookType === 'A_BOOK' && previousBookType !== 'A_BOOK') {
            const r = await syncOpenTradesToLp(user)
            totalSynced += r.synced
            try { corecenSocketClient.emitUserAdded(user) } catch (_) {}
          } else if (bookType === 'B_BOOK' && previousBookType === 'A_BOOK') {
            const r = await closeOpenTradesOnLp(user)
            totalClosed += r.closed
            try { corecenSocketClient.emitUserRemoved(user) } catch (_) {}
          }
        } catch (lpErr) {
          console.error(`[Book Management] LP sync for ${user.email} failed:`, lpErr.message)
        }
      }
    }

    res.json({
      success: true,
      message: `${assignments.length} users assigned to ${bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'}`,
      count: assignments.length,
      lpSyncedTrades: totalSynced,
      lpClosedTrades: totalClosed
    })
  } catch (error) {
    console.error('Error bulk assigning book:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/book/user/:userId - Get specific user's book assignment
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    const assignment = await BookAssignment.findOne({ userId, isActive: true })
      .populate('userId', 'firstName lastName email')
      .populate('tradingAccountId', 'accountNumber balance')
      .populate('assignedBy', 'name email')
    
    const user = await User.findById(userId).select('firstName lastName email')
    
    // Get user's trade history for stats
    const trades = await Trade.find({ userId, status: 'CLOSED' })
    const totalTrades = trades.length
    const wins = trades.filter(t => t.pnl > 0).length
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const totalVolume = trades.reduce((sum, t) => sum + (t.quantity || 0), 0)
    
    res.json({
      success: true,
      user,
      assignment: assignment || { bookType: 'B_BOOK', autoAssignRule: 'DEFAULT' },
      stats: {
        totalTrades,
        wins,
        losses: totalTrades - wins,
        winRate: totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0,
        totalPnl: Math.round(totalPnl * 100) / 100,
        totalVolume: Math.round(totalVolume * 100) / 100
      }
    })
  } catch (error) {
    console.error('Error fetching user book:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== SETTINGS ====================

// GET /api/book/settings - Get book management settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await BookSettings.getSettings()
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Error fetching book settings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/book/settings - Update book management settings
router.put('/settings', async (req, res) => {
  try {
    const settings = await BookSettings.getSettings()
    
    // Update fields
    const allowedFields = [
      'defaultBookType', 'autoAssignEnabled', 'autoAssignRules',
      'aBookSettings', 'bBookSettings', 'riskManagement'
    ]
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field]
      }
    }
    
    await settings.save()
    
    res.json({ success: true, message: 'Settings updated', settings })
  } catch (error) {
    console.error('Error updating book settings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== HISTORY ====================

// GET /api/book/history - Get assignment history
router.get('/history', async (req, res) => {
  try {
    const { userId, page = 1, limit = 50 } = req.query
    
    let query = {}
    if (userId) {
      query.userId = userId
    }
    
    const history = await BookAssignment.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
    
    const total = await BookAssignment.countDocuments(query)
    
    res.json({
      success: true,
      history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching book history:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== LP SERVICE ====================

// GET /api/book/lp/status - Get LP connection status
router.get('/lp/status', async (req, res) => {
  try {
    const status = lpService.getStatus()
    const routingStats = await lpService.getRoutingStats()
    
    res.json({
      success: true,
      lp: status,
      routing: routingStats
    })
  } catch (error) {
    console.error('Error fetching LP status:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/book/lp/connect - Configure LP connection (for future use)
router.post('/lp/connect', async (req, res) => {
  try {
    const { provider, endpoint, apiKey, apiSecret } = req.body
    
    // Store LP config (will be used when LP is actually connected)
    const result = await lpService.connect({
      provider,
      endpoint,
      apiKey,
      apiSecret
    })
    
    // Update settings with LP provider info
    const settings = await BookSettings.getSettings()
    settings.aBookSettings.liquidityProvider = provider || ''
    await settings.save()
    
    res.json({
      success: true,
      message: 'LP configuration saved. Connection will be established when LP integration is complete.',
      result
    })
  } catch (error) {
    console.error('Error configuring LP:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/book/trades - Get trades with book type info
router.get('/trades', async (req, res) => {
  try {
    const { bookType, status = 'OPEN', page = 1, limit = 50 } = req.query
    
    let query = {}
    if (status) query.status = status
    if (bookType) query.bookType = bookType
    
    const trades = await Trade.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('tradingAccountId', 'accountNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
    
    const total = await Trade.countDocuments(query)
    
    // Get stats
    const aBookTrades = await Trade.countDocuments({ ...query, bookType: 'A_BOOK' })
    const bBookTrades = await Trade.countDocuments({ ...query, bookType: 'B_BOOK' })
    
    res.json({
      success: true,
      trades,
      stats: {
        aBookTrades,
        bBookTrades,
        total
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching book trades:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== A-BOOK TRADES (LP view) ====================

// GET /api/book/a-book/trades - All trades from users currently assigned to A-Book.
// Drives the AdminABookOrders dashboard.
router.get('/a-book/trades', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query

    const aBookAssignments = await BookAssignment.find({ bookType: 'A_BOOK', isActive: true }).select('userId')
    const aBookUserIds = aBookAssignments.map(a => a.userId)

    let query = { userId: { $in: aBookUserIds } }
    if (status && status !== 'all') {
      query.status = status.toUpperCase()
    }

    const trades = await Trade.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('tradingAccountId', 'accountNumber balance')
      .sort({ openedAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))

    const total = await Trade.countDocuments(query)
    const openTrades = await Trade.countDocuments({ ...query, status: 'OPEN' })
    const closedTrades = await Trade.countDocuments({ ...query, status: 'CLOSED' })

    const allTrades = await Trade.find(query).select('quantity realizedPnl commission status')
    const totalVolume = allTrades.reduce((sum, t) => sum + (t.quantity || 0), 0)
    const totalPnl = allTrades
      .filter(t => t.status === 'CLOSED')
      .reduce((sum, t) => sum + (t.realizedPnl || 0), 0)
    const totalCommission = allTrades.reduce((sum, t) => sum + (t.commission || 0), 0)

    res.json({
      success: true,
      trades,
      total,
      stats: {
        aBookUsers: aBookUserIds.length,
        openTrades,
        closedTrades,
        totalVolume,
        totalPnl,
        totalCommission
      }
    })
  } catch (error) {
    console.error('Error fetching A-Book trades:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== LP STATUS / SETTINGS ====================

// GET /api/book/lp-status - Live LP reachability check (from the monitor).
router.get('/lp-status', async (req, res) => {
  try {
    const status = lpConnectionMonitor.getStatus()
    res.json({
      success: true,
      ...status,
      message: status.connected ? 'LP is connected' : 'LP is not connected'
    })
  } catch (error) {
    console.error('Error checking LP status:', error)
    res.json({ success: false, connected: false, message: 'Error checking LP status' })
  }
})

// GET /api/book/lp-settings - Masked LP credentials for admin display.
router.get('/lp-settings', async (req, res) => {
  try {
    const settings = getLpSettings()
    const maskedSettings = {
      ...settings,
      lpApiKey: settings.lpApiKey ? `${settings.lpApiKey.substring(0, 8)}...${settings.lpApiKey.slice(-8)}` : '',
      lpApiSecret: settings.lpApiSecret ? `${'*'.repeat(32)}...${settings.lpApiSecret.slice(-8)}` : ''
    }
    res.json({
      success: true,
      settings: maskedSettings,
      fullSettings: settings
    })
  } catch (error) {
    console.error('Error fetching LP settings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/book/lp-settings - Update LP credentials at runtime.
// NOTE: this lives only in process memory; persist to .env for permanence.
router.put('/lp-settings', async (req, res) => {
  try {
    const { lpApiKey, lpApiSecret, lpApiUrl, enabled } = req.body
    lpIntegration.updateConfig({
      apiUrl: lpApiUrl || process.env.LP_API_URL || 'http://localhost:3001',
      apiKey: lpApiKey || process.env.LP_API_KEY || '',
      apiSecret: lpApiSecret || process.env.LP_API_SECRET || '',
      enabled: enabled !== undefined ? enabled : (process.env.LP_ENABLED === 'true')
    })
    try { corecenSocketClient.reconnect() } catch (_) {}
    console.log('[Book Management] LP settings updated (runtime) and WebSocket reconnected')
    res.json({
      success: true,
      message: 'LP settings updated (runtime only). For permanent changes, update .env and restart.'
    })
  } catch (error) {
    console.error('Error updating LP settings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/book/test-lp-connection - Probe an LP URL with optional credentials.
router.post('/test-lp-connection', async (req, res) => {
  try {
    const { lpApiKey, lpApiSecret, lpApiUrl } = req.body
    if (!lpApiUrl) {
      return res.status(400).json({ success: false, message: 'LP API URL is required' })
    }

    const healthUrl = `${lpApiUrl.replace(/\/api\/?$/, '')}/health`
    console.log(`[Book Management] Testing LP connection to ${healthUrl}`)

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      return res.json({
        success: false,
        message: `LP returned status ${response.status}. Check the URL and ensure LP is running.`
      })
    }

    const data = await response.json().catch(() => ({}))

    if (!lpApiKey || !lpApiSecret) {
      return res.json({
        success: true,
        message: 'LP is reachable. Add API credentials for full integration.',
        lpStatus: data
      })
    }

    // Authenticated probe
    const timestamp = Date.now().toString()
    const path = '/api/v1/broker-api/trades/stats'
    const message = timestamp + 'GET' + path
    const signature = crypto.createHmac('sha256', lpApiSecret).update(message).digest('hex')
    const authResponse = await fetch(`${lpApiUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': lpApiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      signal: AbortSignal.timeout(5000)
    })

    if (authResponse.ok) {
      return res.json({
        success: true,
        message: 'Connection successful! LP is reachable and credentials are valid.',
        lpStatus: data
      })
    }

    const authData = await authResponse.json().catch(() => ({}))
    res.json({
      success: true,
      message: `LP is reachable but authentication failed: ${authData.error?.message || 'check API key and secret.'}`,
      lpStatus: data,
      authStatus: 'failed'
    })
  } catch (error) {
    console.error('Error testing LP connection:', error)
    let message = 'Connection failed. '
    if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      message += 'Request timed out.'
    } else if (error.code === 'ECONNREFUSED') {
      message += 'Connection refused. Ensure the LP server is running on the specified URL.'
    } else {
      message += error.message
    }
    res.json({ success: false, message })
  }
})

// POST /api/book/sync-abook-trades - Bulk re-push every open A-Book trade
// that isn't yet on the active venue. Uses lpService.routeTrade so the same
// MT5-first / Corecen-fallback routing as live trade opens applies. Safe to
// hammer — skips trades already SYNCED with an mt5PositionId.
router.post('/sync-abook-trades', async (req, res) => {
  try {
    const mt5Ready = mt5PushService.isPushConfigured()
    const corecenReady = lpIntegration.isConfigured()
    if (!mt5Ready && !corecenReady) {
      return res.status(400).json({
        success: false,
        message: 'No LP venue configured. Set MT5_PUSH_ENABLED+METAAPI_* or LP_API_* in .env'
      })
    }

    const aBookAssignments = await BookAssignment.find({ bookType: 'A_BOOK', isActive: true }).select('userId')
    const aBookUserIds = aBookAssignments.map(a => a.userId)

    if (aBookUserIds.length === 0) {
      return res.json({ success: true, message: 'No A-Book users found', synced: 0, failed: 0, total: 0 })
    }

    // Find all open trades for A-Book users that aren't successfully synced
    // yet. SYNCED-with-mt5PositionId trades are excluded; SYNCED-without
    // (e.g. previously pushed to Corecen-only) are eligible to re-push to MT5.
    const trades = await Trade.find({
      userId: { $in: aBookUserIds },
      status: 'OPEN',
      $or: [
        { lpSyncStatus: { $exists: false } },
        { lpSyncStatus: 'PENDING' },
        { lpSyncStatus: 'FAILED' },
        { lpSyncStatus: 'NOT_APPLICABLE' },
        { lpSyncStatus: 'SYNCED', mt5PositionId: { $in: [null, ''] } }
      ]
    })

    if (trades.length === 0) {
      return res.json({ success: true, message: 'All A-Book trades are already synced', synced: 0, failed: 0, total: 0 })
    }

    console.log(`[Book Management] Bulk-sync: ${trades.length} A-Book trades pending push to ${mt5Ready ? 'MT5' : 'Corecen'}...`)

    let synced = 0
    let failed = 0
    const errors = []
    const userCache = new Map()

    for (const trade of trades) {
      try {
        const uid = trade.userId.toString()
        if (!userCache.has(uid)) {
          userCache.set(uid, await User.findById(trade.userId))
        }

        // routeTrade picks the venue (MT5 if configured, Corecen otherwise),
        // pushes, and mutates the trade with sync state + positionId.
        const result = await lpService.routeTrade(trade, trade.userId, trade.tradingAccountId)
        await trade.save()

        if (trade.lpSyncStatus === 'SYNCED') {
          synced++
          const venue = result.venue || (trade.mt5PositionId ? 'MT5' : 'LP')
          const id = trade.mt5PositionId || trade.lpOrderId || '-'
          console.log(`[Book Management] ✓ ${trade.tradeId} (${trade.symbol} ${trade.side} ${trade.quantity}) → ${venue} positionId=${id}`)
        } else {
          failed++
          const errMsg = trade.lpSyncError || result.message || 'Unknown error'
          errors.push({ tradeId: trade.tradeId, symbol: trade.symbol, error: errMsg })
          console.error(`[Book Management] ✗ ${trade.tradeId} (${trade.symbol}) failed: ${errMsg}`)
        }
      } catch (tradeError) {
        failed++
        errors.push({ tradeId: trade.tradeId, symbol: trade.symbol, error: tradeError.message })
        console.error(`[Book Management] ✗ ${trade.tradeId} threw: ${tradeError.message}`)
      }
    }

    console.log(`[Book Management] Bulk-sync done — ${synced}/${trades.length} synced, ${failed} failed`)

    res.json({
      success: true,
      message: `Synced ${synced}/${trades.length} trades${failed > 0 ? ` (${failed} failed)` : ''}`,
      synced,
      failed,
      total: trades.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('[Book Management] Error syncing A-Book trades:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== MT5 DIRECT PUSH ====================

// GET /api/book/mt5/status - MT5 push connection state.
router.get('/mt5/status', async (req, res) => {
  res.json({ success: true, ...mt5PushService.getStatus() })
})

// POST /api/book/mt5/connect - Force a (re)connect to MetaAPI. Bypasses the
// circuit breaker (forceReset=true) — use after MetaAPI outage to wake the
// service back up without waiting for the next auto-retry window.
router.post('/mt5/connect', async (req, res) => {
  try {
    if (!mt5PushService.isPushConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'MT5 push not configured. Set MT5_PUSH_ENABLED=true and METAAPI_TOKEN/METAAPI_ACCOUNT_ID in .env'
      })
    }
    await mt5PushService.connect(true) // force-reset circuit breaker
    res.json({ success: true, message: 'MT5 connection established', status: mt5PushService.getStatus() })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, status: mt5PushService.getStatus() })
  }
})

// GET /api/book/mt5/positions - Current open positions on the MT5 hedging
// account. The admin A-Book page calls this to show side-by-side reconciliation.
router.get('/mt5/positions', async (req, res) => {
  try {
    const result = await mt5PushService.listPositions()
    if (!result.success) {
      return res.status(503).json({ success: false, message: result.error })
    }
    res.json({ success: true, positions: result.positions, count: result.positions.length })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/book/mt5/test-push/:tradeId - Re-push a specific BlueStone trade
// to MT5. Diagnostic / manual sync — useful to verify the pipeline without
// opening a fresh trade through the UI.
router.post('/mt5/test-push/:tradeId', async (req, res) => {
  try {
    if (!mt5PushService.isPushConfigured()) {
      return res.status(400).json({ success: false, message: 'MT5 push not configured' })
    }
    const trade = await Trade.findById(req.params.tradeId)
    if (!trade) return res.status(404).json({ success: false, message: 'Trade not found' })
    if (trade.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: `Trade is ${trade.status}, only OPEN trades can be pushed` })
    }
    const user = await User.findById(trade.userId)
    const result = await mt5PushService.pushTrade(trade, user)
    if (result.success) {
      trade.mt5PositionId = result.mt5PositionId
      trade.mt5OrderId = result.mt5OrderId
      trade.mt5Symbol = result.mt5Symbol
      trade.lpSyncStatus = 'SYNCED'
      trade.lpSyncedAt = new Date()
      trade.lpSyncError = null
      trade.lpRouted = true
      trade.lpOrderId = result.mt5PositionId
      trade.bookType = 'A_BOOK'
      await trade.save()
    } else {
      trade.lpSyncStatus = 'FAILED'
      trade.lpSyncError = result.error
      await trade.save()
    }
    res.json({
      success: result.success,
      result,
      // Surface the rich error so the admin UI can show the real cause
      // (symbol mismatch, lot size, market closed, etc.) instead of a vague
      // "Validation failed".
      error: result.error,
      errorDetails: result.errorDetails,
      symbolSent: result.symbolSent,
      trade: { _id: trade._id, tradeId: trade.tradeId, symbol: trade.symbol, lpSyncStatus: trade.lpSyncStatus, mt5PositionId: trade.mt5PositionId }
    })
  } catch (error) {
    console.error('Error test-pushing trade:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/book/mt5/reconcile - Compare BlueStone A-Book open trades to
// current MT5 positions. Same logic as scripts/check-mt5-positions.js but
// exposed for the admin UI.
router.get('/mt5/reconcile', async (req, res) => {
  try {
    if (!mt5PushService.isPushConfigured()) {
      return res.status(400).json({ success: false, message: 'MT5 push not configured' })
    }

    const posResult = await mt5PushService.listPositions()
    if (!posResult.success) {
      return res.status(503).json({ success: false, message: posResult.error })
    }

    const aBookAssignments = await BookAssignment.find({ bookType: 'A_BOOK', isActive: true }).select('userId')
    const aBookUserIds = aBookAssignments.map(a => a.userId)
    const bsTrades = await Trade.find({ userId: { $in: aBookUserIds }, status: 'OPEN' })
      .populate('userId', 'email firstName')

    // Match BlueStone → MT5 by mt5PositionId first, then fuzzy (symbol+side+volume).
    const mt5ById = new Map(posResult.positions.map(p => [p.id?.toString(), p]))
    const tolerance = 0.01
    const matched = []
    const missingOnMt5 = []
    const usedMt5Ids = new Set()

    for (const t of bsTrades) {
      if (t.mt5PositionId && mt5ById.has(t.mt5PositionId)) {
        matched.push({ trade: t, mt5: mt5ById.get(t.mt5PositionId), matchedBy: 'positionId' })
        usedMt5Ids.add(t.mt5PositionId)
        continue
      }
      // Fuzzy fallback
      const fuzzy = posResult.positions.find(p => {
        if (usedMt5Ids.has(p.id?.toString())) return false
        const mt5Side = p.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL'
        return mt5Side === t.side && Math.abs(p.volume - t.quantity) <= tolerance
        // Symbol match is intentionally loose because broker symbol may differ.
      })
      if (fuzzy) {
        matched.push({ trade: t, mt5: fuzzy, matchedBy: 'fuzzy' })
        usedMt5Ids.add(fuzzy.id?.toString())
      } else {
        missingOnMt5.push(t)
      }
    }
    const extraOnMt5 = posResult.positions.filter(p => !usedMt5Ids.has(p.id?.toString()))

    res.json({
      success: true,
      summary: {
        bluestoneOpen: bsTrades.length,
        mt5Open: posResult.positions.length,
        matched: matched.length,
        missingOnMt5: missingOnMt5.length,
        extraOnMt5: extraOnMt5.length
      },
      matched: matched.map(m => ({
        tradeId: m.trade.tradeId,
        symbol: m.trade.symbol,
        side: m.trade.side,
        volume: m.trade.quantity,
        mt5PositionId: m.mt5.id,
        mt5Symbol: m.mt5.symbol,
        matchedBy: m.matchedBy
      })),
      missingOnMt5: missingOnMt5.map(t => ({
        tradeId: t.tradeId,
        _id: t._id,
        symbol: t.symbol,
        side: t.side,
        volume: t.quantity,
        lpSyncStatus: t.lpSyncStatus,
        lpSyncError: t.lpSyncError,
        user: t.userId?.email
      })),
      extraOnMt5: extraOnMt5.map(p => ({
        mt5PositionId: p.id,
        symbol: p.symbol,
        side: p.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
        volume: p.volume,
        openPrice: p.openPrice
      }))
    })
  } catch (error) {
    console.error('Error reconciling MT5:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
