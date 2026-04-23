import mongoose from 'mongoose'

const masterRatingSchema = new mongoose.Schema({
  masterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MasterTrader',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    default: ''
  }
}, { timestamps: true })

// One rating per user per master
masterRatingSchema.index({ masterId: 1, userId: 1 }, { unique: true })

export default mongoose.model('MasterRating', masterRatingSchema)
