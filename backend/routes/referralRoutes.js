import express from 'express'
import User from '../models/User.js'
import ReferralIncomePlan from '../models/ReferralIncomePlan.js'
import DirectJoiningPlan from '../models/DirectJoiningPlan.js'
import ReferralCommission from '../models/ReferralCommission.js'
import IBWallet from '../models/IBWallet.js'
import referralEngine from '../services/referralEngine.js'

const router = express.Router()

// Get user's referral stats and link
router.get('/my-stats', async (req, res) => {
  try {
    const userId = req.query.userId
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' })
    }

    const stats = await referralEngine.getUserReferralStats(userId)
    res.json({ success: true, ...stats })
  } catch (error) {
    console.error('Error getting referral stats:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get user's referral code (or generate if not exists)
router.get('/my-code/:userId', async (req, res) => {
  try {
    const code = await referralEngine.ensureUserHasReferralCode(req.params.userId)
    const user = await User.findById(req.params.userId)
    
    res.json({ 
      success: true, 
      referralCode: code,
      referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${code}`,
      directReferrals: await User.countDocuments({ parentIBId: req.params.userId })
    })
  } catch (error) {
    console.error('Error getting referral code:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get commission history
router.get('/commissions/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query
    const result = await referralEngine.getCommissionHistory(
      req.params.userId, 
      parseInt(page), 
      parseInt(limit),
      type
    )
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error getting commission history:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get downline tree
router.get('/downline/:userId', async (req, res) => {
  try {
    const { maxDepth = 5 } = req.query
    const tree = await referralEngine.getDownlineTree(req.params.userId, parseInt(maxDepth))
    res.json({ success: true, tree })
  } catch (error) {
    console.error('Error getting downline tree:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get wallet balance
router.get('/wallet/:userId', async (req, res) => {
  try {
    const wallet = await IBWallet.getOrCreateWallet(req.params.userId)
    res.json({ 
      success: true, 
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        pendingWithdrawal: wallet.pendingWithdrawal
      }
    })
  } catch (error) {
    console.error('Error getting wallet:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Validate referral code
router.get('/validate/:code', async (req, res) => {
  try {
    const user = await User.findOne({ referralCode: req.params.code })
    if (!user) {
      return res.json({ success: false, valid: false, message: 'Invalid referral code' })
    }
    res.json({ 
      success: true, 
      valid: true, 
      referrerName: user.firstName 
    })
  } catch (error) {
    console.error('Error validating referral code:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ============ ADMIN ROUTES ============

// Get Referral Income Plan
router.get('/admin/referral-income-plan', async (req, res) => {
  try {
    const plan = await ReferralIncomePlan.getActivePlan()
    res.json({ success: true, plan })
  } catch (error) {
    console.error('Error getting referral income plan:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Update Referral Income Plan
router.put('/admin/referral-income-plan', async (req, res) => {
  try {
    const { maxLevels, levels, commissionType } = req.body
    
    let plan = await ReferralIncomePlan.findOne({ isActive: true })
    if (!plan) {
      plan = await ReferralIncomePlan.getActivePlan()
    }

    if (maxLevels) plan.maxLevels = maxLevels
    if (commissionType) plan.commissionType = commissionType
    if (levels && Array.isArray(levels)) {
      plan.levels = levels.map((l, i) => ({
        level: l.level || i + 1,
        amount: l.amount || 0
      }))
    }
    plan.updatedAt = new Date()
    
    await plan.save()
    res.json({ success: true, plan, message: 'Referral Income Plan updated' })
  } catch (error) {
    console.error('Error updating referral income plan:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get Direct Joining Plan
router.get('/admin/direct-joining-plan', async (req, res) => {
  try {
    const plan = await DirectJoiningPlan.getActivePlan()
    res.json({ success: true, plan })
  } catch (error) {
    console.error('Error getting direct joining plan:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Update Direct Joining Plan
router.put('/admin/direct-joining-plan', async (req, res) => {
  try {
    const { maxLevels, levels, totalDistribution, commissionType } = req.body
    
    let plan = await DirectJoiningPlan.findOne({ isActive: true })
    if (!plan) {
      plan = await DirectJoiningPlan.getActivePlan()
    }

    if (maxLevels) plan.maxLevels = maxLevels
    if (totalDistribution) plan.totalDistribution = totalDistribution
    if (commissionType) plan.commissionType = commissionType
    if (levels && Array.isArray(levels)) {
      plan.levels = levels.map((l, i) => ({
        level: l.level || i + 1,
        percentage: l.percentage || 0
      }))
    }
    plan.updatedAt = new Date()
    
    await plan.save()
    res.json({ success: true, plan, message: 'Direct Joining Plan updated' })
  } catch (error) {
    console.error('Error updating direct joining plan:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all referral users with stats
router.get('/admin/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    let query = { referralCode: { $exists: true, $ne: null } }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } }
      ]
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email referralCode parentIBId createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ])

    const usersWithStats = await Promise.all(users.map(async (user) => {
      const [directReferrals, totalEarnings] = await Promise.all([
        User.countDocuments({ parentIBId: user._id }),
        ReferralCommission.aggregate([
          { $match: { recipientUserId: user._id, status: 'CREDITED' } },
          { $group: { _id: null, total: { $sum: '$commissionAmount' } } }
        ])
      ])

      return {
        ...user,
        directReferrals,
        totalEarnings: totalEarnings[0]?.total || 0
      }
    }))

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
    console.error('Error getting referral users:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get commission stats for admin
router.get('/admin/stats', async (req, res) => {
  try {
    const [referralStats, joiningStats, totalUsers, activeReferrers] = await Promise.all([
      ReferralCommission.aggregate([
        { $match: { commissionType: 'REFERRAL_INCOME', status: 'CREDITED' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
      ]),
      ReferralCommission.aggregate([
        { $match: { commissionType: 'DIRECT_JOINING', status: 'CREDITED' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
      ]),
      User.countDocuments({ referralCode: { $exists: true, $ne: null } }),
      User.countDocuments({ parentIBId: { $exists: true, $ne: null } })
    ])

    res.json({
      success: true,
      stats: {
        referralIncome: {
          total: referralStats[0]?.total || 0,
          count: referralStats[0]?.count || 0
        },
        joiningIncome: {
          total: joiningStats[0]?.total || 0,
          count: joiningStats[0]?.count || 0
        },
        totalReferrers: totalUsers,
        totalReferred: activeReferrers
      }
    })
  } catch (error) {
    console.error('Error getting admin stats:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all commissions for admin
router.get('/admin/commissions', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    let query = {}
    if (type) query.commissionType = type
    if (userId) query.recipientUserId = userId

    const [commissions, total] = await Promise.all([
      ReferralCommission.find(query)
        .populate('recipientUserId', 'firstName email')
        .populate('sourceUserId', 'firstName email')
        .populate('tradeId', 'tradeId symbol quantity')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReferralCommission.countDocuments(query)
    ])

    res.json({
      success: true,
      commissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error getting admin commissions:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
