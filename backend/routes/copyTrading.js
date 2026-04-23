import express from 'express'
import MasterTrader from '../models/MasterTrader.js'
import CopyFollower from '../models/CopyFollower.js'
import CopyTrade from '../models/CopyTrade.js'
import CopyCommission from '../models/CopyCommission.js'
import CopySettings from '../models/CopySettings.js'
import TradingAccount from '../models/TradingAccount.js'
import Trade from '../models/Trade.js'
import MasterRating from '../models/MasterRating.js'
import copyTradingEngine from '../services/copyTradingEngine.js'

const router = express.Router()

// ==================== MASTER TRADER ROUTES ====================

// POST /api/copy/master/apply - Apply to become a master trader
router.post('/master/apply', async (req, res) => {
  try {
    const { userId, tradingAccountId, displayName, description, requestedCommissionPercentage } = req.body

    // Check if copy trading is enabled
    const settings = await CopySettings.getSettings()
    if (!settings.isEnabled || !settings.allowNewMasterApplications) {
      return res.status(400).json({ message: 'Master applications are currently closed' })
    }

    // Check if user already has a master application
    const existingMaster = await MasterTrader.findOne({ userId })
    if (existingMaster) {
      return res.status(400).json({ 
        message: 'You already have a master trader application',
        status: existingMaster.status
      })
    }

    // Validate commission percentage
    if (requestedCommissionPercentage < settings.commissionSettings.minCommissionPercentage ||
        requestedCommissionPercentage > settings.commissionSettings.maxCommissionPercentage) {
      return res.status(400).json({ 
        message: `Commission must be between ${settings.commissionSettings.minCommissionPercentage}% and ${settings.commissionSettings.maxCommissionPercentage}%`
      })
    }

    // Validate trading account
    const tradingAccount = await TradingAccount.findById(tradingAccountId)
    if (!tradingAccount || tradingAccount.userId.toString() !== userId) {
      return res.status(400).json({ message: 'Invalid trading account' })
    }

    // Check minimum equity
    const minEquityMet = tradingAccount.balance >= settings.masterRequirements.minEquity

    // Check trading history
    const tradeCount = await Trade.countDocuments({ 
      tradingAccountId, 
      status: 'CLOSED' 
    })
    const minTradesMet = tradeCount >= settings.masterRequirements.minTotalTrades

    // Create master application
    const master = await MasterTrader.create({
      userId,
      tradingAccountId,
      displayName,
      description,
      requestedCommissionPercentage,
      minimumEquityMet: minEquityMet,
      minimumTradesMet: minTradesMet,
      status: 'PENDING'
    })

    res.status(201).json({
      message: 'Master trader application submitted',
      master: {
        _id: master._id,
        displayName: master.displayName,
        status: master.status,
        requestedCommissionPercentage: master.requestedCommissionPercentage
      }
    })

  } catch (error) {
    console.error('Error applying as master:', error)
    res.status(500).json({ message: 'Error submitting application', error: error.message })
  }
})

// GET /api/copy/masters - Get all active public masters
router.get('/masters', async (req, res) => {
  try {
    const masters = await MasterTrader.find({
      status: 'ACTIVE',
      visibility: 'PUBLIC'
    })
      .populate('userId', 'firstName lastName')
      .select('-pendingCommission -totalCommissionEarned -totalCommissionWithdrawn')
      .sort({ 'stats.totalFollowers': -1 })

    res.json({ masters })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching masters', error: error.message })
  }
})

// DELETE /api/copy/master/reapply/:userId - Delete suspended master record to allow reapply
router.delete('/master/reapply/:userId', async (req, res) => {
  try {
    const master = await MasterTrader.findOne({ userId: req.params.userId })
    if (!master) {
      return res.status(404).json({ message: 'Master profile not found' })
    }

    if (master.status !== 'SUSPENDED' && master.status !== 'REJECTED') {
      return res.status(400).json({ message: 'Only suspended or rejected masters can reapply' })
    }

    // Delete all followers of this master
    await CopyFollower.deleteMany({ masterId: master._id })
    
    // Delete all copy trades of this master
    await CopyTrade.deleteMany({ masterId: master._id })
    
    // Delete the master record
    await MasterTrader.findByIdAndDelete(master._id)

    res.json({ message: 'Master profile deleted. You can now reapply.' })
  } catch (error) {
    res.status(500).json({ message: 'Error processing reapply', error: error.message })
  }
})

