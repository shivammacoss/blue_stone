import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'TRADE_OPEN',
      'TRADE_CLOSE', 
      'STOP_LOSS_HIT',
      'TAKE_PROFIT_HIT',
      'PENDING_ORDER',
      'PENDING_TRIGGERED',
      'PENDING_CANCELLED',
      'MARGIN_CALL',
      'DEPOSIT',
      'WITHDRAWAL',
      'COPY_TRADE',
      'IB_COMMISSION',
      'SYSTEM'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
})

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, read: 1 })

export default mongoose.model('Notification', notificationSchema)
