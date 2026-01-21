import mongoose from 'mongoose'

const referralIncomePlanSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Referral Income Plan'
  },
  description: {
    type: String,
    default: 'Commission earned from copy trading network linked to master account'
  },
  maxLevels: {
    type: Number,
    default: 11,
    min: 1,
    max: 20
  },
  commissionType: {
    type: String,
    enum: ['PER_LOT', 'FIXED'],
    default: 'PER_LOT'
  },
  levels: [{
    level: {
      type: Number,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

referralIncomePlanSchema.statics.getActivePlan = async function() {
  let plan = await this.findOne({ isActive: true })
  if (!plan) {
    plan = await this.create({
      name: 'Referral Income Plan',
      maxLevels: 11,
      commissionType: 'PER_LOT',
      levels: [
        { level: 1, amount: 4 },
        { level: 2, amount: 3 },
        { level: 3, amount: 3 },
        { level: 4, amount: 2 },
        { level: 5, amount: 2 },
        { level: 6, amount: 1 },
        { level: 7, amount: 1 },
        { level: 8, amount: 0.5 },
        { level: 9, amount: 0.5 },
        { level: 10, amount: 0.5 },
        { level: 11, amount: 0.5 }
      ]
    })
  }
  return plan
}

referralIncomePlanSchema.methods.getAmountForLevel = function(level) {
  const levelConfig = this.levels.find(l => l.level === level)
  return levelConfig ? levelConfig.amount : 0
}

export default mongoose.model('ReferralIncomePlan', referralIncomePlanSchema)
