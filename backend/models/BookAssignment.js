import mongoose from 'mongoose'

const bookAssignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tradingAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingAccount',
    default: null
  },
  bookType: {
    type: String,
    enum: ['A_BOOK', 'B_BOOK'],
    default: 'B_BOOK'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  autoAssignRule: {
    type: String,
    enum: ['MANUAL', 'PROFIT_BASED', 'VOLUME_BASED', 'EQUITY_BASED'],
    default: 'MANUAL'
  },
  thresholds: {
    profitThreshold: { type: Number, default: 1000 },
    volumeThreshold: { type: Number, default: 100 },
    equityThreshold: { type: Number, default: 10000 }
  },
  stats: {
    totalTrades: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true })

// Index for quick lookups
bookAssignmentSchema.index({ userId: 1 })
bookAssignmentSchema.index({ tradingAccountId: 1 })
bookAssignmentSchema.index({ bookType: 1 })

// Static method to get a user's book type.
// Resolution order:
//   1. Account-specific assignment (highest priority) — admin overrode this
//      particular trading account.
//   2. User-level assignment (tradingAccountId is null) — admin assigned the
//      whole user; applies to all their accounts.
//   3. Default to B_BOOK.
// This two-step lookup is critical: when admin assigns at user level,
// queries that pass a trade's tradingAccountId would miss the assignment
// and incorrectly route trades to B-Book.
bookAssignmentSchema.statics.getBookType = async function(userId, tradingAccountId = null) {
  if (tradingAccountId) {
    const accountSpecific = await this.findOne({
      userId,
      tradingAccountId,
      isActive: true
    }).sort({ createdAt: -1 })
    if (accountSpecific) return accountSpecific.bookType
  }

  const userLevel = await this.findOne({
    userId,
    $or: [
      { tradingAccountId: null },
      { tradingAccountId: { $exists: false } }
    ],
    isActive: true
  }).sort({ createdAt: -1 })

  return userLevel?.bookType || 'B_BOOK'
}

// Static method to get all A-Book users
bookAssignmentSchema.statics.getABookUsers = async function() {
  return this.find({ bookType: 'A_BOOK', isActive: true })
    .populate('userId', 'firstName lastName email')
    .populate('tradingAccountId', 'accountNumber balance')
    .populate('assignedBy', 'name email')
}

// Static method to get all B-Book users
bookAssignmentSchema.statics.getBBookUsers = async function() {
  return this.find({ bookType: 'B_BOOK', isActive: true })
    .populate('userId', 'firstName lastName email')
    .populate('tradingAccountId', 'accountNumber balance')
    .populate('assignedBy', 'name email')
}

export default mongoose.model('BookAssignment', bookAssignmentSchema)