// GET /api/copy/master/:id - Get master details
router.get('/master/:id', async (req, res) => {
  try {
    const master = await MasterTrader.findById(req.params.id)
      .populate('userId', 'firstName lastName')
      .select('-pendingCommission -totalCommissionEarned -totalCommissionWithdrawn')

    if (!master) {
      return res.status(404).json({ message: 'Master not found' })
    }

    res.json({ master })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching master', error: error.message })
  }
})

// GET /api/copy/master/my-profile/:userId - Get user's master profile
router.get('/master/my-profile/:userId', async (req, res) => {
  try {
    const master = await MasterTrader.findOne({ userId: req.params.userId })
      .populate('tradingAccountId', 'accountId balance')

    if (!master) {
      return res.status(404).json({ message: 'Master profile not found' })
    }

    res.json({ master })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching master profile', error: error.message })
  }
})

// POST /api/copy/master/withdraw - Request commission withdrawal
router.post('/master/withdraw', async (req, res) => {
  try {
    const { masterId, amount } = req.body

    const result = await copyTradingEngine.processMasterWithdrawal(masterId, amount, null)

    res.json({
      message: 'Commission withdrawn successfully',
      ...result
    })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/copy/master/update-profile - Update master profile (commission, description, etc.)
router.put('/master/update-profile', async (req, res) => {
  try {
    const { masterId, displayName, description, requestedCommissionPercentage } = req.body

    const master = await MasterTrader.findById(masterId)
    if (!master) {
      return res.status(404).json({ message: 'Master profile not found' })
    }

    // Validate commission percentage
    const settings = await CopySettings.getSettings()
    if (requestedCommissionPercentage !== undefined) {
      if (requestedCommissionPercentage < settings.commissionSettings.minCommissionPercentage ||
          requestedCommissionPercentage > settings.commissionSettings.maxCommissionPercentage) {
        return res.status(400).json({ 
          message: `Commission must be between ${settings.commissionSettings.minCommissionPercentage}% and ${settings.commissionSettings.maxCommissionPercentage}%`
        })
      }
    }

    // Update fields
    if (displayName) master.displayName = displayName
    if (description !== undefined) master.description = description
    
    // Commission change request - if master is ACTIVE, this becomes a request
    if (requestedCommissionPercentage !== undefined && requestedCommissionPercentage !== master.approvedCommissionPercentage) {
      master.requestedCommissionPercentage = requestedCommissionPercentage
      // If master is ACTIVE, admin needs to approve the new commission
      // For now, auto-approve if within limits (you can change this to require admin approval)
      if (master.status === 'ACTIVE') {
        master.approvedCommissionPercentage = requestedCommissionPercentage
      }
    }

    await master.save()

    res.json({
      message: 'Profile updated successfully',
      master: {
        _id: master._id,
        displayName: master.displayName,
        description: master.description,
        requestedCommissionPercentage: master.requestedCommissionPercentage,
        approvedCommissionPercentage: master.approvedCommissionPercentage
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message })
  }
})

// ==================== FOLLOWER ROUTES ====================

// POST /api/copy/follow - Follow a master trader
router.post('/follow', async (req, res) => {
  try {
    const { followerUserId, masterId, followerAccountId, copyMode, copyValue, maxLotSize, maxDailyLoss } = req.body

    // Check if copy trading is enabled
    const settings = await CopySettings.getSettings()
    if (!settings.isEnabled || !settings.allowNewFollowers) {
      return res.status(400).json({ message: 'Following is currently disabled' })
    }

    // Validate master
    const master = await MasterTrader.findById(masterId)
    if (!master || master.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Master trader not available' })
    }

    // Prevent user from following their own master account
    if (master.userId.toString() === followerUserId) {
      return res.status(400).json({ 
        message: 'You cannot follow your own master account. This would cause duplicate trades when you trade.' 
      })
    }

    // Check follower limit
    if (master.stats.activeFollowers >= settings.copyLimits.maxFollowersPerMaster) {
      return res.status(400).json({ message: 'Master has reached maximum followers' })
    }

    // Validate follower account
    const followerAccount = await TradingAccount.findById(followerAccountId)
    if (!followerAccount || followerAccount.userId.toString() !== followerUserId) {
      return res.status(400).json({ message: 'Invalid trading account' })
    }

    if (followerAccount.status !== 'Active') {
      return res.status(400).json({ message: 'Trading account is not active' })
    }

    // Check if already following
    const existingFollow = await CopyFollower.findOne({
      followerId: followerUserId,
      masterId,
      followerAccountId,
      status: { $in: ['ACTIVE', 'PAUSED'] }
    })

    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this master with this account' })
    }

    // Validate copy settings
    if (!['FIXED_LOT', 'BALANCE_BASED', 'EQUITY_BASED', 'MULTIPLIER', 'LOT_MULTIPLIER', 'AUTO'].includes(copyMode)) {
      return res.status(400).json({ message: 'Invalid copy mode. Use FIXED_LOT, BALANCE_BASED, EQUITY_BASED, MULTIPLIER, or AUTO' })
    }

    if (copyValue < settings.copyLimits.minCopyLotSize) {
      return res.status(400).json({ message: `Minimum copy value is ${settings.copyLimits.minCopyLotSize}` })
    }

    // Create follower subscription
    const follower = await CopyFollower.create({
      followerId: followerUserId,
      masterId,
      followerAccountId,
      copyMode,
      copyValue,
      maxLotSize: maxLotSize || 10,
      maxDailyLoss: maxDailyLoss || null,
      status: 'ACTIVE'
    })

    // Update master stats
    master.stats.totalFollowers += 1
    master.stats.activeFollowers += 1
    await master.save()

    res.status(201).json({
      message: 'Successfully following master trader',
      follower: {
        _id: follower._id,
        masterId: follower.masterId,
        copyMode: follower.copyMode,
        copyValue: follower.copyValue,
        status: follower.status
      }
    })

  } catch (error) {
    console.error('Error following master:', error)
    res.status(500).json({ message: 'Error following master', error: error.message })
  }
})

// PUT /api/copy/follow/:id/pause - Pause following
router.put('/follow/:id/pause', async (req, res) => {
  try {
    const follower = await CopyFollower.findById(req.params.id)
    if (!follower) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    follower.status = 'PAUSED'
    follower.pausedAt = new Date()
    await follower.save()

    // Update master stats
    const master = await MasterTrader.findById(follower.masterId)
    if (master) {
      master.stats.activeFollowers -= 1
      await master.save()
    }

    res.json({ message: 'Following paused', follower })
  } catch (error) {
    res.status(500).json({ message: 'Error pausing follow', error: error.message })
  }
})

// PUT /api/copy/follow/:id/resume - Resume following
router.put('/follow/:id/resume', async (req, res) => {
  try {
    const follower = await CopyFollower.findById(req.params.id)
    if (!follower) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    follower.status = 'ACTIVE'
    follower.pausedAt = null
    follower.stoppedAt = null
    await follower.save()

    // Update master stats
    const master = await MasterTrader.findById(follower.masterId)
    if (master) {
      master.stats.activeFollowers += 1
      await master.save()
    }

    res.json({ message: 'Following resumed', follower })
  } catch (error) {
    res.status(500).json({ message: 'Error resuming follow', error: error.message })
  }
})

// PUT /api/copy/follow/:id/stop - Stop following
router.put('/follow/:id/stop', async (req, res) => {
  try {
    const follower = await CopyFollower.findById(req.params.id)
    if (!follower) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    follower.status = 'STOPPED'
    follower.stoppedAt = new Date()
    await follower.save()

    // Update master stats
    const master = await MasterTrader.findById(follower.masterId)
    if (master && follower.status === 'ACTIVE') {
      master.stats.activeFollowers -= 1
      await master.save()
    }

    res.json({ message: 'Following stopped', follower })
  } catch (error) {
    res.status(500).json({ message: 'Error stopping follow', error: error.message })
  }
})

// PUT /api/copy/follow/:id/update - Update subscription settings (account, copy mode, etc.)
router.put('/follow/:id/update', async (req, res) => {
  try {
    const { followerAccountId, copyMode, copyValue } = req.body
    const follower = await CopyFollower.findById(req.params.id)
    
    if (!follower) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    // Update fields if provided
    if (followerAccountId) {
      // Validate the new account belongs to the same user
      const account = await TradingAccount.findById(followerAccountId)
      if (!account || account.userId.toString() !== follower.followerId.toString()) {
        return res.status(400).json({ message: 'Invalid trading account' })
      }
      follower.followerAccountId = followerAccountId
    }

    if (copyMode) {
      if (!['FIXED_LOT', 'BALANCE_BASED', 'EQUITY_BASED', 'MULTIPLIER', 'LOT_MULTIPLIER', 'AUTO'].includes(copyMode)) {
        return res.status(400).json({ message: 'Invalid copy mode' })
      }
      follower.copyMode = copyMode
    }

    if (copyValue !== undefined) {
      const mode = copyMode || follower.copyMode
      if (mode === 'FIXED_LOT') {
        follower.fixedLotSize = parseFloat(copyValue)
        follower.copyValue = parseFloat(copyValue)
      } else if (mode === 'MULTIPLIER' || mode === 'LOT_MULTIPLIER') {
        follower.multiplier = parseFloat(copyValue)
        follower.copyValue = parseFloat(copyValue)
      } else {
        // BALANCE_BASED, EQUITY_BASED - copyValue is maxLotSize
        follower.maxLotSize = parseFloat(copyValue)
        follower.copyValue = parseFloat(copyValue)
      }
    }

    await follower.save()

    res.json({ 
      success: true, 
      message: 'Subscription updated successfully', 
      follower 
    })
  } catch (error) {
    res.status(500).json({ message: 'Error updating subscription', error: error.message })
  }
})

// DELETE /api/copy/follow/:id/unfollow - Completely unfollow a master
router.delete('/follow/:id/unfollow', async (req, res) => {
  try {
    const follower = await CopyFollower.findById(req.params.id)
    
    if (!follower) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    const masterId = follower.masterId

    // Delete the follower record
    await CopyFollower.findByIdAndDelete(req.params.id)

    // Update master stats
    const master = await MasterTrader.findById(masterId)
    if (master) {
      master.stats.totalFollowers = Math.max(0, (master.stats.totalFollowers || 1) - 1)
      master.stats.activeFollowers = Math.max(0, (master.stats.activeFollowers || 1) - 1)
      await master.save()
    }

    res.json({ 
      success: true, 
      message: 'Successfully unfollowed master' 
    })
  } catch (error) {
    res.status(500).json({ message: 'Error unfollowing', error: error.message })
  }
})

// GET /api/copy/my-subscriptions/:userId - Get user's copy subscriptions
router.get('/my-subscriptions/:userId', async (req, res) => {
  try {
    const subscriptions = await CopyFollower.find({ followerId: req.params.userId })
      .populate('masterId', 'displayName stats approvedCommissionPercentage')
      .populate('followerAccountId', 'accountId balance')
      .sort({ createdAt: -1 })

    // Calculate actual profit/loss for each subscription from copy trades
    const subscriptionsWithStats = await Promise.all(subscriptions.map(async (sub) => {
      const subObj = sub.toObject()
      
      // Get all copy trades for this subscription
      const copyTrades = await CopyTrade.find({
        followerUserId: req.params.userId,
        masterId: sub.masterId?._id
      })

      let totalProfit = 0
      let totalLoss = 0
      let totalCopiedTrades = copyTrades.length
      let openTrades = 0
      let closedTrades = 0

      copyTrades.forEach(trade => {
        if (trade.status === 'CLOSED') {
          closedTrades++
          const pnl = trade.followerPnl || 0
          if (pnl >= 0) {
            totalProfit += pnl
          } else {
            totalLoss += Math.abs(pnl)
          }
        } else if (trade.status === 'OPEN') {
          openTrades++
        }
      })

      // Update stats with actual calculated values
      subObj.stats = {
        ...subObj.stats,
        totalCopiedTrades,
        totalProfit,
        totalLoss,
        netPnl: totalProfit - totalLoss,
        openTrades,
        closedTrades
      }

      return subObj
    }))

    res.json({ subscriptions: subscriptionsWithStats })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscriptions', error: error.message })
  }
})

// GET /api/copy/my-copy-trades/:userId - Get user's copied trades
router.get('/my-copy-trades/:userId', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query

    const query = { followerUserId: req.params.userId }
    if (status) query.status = status

    const copyTrades = await CopyTrade.find(query)
      .populate('masterId', 'displayName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))

    res.json({ copyTrades })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching copy trades', error: error.message })
  }
})

// GET /api/copy/my-followers/:masterId - Get followers for a master trader
router.get('/my-followers/:masterId', async (req, res) => {
  try {
    const followers = await CopyFollower.find({ masterId: req.params.masterId })
      .populate('followerId', 'firstName lastName email')
      .populate('followerAccountId', 'accountId balance')
      .sort({ createdAt: -1 })

    res.json({ followers })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching followers', error: error.message })
  }
})

// ==================== ADMIN ROUTES ====================

// GET /api/copy/admin/applications - Get pending master applications
router.get('/admin/applications', async (req, res) => {
  try {
    const applications = await MasterTrader.find({ status: 'PENDING' })
      .populate('userId', 'firstName lastName email')
      .populate('tradingAccountId', 'accountId balance')
      .sort({ createdAt: -1 })

    res.json({ applications })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message })
  }
})

