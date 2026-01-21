import User from '../models/User.js'
import ReferralIncomePlan from '../models/ReferralIncomePlan.js'
import DirectJoiningPlan from '../models/DirectJoiningPlan.js'
import ReferralCommission from '../models/ReferralCommission.js'
import IBWallet from '../models/IBWallet.js'

class ReferralEngine {
  constructor() {
    this.CONTRACT_SIZES = {
      'XAUUSD': 100,
      'XAGUSD': 5000,
      'BTCUSD': 1,
      'ETHUSD': 1,
      'DEFAULT_FOREX': 100000,
      'DEFAULT_CRYPTO': 1
    }
  }

  getContractSize(symbol) {
    if (this.CONTRACT_SIZES[symbol]) return this.CONTRACT_SIZES[symbol]
    if (symbol.includes('BTC') || symbol.includes('ETH')) {
      return this.CONTRACT_SIZES.DEFAULT_CRYPTO
    }
    return this.CONTRACT_SIZES.DEFAULT_FOREX
  }

  async generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code
    let exists = true
    
    while (exists) {
      code = 'REF'
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      exists = await User.findOne({ referralCode: code })
    }
    
    return code
  }

  async ensureUserHasReferralCode(userId) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')
    
    if (!user.referralCode) {
      user.referralCode = await this.generateReferralCode()
      await user.save()
    }
    
    return user.referralCode
  }

  async getReferralChain(userId, maxLevels = 18) {
    const chain = []
    let currentUser = await User.findById(userId)
    
    if (!currentUser) return chain

    let parentId = currentUser.parentIBId
    let level = 1

    while (parentId && level <= maxLevels) {
      const parentUser = await User.findById(parentId)
      
      if (!parentUser) break

      chain.push({
        user: parentUser,
        level
      })

      parentId = parentUser.parentIBId
      level++
    }

    return chain
  }

  async processReferralIncome(trade) {
    console.log(`Processing Referral Income for trade ${trade.tradeId || trade._id}`)
    
    const plan = await ReferralIncomePlan.getActivePlan()
    if (!plan || !plan.isActive) {
      console.log('No active Referral Income Plan found')
      return { processed: false, reason: 'No active plan' }
    }

    const chain = await this.getReferralChain(trade.userId, plan.maxLevels)
    
    if (chain.length === 0) {
      console.log('No referral chain found for trader')
      return { processed: false, reason: 'No referral chain' }
    }

    const results = []

    for (const { user, level } of chain) {
      try {
        if (level > plan.maxLevels) continue

        const amount = plan.getAmountForLevel(level)
        if (amount <= 0) continue

        const existingCommission = await ReferralCommission.findOne({
          tradeId: trade._id,
          recipientUserId: user._id,
          level,
          commissionType: 'REFERRAL_INCOME'
        })
        
        if (existingCommission) {
          console.log(`Commission already exists for trade ${trade._id} level ${level}`)
          continue
        }

        const commissionAmount = trade.quantity * amount

        const commission = await ReferralCommission.create({
          recipientUserId: user._id,
          sourceUserId: trade.userId,
          tradeId: trade._id,
          level,
          commissionType: 'REFERRAL_INCOME',
          baseAmount: trade.quantity,
          rate: amount,
          commissionAmount,
          symbol: trade.symbol,
          lotSize: trade.quantity,
          description: `Level ${level} referral income from ${trade.symbol} trade`
        })

        const wallet = await IBWallet.getOrCreateWallet(user._id)
        await wallet.creditCommission(commissionAmount)

        results.push({
          userId: user._id,
          userName: user.firstName,
          level,
          amount: commissionAmount
        })

        console.log(`Referral Income: Level ${level} - ${user.firstName} earned $${commissionAmount.toFixed(2)}`)

      } catch (error) {
        console.error(`Error processing referral income level ${level}:`, error)
      }
    }

    return {
      processed: true,
      commissionsGenerated: results.length,
      results
    }
  }

  async processDirectJoiningIncome(newUserId, depositAmount) {
    console.log(`Processing Direct Joining Income for user ${newUserId}, deposit: $${depositAmount}`)
    
    const plan = await DirectJoiningPlan.getActivePlan()
    if (!plan || !plan.isActive) {
      console.log('No active Direct Joining Plan found')
      return { processed: false, reason: 'No active plan' }
    }

    const chain = await this.getReferralChain(newUserId, plan.maxLevels)
    
    if (chain.length === 0) {
      console.log('No referral chain found for new user')
      return { processed: false, reason: 'No referral chain' }
    }

    const results = []

    for (const { user, level } of chain) {
      try {
        if (level > plan.maxLevels) continue

        const percentage = plan.getPercentageForLevel(level)
        if (percentage <= 0) continue

        const commissionAmount = (depositAmount * percentage) / 100

        const commission = await ReferralCommission.create({
          recipientUserId: user._id,
          sourceUserId: newUserId,
          tradeId: null,
          level,
          commissionType: 'DIRECT_JOINING',
          baseAmount: depositAmount,
          rate: percentage,
          commissionAmount,
          description: `Level ${level} direct joining income (${percentage}% of $${depositAmount})`
        })

        const wallet = await IBWallet.getOrCreateWallet(user._id)
        await wallet.creditCommission(commissionAmount)

        results.push({
          userId: user._id,
          userName: user.firstName,
          level,
          percentage,
          amount: commissionAmount
        })

        console.log(`Direct Joining: Level ${level} - ${user.firstName} earned $${commissionAmount.toFixed(2)} (${percentage}%)`)

      } catch (error) {
        console.error(`Error processing direct joining income level ${level}:`, error)
      }
    }

    return {
      processed: true,
      commissionsGenerated: results.length,
      totalDistributed: results.reduce((sum, r) => sum + r.amount, 0),
      results
    }
  }

  async registerWithReferral(userId, referralCode) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    const referringUser = await User.findOne({ referralCode })
    
    if (!referringUser) {
      throw new Error('Invalid referral code')
    }

    user.referredBy = referralCode
    user.parentIBId = referringUser._id
    await user.save()

    return { user, referringUser }
  }

  async getUserReferralStats(userId) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    await this.ensureUserHasReferralCode(userId)

    const directReferrals = await User.countDocuments({ parentIBId: userId })

    const wallet = await IBWallet.getOrCreateWallet(userId)

    const referralIncomeStats = await ReferralCommission.aggregate([
      { $match: { recipientUserId: user._id, commissionType: 'REFERRAL_INCOME', status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
    ])

    const joiningIncomeStats = await ReferralCommission.aggregate([
      { $match: { recipientUserId: user._id, commissionType: 'DIRECT_JOINING', status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
    ])

    const levelWiseStats = await ReferralCommission.aggregate([
      { $match: { recipientUserId: user._id, status: 'CREDITED' } },
      { $group: { _id: { level: '$level', type: '$commissionType' }, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.level': 1 } }
    ])

    return {
      referralCode: user.referralCode,
      referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${user.referralCode}`,
      directReferrals,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn
      },
      referralIncome: {
        total: referralIncomeStats[0]?.total || 0,
        count: referralIncomeStats[0]?.count || 0
      },
      joiningIncome: {
        total: joiningIncomeStats[0]?.total || 0,
        count: joiningIncomeStats[0]?.count || 0
      },
      levelWiseStats
    }
  }

  async getDownlineTree(userId, maxDepth = 5) {
    const result = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      {
        $graphLookup: {
          from: 'users',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentIBId',
          as: 'downlines',
          maxDepth: maxDepth - 1,
          depthField: 'level'
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          email: 1,
          referralCode: 1,
          downlines: {
            _id: 1,
            firstName: 1,
            email: 1,
            referralCode: 1,
            parentIBId: 1,
            level: 1,
            createdAt: 1
          }
        }
      }
    ])

    return result[0] || null
  }

  async getCommissionHistory(userId, page = 1, limit = 50, type = null) {
    const query = { recipientUserId: userId }
    if (type) query.commissionType = type

    const skip = (page - 1) * limit

    const [commissions, total] = await Promise.all([
      ReferralCommission.find(query)
        .populate('sourceUserId', 'firstName email')
        .populate('tradeId', 'tradeId symbol quantity')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferralCommission.countDocuments(query)
    ])

    return {
      commissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }
}

import mongoose from 'mongoose'

export default new ReferralEngine()
