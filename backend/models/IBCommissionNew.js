import mongoose from 'mongoose'

const ibCommissionSchema = new mongoose.Schema({
  tradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trade',
    default: null
  },
  traderUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ibUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // For referral bonus - the IB who made the referral
  referringIBId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  level: {
    type: Number,
    required: true
  },
  baseAmount: {
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
  tradeLotSize: {
    type: Number,
    default: null
  },
  contractSize: {
    type: Number,
    default: 100000
  },
  // Extended commission types
  commissionType: {
    type: String,
    enum: ['PER_LOT', 'PERCENT', 'TRADE', 'FIRST_JOIN', 'REFERRAL_BONUS'],
    required: true
  },
  status: {
    type: String,
    enum: ['CREDITED', 'REVERSED'],
    default: 'CREDITED'
  },
  reversedAt: {
    type: Date,
    default: null
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reversalReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

// Index for fast queries
ibCommissionSchema.index({ ibUserId: 1, createdAt: -1 })
ibCommissionSchema.index({ tradeId: 1 })
ibCommissionSchema.index({ traderUserId: 1 })

export default mongoose.model('IBCommission', ibCommissionSchema)