// PUT /api/copy/admin/approve/:id - Approve master application
router.put('/admin/approve/:id', async (req, res) => {
  try {
    const { adminId, approvedCommissionPercentage, visibility, adminSharePercentage } = req.body

    const master = await MasterTrader.findById(req.params.id)
    if (!master) {
      return res.status(404).json({ message: 'Application not found' })
    }

    if (master.status !== 'PENDING') {
      return res.status(400).json({ message: 'Application already processed' })
    }

    master.status = 'ACTIVE'
    master.approvedCommissionPercentage = approvedCommissionPercentage || master.requestedCommissionPercentage
    master.visibility = visibility || 'PUBLIC'
    master.adminSharePercentage = adminSharePercentage || 30
    master.approvedBy = adminId
    master.approvedAt = new Date()
    await master.save()

    res.json({ message: 'Master approved successfully', master })
  } catch (error) {
    res.status(500).json({ message: 'Error approving master', error: error.message })
  }
})

// PUT /api/copy/admin/reject/:id - Reject master application
router.put('/admin/reject/:id', async (req, res) => {
  try {
    const { adminId, rejectionReason } = req.body

    const master = await MasterTrader.findById(req.params.id)
    if (!master) {
      return res.status(404).json({ message: 'Application not found' })
    }

    master.status = 'REJECTED'
    master.rejectedBy = adminId
    master.rejectedAt = new Date()
    master.rejectionReason = rejectionReason
    await master.save()

    res.json({ message: 'Master rejected', master })
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting master', error: error.message })
  }
})

