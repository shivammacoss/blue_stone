import mongoose from 'mongoose'

const directJoiningPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Direct Joining Income Plan'
  },
  description: {
    type: String,
    default: 'Commission earned when new users join through referral link'
  },
  totalDistribution: {
    type: Number,
    default: 90
  },
  maxLevels: {
    type: Number,
    default: 18,
    min: 1,
    max: 25
  },
  commissionType: {
    type: String,
    enum: ['PERCENT', 'FIXED'],
    default: 'PERCENT'
  },
  levels: [{
    level: {
      type: Number,
      required: true
    },
    percentage: {
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

directJoiningPlanSchema.statics.getActivePlan = async function() {
  let plan = await this.findOne({ isActive: true })
  if (!plan) {
    const levels = [
      { level: 1, percentage: 15 },
      { level: 2, percentage: 10 },
      { level: 3, percentage: 5 }
    ]
    for (let i = 4; i <= 18; i++) {
      levels.push({ level: i, percentage: 4 })
    }
    
    plan = await this.create({
      name: 'Direct Joining Income Plan',
      totalDistribution: 90,
      maxLevels: 18,
      commissionType: 'PERCENT',
      levels
    })
  }
  return plan
}

directJoiningPlanSchema.methods.getPercentageForLevel = function(level) {
  const levelConfig = this.levels.find(l => l.level === level)
  return levelConfig ? levelConfig.percentage : 0
}

export default mongoose.model('DirectJoiningPlan', directJoiningPlanSchema)
