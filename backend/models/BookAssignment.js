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

// Static method to get user's book type
bookAssignmentSchema.statics.getBookType = async function(userId, tradingAccountId = null) {
  const query = { userId, isActive: true }
  if (tradingAccountId) {
    query.tradingAccountId = tradingAccountId
  }
  
  const assignment = await this.findOne(query).sort({ createdAt: -1 })
  return assignment?.bookType || 'B_BOOK'
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