// PUT /api/copy/admin/suspend/:id - Suspend master
router.put('/admin/suspend/:id', async (req, res) => {
  try {
    const { adminId, reason, currentPrices } = req.body

    const master = await MasterTrader.findById(req.params.id)
    if (!master) {
      return res.status(404).json({ message: 'Master not found' })
    }

    // Close all follower trades if prices provided
    let closedTrades = []
    if (currentPrices) {
      closedTrades = await copyTradingEngine.closeAllMasterFollowerTrades(master._id, currentPrices)
    }

    master.status = 'SUSPENDED'
    await master.save()

    res.json({ 
      message: 'Master suspended', 
      master,
      closedTrades: closedTrades.length
    })
  } catch (error) {
    res.status(500).json({ message: 'Error suspending master', error: error.message })
  }
})

// GET /api/copy/admin/masters - Get all masters (admin view)
router.get('/admin/masters', async (req, res) => {
  try {
    const masters = await MasterTrader.find()
      .populate('userId', 'firstName lastName email')
      .populate('tradingAccountId', 'accountId balance')
      .sort({ createdAt: -1 })

    res.json({ masters })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching masters', error: error.message })
  }
})

// GET /api/copy/admin/followers - Get all followers (admin view)
router.get('/admin/followers', async (req, res) => {
  try {
    const followers = await CopyFollower.find()
      .populate('followerId', 'firstName lastName email')
      .populate('masterId', 'displayName')
      .populate('followerAccountId', 'accountId balance')
      .sort({ createdAt: -1 })

    res.json({ followers })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching followers', error: error.message })
  }
})

