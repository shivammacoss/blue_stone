import mongoose from 'mongoose'

const tradingAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountType',
    required: true
  },
  accountId: {
    type: String,
    unique: true,
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  credit: {
    type: Number,
    default: 0
  },
  leverage: {
    type: String,
    required: true
  },
  exposureLimit: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended', 'Closed', 'Frozen', 'Archived'],
    default: 'Active'
  },
  frozenReason: {
    type: String,
    default: ''
  },
  frozenAt: {
    type: Date,
    default: null
  },
  frozenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isDemo: {
    type: Boolean,
    default: false
  },
  // Algo account flag (mirrors the account type at creation time) and the
  // timestamp until which the account's balance is locked. While
  // `algoLockUntil` is in the future the user cannot trade or withdraw from
  // this account; once it passes, both unlock.
  isAlgo: {
    type: Boolean,
    default: false
  },
  algoLockUntil: {
    type: Date,
    default: null
  },
  // Locked principal (deposited capital) for an Algo account. While the lock is
  // active the user may withdraw only profit (balance − algoPrincipal); the
  // principal becomes withdrawable once the lock period completes. Grows with
  // each deposit into the account.
  algoPrincipal: {
    type: Number,
    default: 0
  }
}, { timestamps: true })

// Generate unique account ID (numbers only, 8 digits)
tradingAccountSchema.statics.generateAccountId = async function() {
  const random = Math.floor(10000000 + Math.random() * 90000000)
  const accountId = `${random}`
  const exists = await this.findOne({ accountId })
  if (exists) return this.generateAccountId()
  return accountId
}

export default mongoose.model('TradingAccount', tradingAccountSchema)
