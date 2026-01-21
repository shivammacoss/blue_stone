import express from 'express'
import User from '../models/User.js'
import Trade from '../models/Trade.js'
import TradingAccount from '../models/TradingAccount.js'

const router = express.Router()

// Get all users with book type info
router.get('/users', async (req, res) => {
  try {
    const { search, bookType, page = 1, limit = 20 } = req.query
    
    let query = {}
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (bookType && ['A', 'B'].includes(bookType)) {
      query.bookType = bookType
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const users = await User.find(query)
      .select('firstName email phone bookType bookChangedAt createdAt isBlocked')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    // Get trading account count and total trades for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const accountCount = await TradingAccount.countDocuments({ userId: user._id })
      const totalTrades = await Trade.countDocuments({ userId: user._id })
      const openTrades = await Trade.countDocuments({ userId: user._id, status: 'OPEN' })
      
      return {
        ...user,
        accountCount,
        totalTrades,
        openTrades
      }
    }))
    
    const total = await User.countDocuments(query)
    
    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching users for book management:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Toggle user book type (A/B)
router.put('/users/:userId/book-type', async (req, res) => {
  try {
    const { userId } = req.params
    const { bookType } = req.body
    
    if (!['A', 'B'].includes(bookType)) {
      return res.status(400).json({ success: false, message: 'Invalid book type. Must be A or B' })
    }
    
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    
    const previousBookType = user.bookType
    
    user.bookType = bookType
    user.bookChangedAt = new Date()
    await user.save()
    
    res.json({
      success: true,
      message: `User moved from ${previousBookType}-Book to ${bookType}-Book`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        email: user.email,
        bookType: user.bookType,
        bookChangedAt: user.bookChangedAt
      }
    })
  } catch (error) {
    console.error('Error updating user book type:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Bulk update book type for multiple users
router.put('/users/bulk-book-type', async (req, res) => {
  try {
    const { userIds, bookType } = req.body
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'User IDs array is required' })
    }
    
    if (!['A', 'B'].includes(bookType)) {
      return res.status(400).json({ success: false, message: 'Invalid book type. Must be A or B' })
    }
    
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      {
        $set: {
          bookType,
          bookChangedAt: new Date()
        }
      }
    )
    
    res.json({
      success: true,
      message: `${result.modifiedCount} users moved to ${bookType}-Book`,
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    console.error('Error bulk updating book type:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Get book statistics
router.get('/stats', async (req, res) => {
  try {
    const aBookUsers = await User.countDocuments({ bookType: 'A' })
    const bBookUsers = await User.countDocuments({ bookType: 'B' })
    
    const aBookTrades = await Trade.countDocuments({ bookType: 'A', status: 'OPEN' })
    const bBookTrades = await Trade.countDocuments({ bookType: 'B', status: 'OPEN' })
    
    const aBookVolume = await Trade.aggregate([
      { $match: { bookType: 'A', status: 'OPEN' } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ])
    
    const bBookVolume = await Trade.aggregate([
      { $match: { bookType: 'B', status: 'OPEN' } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ])
    
    res.json({
      success: true,
      stats: {
        aBook: {
          users: aBookUsers,
          openTrades: aBookTrades,
          volume: aBookVolume[0]?.total || 0
        },
        bBook: {
          users: bBookUsers,
          openTrades: bBookTrades,
          volume: bBookVolume[0]?.total || 0
        }
      }
    })
  } catch (error) {
    console.error('Error fetching book stats:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Get A-Book positions (open trades) - Optimized for high volume
router.get('/a-book/positions', async (req, res) => {
  try {
    const { page = 1, limit = 100, symbol } = req.query
    
    let query = { bookType: 'A', status: 'OPEN' }
    if (symbol) query.symbol = symbol
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    // Use lean() and select only needed fields for faster queries
    const [positions, total, summary] = await Promise.all([
      Trade.find(query)
        .select('tradeId userId tradingAccountId symbol side quantity openPrice leverage contractSize marginUsed commission swap openedAt stopLoss takeProfit')
        .populate('userId', 'firstName email')
        .populate('tradingAccountId', 'accountNumber')
        .sort({ openedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Trade.countDocuments(query),
      Trade.aggregate([
        { $match: { bookType: 'A', status: 'OPEN' } },
        { $group: {
          _id: null,
          totalVolume: { $sum: '$quantity' },
          totalExposure: { $sum: { $divide: [{ $multiply: ['$quantity', '$contractSize', '$openPrice'] }, '$leverage'] } },
          count: { $sum: 1 }
        }}
      ])
    ])
    
    res.json({
      success: true,
      positions,
      summary: summary[0] || { totalVolume: 0, totalExposure: 0, count: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching A-Book positions:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Get A-Book history (closed trades) - Optimized for high volume
router.get('/a-book/history', async (req, res) => {
  try {
    const { page = 1, limit = 100, symbol, dateFrom, dateTo } = req.query
    
    let query = { bookType: 'A', status: 'CLOSED' }
    if (symbol) query.symbol = symbol
    if (dateFrom || dateTo) {
      query.closedAt = {}
      if (dateFrom) query.closedAt.$gte = new Date(dateFrom)
      if (dateTo) query.closedAt.$lte = new Date(dateTo)
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [history, total, summary] = await Promise.all([
      Trade.find(query)
        .select('tradeId userId tradingAccountId symbol side quantity openPrice closePrice leverage contractSize realizedPnl openedAt closedAt closedBy')
        .populate('userId', 'firstName email')
        .populate('tradingAccountId', 'accountNumber')
        .sort({ closedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Trade.countDocuments(query),
      Trade.aggregate([
        { $match: { bookType: 'A', status: 'CLOSED' } },
        { $group: {
          _id: null,
          totalPnl: { $sum: '$realizedPnl' },
          totalVolume: { $sum: '$quantity' },
          count: { $sum: 1 },
          winCount: { $sum: { $cond: [{ $gte: ['$realizedPnl', 0] }, 1, 0] } },
          lossCount: { $sum: { $cond: [{ $lt: ['$realizedPnl', 0] }, 1, 0] } }
        }}
      ])
    ])
    
    res.json({
      success: true,
      history,
      summary: summary[0] || { totalPnl: 0, totalVolume: 0, count: 0, winCount: 0, lossCount: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching A-Book history:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Get A-Book trades (legacy - for backward compatibility)
router.get('/a-book/trades', async (req, res) => {
  try {
    const { status = 'OPEN', page = 1, limit = 50, symbol } = req.query
    
    let query = { bookType: 'A' }
    
    if (status && status !== 'ALL') {
      query.status = status
    }
    
    if (symbol) {
      query.symbol = symbol
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const trades = await Trade.find(query)
      .populate('userId', 'firstName email bookType')
      .populate('tradingAccountId', 'accountNumber accountName')
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    const total = await Trade.countDocuments(query)
    
    // Calculate totals
    const openABookTrades = await Trade.find({ bookType: 'A', status: 'OPEN' }).lean()
    const totalExposure = openABookTrades.reduce((sum, t) => {
      const exposure = t.quantity * t.contractSize * t.openPrice / t.leverage
      return sum + exposure
    }, 0)
    
    const totalVolume = openABookTrades.reduce((sum, t) => sum + t.quantity, 0)
    
    res.json({
      success: true,
      trades,
      summary: {
        totalExposure,
        totalVolume,
        openTradesCount: openABookTrades.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching A-Book trades:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Get B-Book trades (for reference)
router.get('/b-book/trades', async (req, res) => {
  try {
    const { status = 'OPEN', page = 1, limit = 50, symbol } = req.query
    
    let query = { bookType: 'B' }
    
    if (status && status !== 'ALL') {
      query.status = status
    }
    
    if (symbol) {
      query.symbol = symbol
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const trades = await Trade.find(query)
      .populate('userId', 'firstName email bookType')
      .populate('tradingAccountId', 'accountNumber accountName')
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    const total = await Trade.countDocuments(query)
    
    res.json({
      success: true,
      trades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching B-Book trades:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

export default router