// GET /api/copy/admin/commissions - Get commission records
router.get('/admin/commissions', async (req, res) => {
  try {
    const { status, tradingDay, limit = 100 } = req.query

    const query = {}
    if (status) query.status = status
    if (tradingDay) query.tradingDay = tradingDay

    const commissions = await CopyCommission.find(query)
      .populate('masterId', 'displayName')
      .populate('followerUserId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))

    // Calculate totals
    const totals = await CopyCommission.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$totalCommission' },
          totalAdminShare: { $sum: '$adminShare' },
          totalMasterShare: { $sum: '$masterShare' }
        }
      }
    ])

    res.json({ 
      commissions,
      totals: totals[0] || { totalCommission: 0, totalAdminShare: 0, totalMasterShare: 0 }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching commissions', error: error.message })
  }
})

// POST /api/copy/admin/calculate-daily-commission - Trigger daily commission calculation
router.post('/admin/calculate-daily-commission', async (req, res) => {
  try {
    const { tradingDay } = req.body
    const results = await copyTradingEngine.calculateDailyCommission(tradingDay)

    res.json({
      message: 'Daily commission calculated',
      results,
      processed: results.length
    })
  } catch (error) {
    res.status(500).json({ message: 'Error calculating commission', error: error.message })
  }
})

