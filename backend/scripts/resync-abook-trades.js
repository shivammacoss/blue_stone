/**
 * Re-sync A-Book trades to Corecen LP.
 *
 * Picks up any A-Book trade whose REST push failed or never happened
 * (lpSyncStatus FAILED / PENDING / missing) and retries. For trades that
 * were closed locally but never had their close propagated to LP, the script
 * pushes the open then the close.
 *
 * Usage: node scripts/resync-abook-trades.js
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Trade from '../models/Trade.js'
import User from '../models/User.js'
import * as lpIntegration from '../services/lpIntegration.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/BlueStone'

async function resyncTrades() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    if (!lpIntegration.isConfigured()) {
      console.error('LP Integration is not configured. Set LP_API_KEY and LP_API_SECRET in .env')
      process.exit(1)
    }

    console.log('LP Integration is configured')

    const failedTrades = await Trade.find({
      bookType: 'A_BOOK',
      $or: [
        { lpSyncStatus: 'FAILED' },
        { lpSyncStatus: 'PENDING' },
        { lpSyncStatus: { $exists: false } }
      ]
    }).populate('userId')

    console.log(`Found ${failedTrades.length} trades to re-sync`)

    let successCount = 0
    let failCount = 0

    for (const trade of failedTrades) {
      const user = trade.userId
      console.log(`\nRe-syncing trade: ${trade.tradeId} (${trade.symbol})`)

      try {
        if (trade.status === 'OPEN') {
          const result = await lpIntegration.pushTrade(trade, user)
          if (result.success) {
            trade.lpSyncStatus = 'SYNCED'
            trade.lpSyncedAt = new Date()
            trade.lpSyncError = null
            trade.lpRouted = true
            await trade.save()
            console.log('  ✓ Trade synced successfully')
            successCount++
          } else {
            trade.lpSyncStatus = 'FAILED'
            trade.lpSyncError = result.error
            await trade.save()
            console.log(`  ✗ Failed: ${result.error}`)
            failCount++
          }
        } else if (trade.status === 'CLOSED') {
          // Closed locally but never reached LP — push open, then close.
          const pushResult = await lpIntegration.pushTrade(trade, user)
          if (!pushResult.success) {
            console.log(`  ✗ Failed to push: ${pushResult.error}`)
            failCount++
            continue
          }
          const closeResult = await lpIntegration.closeTrade(trade)
          if (closeResult.success) {
            trade.lpSyncStatus = 'SYNCED'
            trade.lpSyncedAt = new Date()
            trade.lpCloseStatus = 'SYNCED'
            trade.lpCloseError = null
            await trade.save()
            console.log('  ✓ Trade synced and closed successfully')
            successCount++
          } else {
            trade.lpCloseStatus = 'FAILED'
            trade.lpCloseError = closeResult.error
            await trade.save()
            console.log(`  ✗ Push succeeded but close failed: ${closeResult.error}`)
            failCount++
          }
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`)
        failCount++
      }
    }

    console.log('\n========== Summary ==========')
    console.log(`Total trades: ${failedTrades.length}`)
    console.log(`Successful:   ${successCount}`)
    console.log(`Failed:       ${failCount}`)
    console.log('==============================')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
  }
}

resyncTrades()
