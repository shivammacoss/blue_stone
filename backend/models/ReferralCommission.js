import mongoose from 'mongoose'

const referralCommissionSchema = new mongoose.Schema({
  recipientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sourceUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trade',
    default: null
  },
  level: {
    type: Number,
    required: true
  },
  commissionType: {
    type: String,
    enum: ['REFERRAL_INCOME', 'DIRECT_JOINING'],
    required: true
  },
  baseAmount: {
    type: Number,
    default: 0
  },
  rate: {
    type: Number,
    default: 0
  },
  commissionAmount: {
    type: Number,
    required: true,
    default: 0
  },
  symbol: {
    type: String,
    default: null
  },
  lotSize: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['CREDITED', 'PENDING', 'REVERSED'],
    default: 'CREDITED'
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

referralCommissionSchema.index({ recipientUserId: 1, createdAt: -1 })
referralCommissionSchema.index({ sourceUserId: 1 })
referralCommissionSchema.index({ tradeId: 1 })
referralCommissionSchema.index({ commissionType: 1 })

export default mongoose.model('ReferralCommission', referralCommissionSchema)
