import mongoose from 'mongoose'

const accountTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  minDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  leverage: {
    type: String,
    required: true,
    default: '1:100'
  },
  exposureLimit: {
    type: Number,
    default: 0
  },
  minSpread: {
    type: Number,
    default: 0
  },
  commission: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDemo: {
    type: Boolean,
    default: false
  },
  demoBalance: {
    type: Number,
    default: 10000
  },
  // Algo account: balance is locked for `algoLockDays` after the account is
  // opened. While locked, the user cannot trade or withdraw from it. After the
  // lock expires, both trading and withdrawals unlock.
  isAlgo: {
    type: Boolean,
    default: false
  },
  algoLockDays: {
    type: Number,
    default: 90
  },
  // Monthly ROI target range advertised for an Algo account (informational —
  // shown to the user, not used in PnL calculations).
  algoRoiMin: {
    type: Number,
    default: 2
  },
  algoRoiMax: {
    type: Number,
    default: 5
  }
}, { timestamps: true })

export default mongoose.model('AccountType', accountTypeSchema)
