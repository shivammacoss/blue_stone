import express from 'express'
import BookAssignment from '../models/BookAssignment.js'
import BookSettings from '../models/BookSettings.js'
import User from '../models/User.js'
import TradingAccount from '../models/TradingAccount.js'
import Trade from '../models/Trade.js'
import lpService from '../services/lpService.js'

const router = express.Router()

// ==================== DASHBOARD STATS ====================

// GET /api/book/dashboard - Get A-Book/B-Book dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const aBookCount = await BookAssignment.countDocuments({ bookType: 'A_BOOK', isActive: true })
    const bBookCount = await BookAssignment.countDocuments({ bookType: 'B_BOOK', isActive: true })
    
    // Get total users without assignment (default B-Book)
    const assignedUserIds = await BookAssignment.distinct('userId', { isActive: true })
    const totalUsers = await User.countDocuments({ role: 'user' })
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
    const allUsers = await User.find({ role: 'user' }).select('_id')
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
    
    // Get all users
    let userQuery = { role: 'user' }
    if (search) {
      userQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }
    
    const users = await User.find(userQuery)
      .select('firstName lastName email createdAt')
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
      
      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
        bookType: assignment?.bookType || 'B_BOOK',
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
    
    res.json({
      success: true,
      message: `User assigned to ${bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'} successfully`,
      assignment
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
    
    res.json({
      success: true,
      message: `${assignments.length} users assigned to ${bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'}`,
      count: assignments.length
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

export default router
