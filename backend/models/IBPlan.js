import mongoose from 'mongoose'

const ibPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  // Maximum levels for commission distribution (increased to 50)
  maxLevels: {
    type: Number,
    required: true,
    min: 1,
    max: 50,
    default: 5
  },
  // Commission type
  commissionType: {
    type: String,
    enum: ['PER_LOT', 'PERCENTAGE'],
    default: 'PER_LOT'
  },
  // Level-wise commission rates (dynamic array for unlimited levels)
  levelCommissions: [{
    level: { type: Number, required: true },
    rate: { type: Number, default: 0 }
  }],
  // Legacy fixed levels (for backward compatibility)
  legacyLevelCommissions: {
    level1: { type: Number, default: 5 },
    level2: { type: Number, default: 3 },
    level3: { type: Number, default: 2 },
    level4: { type: Number, default: 1 },
    level5: { type: Number, default: 0.5 }
  },
  // Multiple commission types
  commissionTypes: {
    // First time joining commission
    firstJoin: {
      enabled: { type: Boolean, default: true },
      levels: [{
        level: { type: Number, required: true },
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['FIXED', 'PERCENT'], default: 'FIXED' }
      }]
    },
    // Continuous trade commission
    trade: {
      enabled: { type: Boolean, default: true },
      levels: [{
        level: { type: Number, required: true },
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['PER_LOT', 'PERCENT'], default: 'PER_LOT' }
      }]
    },
    // Referral commission (when downline refers someone)
    referral: {
      enabled: { type: Boolean, default: true },
      levels: [{
        level: { type: Number, required: true },
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['FIXED', 'PERCENT'], default: 'FIXED' }
      }]
    }
  },
  // Commission sources (which charges to share)
  commissionSources: {
    spread: { type: Boolean, default: true },
    commission: { type: Boolean, default: true },
    swap: { type: Boolean, default: false }
  },
  // Minimum requirements
  minWithdrawalAmount: {
    type: Number,
    default: 50
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true })

// Static method to get default plan
ibPlanSchema.statics.getDefaultPlan = async function() {
  let plan = await this.findOne({ isDefault: true, isActive: true })
  if (!plan) {
    plan = await this.findOne({ isActive: true })
  }
  return plan
}

export default mongoose.model('IBPlan', ibPlanSchema)