// GET /api/copy/admin/settings - Get copy trading settings
router.get('/admin/settings', async (req, res) => {
  try {
    const settings = await CopySettings.getSettings()
    res.json({ settings })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings', error: error.message })
  }
})

// PUT /api/copy/admin/settings - Update copy trading settings
router.put('/admin/settings', async (req, res) => {
  try {
    const settings = await CopySettings.getSettings()
    
    const { masterRequirements, commissionSettings, copyLimits, isEnabled, allowNewMasterApplications, allowNewFollowers } = req.body

    if (masterRequirements) settings.masterRequirements = { ...settings.masterRequirements, ...masterRequirements }
    if (commissionSettings) settings.commissionSettings = { ...settings.commissionSettings, ...commissionSettings }
    if (copyLimits) settings.copyLimits = { ...settings.copyLimits, ...copyLimits }
    if (isEnabled !== undefined) settings.isEnabled = isEnabled
    if (allowNewMasterApplications !== undefined) settings.allowNewMasterApplications = allowNewMasterApplications
    if (allowNewFollowers !== undefined) settings.allowNewFollowers = allowNewFollowers

    await settings.save()

    res.json({ message: 'Settings updated', settings })
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error: error.message })
  }
})

// GET /api/copy/admin/dashboard - Get admin dashboard stats
router.get('/admin/dashboard', async (req, res) => {
  try {
    const settings = await CopySettings.getSettings()

    const [
      totalMasters,
      activeMasters,
      pendingApplications,
      totalFollowers,
      activeFollowers,
      totalCopyTrades,
      openCopyTrades
    ] = await Promise.all([
      MasterTrader.countDocuments(),
      MasterTrader.countDocuments({ status: 'ACTIVE' }),
      MasterTrader.countDocuments({ status: 'PENDING' }),
      CopyFollower.countDocuments(),
      CopyFollower.countDocuments({ status: 'ACTIVE' }),
      CopyTrade.countDocuments(),
      CopyTrade.countDocuments({ status: 'OPEN' })
    ])

    // Today's stats
    const today = new Date().toISOString().split('T')[0]
    const todayCommissions = await CopyCommission.aggregate([
      { $match: { tradingDay: today } },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$totalCommission' },
          adminShare: { $sum: '$adminShare' },
          masterShare: { $sum: '$masterShare' }
        }
      }
    ])

    res.json({
      dashboard: {
        masters: {
          total: totalMasters,
          active: activeMasters,
          pending: pendingApplications
        },
        followers: {
          total: totalFollowers,
          active: activeFollowers
        },
        copyTrades: {
          total: totalCopyTrades,
          open: openCopyTrades
        },
        adminPool: settings.adminCopyPool,
        todayCommissions: todayCommissions[0] || { totalCommission: 0, adminShare: 0, masterShare: 0 }
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard', error: error.message })
  }
})

// ==================== MASTER TRADE HISTORY & STATS ====================

// GET /api/copy/master/:id/trades - Get master's trade history
router.get('/master/:id/trades', async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 50, status = 'all' } = req.query

    const master = await MasterTrader.findById(id)
    if (!master) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const query = { tradingAccountId: master.tradingAccountId }
    if (status !== 'all') {
      query.status = status.toUpperCase()
    }

    const trades = await Trade.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('symbol side quantity openPrice closePrice realizedPnl status openedAt closedAt')

    // Calculate trade statistics
    const closedTrades = trades.filter(t => t.status === 'CLOSED')
    const profitableTrades = closedTrades.filter(t => t.realizedPnl > 0)
    const losingTrades = closedTrades.filter(t => t.realizedPnl < 0)

    res.json({
      trades,
      stats: {
        total: trades.length,
        closed: closedTrades.length,
        profitable: profitableTrades.length,
        losing: losingTrades.length,
        winRate: closedTrades.length > 0 ? ((profitableTrades.length / closedTrades.length) * 100).toFixed(1) : 0
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trades', error: error.message })
  }
})

// GET /api/copy/master/:id/detailed-stats - Get detailed master statistics
router.get('/master/:id/detailed-stats', async (req, res) => {
  try {
    const { id } = req.params

    const master = await MasterTrader.findById(id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('tradingAccountId', 'balance')

    if (!master) {
      return res.status(404).json({ message: 'Master not found' })
    }

    // Get all closed trades for this master
    const closedTrades = await Trade.find({
      tradingAccountId: master.tradingAccountId,
      status: 'CLOSED'
    }).select('realizedPnl closedAt symbol side quantity')

    // Calculate detailed stats
    let totalProfit = 0
    let totalLoss = 0
    let maxProfit = 0
    let maxLoss = 0
    let profitableTrades = 0
    let losingTrades = 0

    closedTrades.forEach(trade => {
      const pnl = trade.realizedPnl || 0
      if (pnl > 0) {
        totalProfit += pnl
        profitableTrades++
        if (pnl > maxProfit) maxProfit = pnl
      } else if (pnl < 0) {
        totalLoss += Math.abs(pnl)
        losingTrades++
        if (Math.abs(pnl) > maxLoss) maxLoss = Math.abs(pnl)
      }
    })

    const totalTrades = closedTrades.length
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0
    const netProfit = totalProfit - totalLoss
    const avgTradeProfit = totalTrades > 0 ? netProfit / totalTrades : 0

    // Calculate overall performance (% return based on initial balance assumption)
    const accountBalance = master.tradingAccountId?.balance || 1000
    const overallPerformance = (netProfit / accountBalance) * 100

    // Get current active copiers
    const currentCopiers = await CopyFollower.countDocuments({
      masterId: id,
      status: 'ACTIVE'
    })

    // Get ratings
    const ratings = await MasterRating.find({ masterId: id })
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0

    res.json({
      master: {
        _id: master._id,
        displayName: master.displayName,
        description: master.description,
        profileImage: master.profileImage,
        approvedCommissionPercentage: master.approvedCommissionPercentage,
        visibility: master.visibility,
        createdAt: master.createdAt
      },
      stats: {
        totalTrades,
        profitableTrades,
        losingTrades,
        winRate: winRate.toFixed(1),
        totalProfit: totalProfit.toFixed(2),
        totalLoss: totalLoss.toFixed(2),
        netProfit: netProfit.toFixed(2),
        maxProfit: maxProfit.toFixed(2),
        maxLoss: maxLoss.toFixed(2),
        avgTradeProfit: avgTradeProfit.toFixed(2),
        overallPerformance: overallPerformance.toFixed(2),
        currentCopiers,
        totalFollowers: master.stats.totalFollowers
      },
      rating: {
        average: avgRating.toFixed(1),
        totalRatings: ratings.length
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message })
  }
})

// ==================== RATING SYSTEM ====================

// POST /api/copy/master/:id/rate - Rate a master trader
router.post('/master/:id/rate', async (req, res) => {
  try {
    const { id } = req.params
    const { userId, rating, review } = req.body

    if (!userId || !rating) {
      return res.status(400).json({ message: 'userId and rating are required' })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' })
    }

    const master = await MasterTrader.findById(id)
    if (!master) {
      return res.status(404).json({ message: 'Master not found' })
    }

    // Check if user is following this master (only followers can rate)
    const isFollower = await CopyFollower.findOne({
      masterId: id,
      followerId: userId
    })

    if (!isFollower) {
      return res.status(400).json({ message: 'Only followers can rate a master' })
    }

    // Check if user already rated
    const existingRating = await MasterRating.findOne({ masterId: id, userId })

    if (existingRating) {
      // Update existing rating
      const oldRating = existingRating.rating
      existingRating.rating = rating
      existingRating.review = review || ''
      await existingRating.save()

      // Update master's average rating
      master.rating.totalScore = master.rating.totalScore - oldRating + rating
      master.rating.average = master.rating.totalScore / master.rating.totalRatings
      await master.save()

      return res.json({
        message: 'Rating updated successfully',
        rating: existingRating,
        masterRating: master.rating
      })
    }

    // Create new rating
    const newRating = await MasterRating.create({
      masterId: id,
      userId,
      rating,
      review: review || ''
    })

    // Update master's rating stats
    master.rating.totalRatings += 1
    master.rating.totalScore += rating
    master.rating.average = master.rating.totalScore / master.rating.totalRatings
    await master.save()

    res.status(201).json({
      message: 'Rating submitted successfully',
      rating: newRating,
      masterRating: master.rating
    })
  } catch (error) {
    res.status(500).json({ message: 'Error submitting rating', error: error.message })
  }
})

// GET /api/copy/master/:id/ratings - Get all ratings for a master
router.get('/master/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 20 } = req.query

    const ratings = await MasterRating.find({ masterId: id })
      .populate('userId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))

    const master = await MasterTrader.findById(id).select('rating')

    res.json({
      ratings,
      summary: master?.rating || { average: 0, totalRatings: 0 }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ratings', error: error.message })
  }
})

// DELETE /api/copy/master/:id/rate/:userId - Delete a rating
router.delete('/master/:id/rate/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params

    const rating = await MasterRating.findOneAndDelete({ masterId: id, userId })
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' })
    }

    // Update master's rating stats
    const master = await MasterTrader.findById(id)
    if (master) {
      master.rating.totalRatings -= 1
      master.rating.totalScore -= rating.rating
      master.rating.average = master.rating.totalRatings > 0 
        ? master.rating.totalScore / master.rating.totalRatings 
        : 0
      await master.save()
    }

    res.json({ message: 'Rating deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting rating', error: error.message })
  }
})

// POST /api/copy/master/:id/update-stats - Recalculate and update master stats
router.post('/master/:id/update-stats', async (req, res) => {
  try {
    const { id } = req.params

    const master = await MasterTrader.findById(id)
    if (!master) {
      return res.status(404).json({ message: 'Master not found' })
    }

    // Get all closed trades
    const closedTrades = await Trade.find({
      tradingAccountId: master.tradingAccountId,
      status: 'CLOSED'
    })

    let totalProfit = 0
    let totalLoss = 0
    let maxProfit = 0
    let maxLoss = 0
    let profitableTrades = 0
    let losingTrades = 0

    closedTrades.forEach(trade => {
      const pnl = trade.realizedPnl || 0
      if (pnl > 0) {
        totalProfit += pnl
        profitableTrades++
        if (pnl > maxProfit) maxProfit = pnl
      } else if (pnl < 0) {
        totalLoss += Math.abs(pnl)
        losingTrades++
        if (Math.abs(pnl) > maxLoss) maxLoss = Math.abs(pnl)
      }
    })

    const totalTrades = closedTrades.length
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0
    const netProfit = totalProfit - totalLoss
    const avgTradeProfit = totalTrades > 0 ? netProfit / totalTrades : 0

    // Get account balance for performance calculation
    const account = await TradingAccount.findById(master.tradingAccountId)
    const accountBalance = account?.balance || 1000
    const overallPerformance = (netProfit / accountBalance) * 100

    // Get current copiers
    const currentCopiers = await CopyFollower.countDocuments({
      masterId: id,
      status: 'ACTIVE'
    })

    // Update master stats
    master.stats.totalTrades = totalTrades
    master.stats.profitableTrades = profitableTrades
    master.stats.losingTrades = losingTrades
    master.stats.winRate = winRate
    master.stats.totalProfitGenerated = totalProfit
    master.stats.totalLossGenerated = totalLoss
    master.stats.maxProfit = maxProfit
    master.stats.maxLoss = maxLoss
    master.stats.avgTradeProfit = avgTradeProfit
    master.stats.overallPerformance = overallPerformance
    master.stats.currentCopiers = currentCopiers

    await master.save()

    res.json({
      message: 'Stats updated successfully',
      stats: master.stats
    })
  } catch (error) {
    res.status(500).json({ message: 'Error updating stats', error: error.message })
  }
})

export default router
