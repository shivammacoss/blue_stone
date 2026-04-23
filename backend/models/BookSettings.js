import mongoose from 'mongoose'

const bookSettingsSchema = new mongoose.Schema({
  defaultBookType: {
    type: String,
    enum: ['A_BOOK', 'B_BOOK'],
    default: 'B_BOOK'
  },
  autoAssignEnabled: {
    type: Boolean,
    default: false
  },
  autoAssignRules: {
    moveToABookOnProfit: {
      enabled: { type: Boolean, default: false },
      profitThreshold: { type: Number, default: 5000 }
    },
    moveToABookOnVolume: {
      enabled: { type: Boolean, default: false },
      volumeThreshold: { type: Number, default: 500 }
    },
    moveToABookOnEquity: {
      enabled: { type: Boolean, default: false },
      equityThreshold: { type: Number, default: 50000 }
    },
    moveToABookOnWinRate: {
      enabled: { type: Boolean, default: false },
      winRateThreshold: { type: Number, default: 60 },
      minTrades: { type: Number, default: 50 }
    }
  },
  aBookSettings: {
    liquidityProvider: { type: String, default: '' },
    markupPips: { type: Number, default: 0 },
    commissionPerLot: { type: Number, default: 7 }
  },
  bBookSettings: {
    maxExposurePerUser: { type: Number, default: 100000 },
    maxExposureTotal: { type: Number, default: 1000000 },
    hedgingEnabled: { type: Boolean, default: false }
  },
  riskManagement: {
    maxABookPercentage: { type: Number, default: 30 },
    alertOnHighExposure: { type: Boolean, default: true },
    exposureAlertThreshold: { type: Number, default: 500000 }
  }
}, { timestamps: true })

// Singleton pattern - only one settings document
bookSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne()
  if (!settings) {
    settings = await this.create({})
  }
  return settings
}

export default mongoose.model('BookSettings', bookSettingsSchema)
