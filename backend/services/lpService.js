/**
 * LP Service — Trade routing facade
 *
 * Public API consumed by tradeEngine.js (`routeTrade`, `closeOnLP`, etc.).
 * Decides A_BOOK vs B_BOOK using BookAssignment, then delegates the actual
 * LP REST work to lpIntegration.js and persists sync state on the Trade doc
 * so failed syncs can be retried by scripts/resync-abook-trades.js.
 */

import BookAssignment from '../models/BookAssignment.js'
import BookSettings from '../models/BookSettings.js'
import Trade from '../models/Trade.js'
import User from '../models/User.js'
import lpIntegration from './lpIntegration.js'
import corecenSocket from './corecenSocketClient.js'
import lpConnectionMonitor from './lpConnectionMonitor.js'
import mt5PushService from './mt5PushService.js'

class LPService {
  async isABookUser(userId, tradingAccountId = null) {
    try {
      const bookType = await BookAssignment.getBookType(userId, tradingAccountId)
      return bookType === 'A_BOOK'
    } catch (error) {
      console.error('[LP] Error checking book type:', error)
      return false
    }
  }

  // Called by tradeEngine on trade open. Stamps bookType + (for A_BOOK) pushes
  // the trade to Corecen via REST and records the sync state on the doc.
  async routeTrade(trade, userId, tradingAccountId) {
    const isABook = await this.isABookUser(userId, tradingAccountId)

    if (!isABook) {
      trade.bookType = 'B_BOOK'
      trade.lpRouted = false
      trade.lpSyncStatus = 'NOT_APPLICABLE'
      console.log(`[LP] B-BOOK TRADE - ${trade.symbol} ${trade.side} ${trade.quantity} (internal)`)
      return {
        success: true,
        routedTo: 'B_BOOK',
        lpConnected: false,
        message: 'Trade processed internally (B-Book)'
      }
    }

    trade.bookType = 'A_BOOK'

    const user = await User.findById(userId).catch(() => null)

    // Path selection:
    //   MT5_PUSH_ENABLED=true  → push directly to MT5 via MetaAPI (PRIMARY)
    //   else if Corecen creds  → push to Corecen REST (PRIMARY)
    //   else                   → mark PENDING for later retry
    if (mt5PushService.isPushConfigured()) {
      const result = await mt5PushService.pushTrade(trade, user)
      if (result.success) {
        trade.lpSyncStatus = 'SYNCED'
        trade.lpSyncedAt = new Date()
        trade.lpSyncError = null
        trade.lpRouted = true
        trade.mt5PositionId = result.mt5PositionId
        trade.mt5OrderId = result.mt5OrderId
        trade.mt5Symbol = result.mt5Symbol
        trade.lpOrderId = result.mt5PositionId // mirror for legacy callers
        console.log(`[LP] A-BOOK → MT5: ${trade.symbol} ${trade.side} ${trade.quantity} positionId=${result.mt5PositionId}`)
        return {
          success: true,
          routedTo: 'A_BOOK',
          venue: 'MT5',
          lpConnected: true,
          mt5PositionId: result.mt5PositionId,
          message: `Pushed to MT5 (positionId=${result.mt5PositionId})`
        }
      }
      trade.lpSyncStatus = 'FAILED'
      trade.lpSyncError = result.error || 'Unknown error'
      trade.lpRouted = false
      console.error(`[LP] MT5 push failed for ${trade.symbol}: ${result.error}`)
      return {
        success: true,
        routedTo: 'A_BOOK',
        venue: 'MT5',
        lpConnected: false,
        message: `MT5 push failed: ${result.error}`
      }
    }

    if (lpIntegration.isConfigured()) {
      const result = await lpIntegration.pushTrade(trade, user)
      if (result.success) {
        trade.lpSyncStatus = 'SYNCED'
        trade.lpSyncedAt = new Date()
        trade.lpSyncError = null
        trade.lpRouted = true
        if (result.lp_order_id || result.orderId) {
          trade.lpOrderId = result.lp_order_id || result.orderId
        }
        try { corecenSocket.emitTradeOpened(trade, user) } catch (_) {}
        console.log(`[LP] A-BOOK → Corecen: ${trade.symbol} ${trade.side} ${trade.quantity}`)
        return {
          success: true,
          routedTo: 'A_BOOK',
          venue: 'CORECEN',
          lpConnected: true,
          lpOrderId: trade.lpOrderId,
          message: 'Pushed to Corecen LP'
        }
      }
      trade.lpSyncStatus = 'FAILED'
      trade.lpSyncError = result.error || 'Unknown error'
      trade.lpRouted = false
      return {
        success: true,
        routedTo: 'A_BOOK',
        venue: 'CORECEN',
        lpConnected: false,
        message: `Corecen push failed: ${result.error}`
      }
    }

    // Nothing configured — local-only with retry hint.
    trade.lpSyncStatus = 'PENDING'
    trade.lpSyncError = 'No LP venue configured (set MT5_PUSH_ENABLED+METAAPI_* or LP_API_*)'
    return {
      success: true,
      routedTo: 'A_BOOK',
      lpConnected: false,
      message: 'Trade queued — no LP venue configured'
    }
  }

  // Called by tradeEngine on close. Only hits LP if the original open was
  // synced — lpSyncStatus is the source of truth, not the user's current book
  // (admin may have toggled them between open and close).
  async closeOnLP(trade) {
    if (trade.lpSyncStatus !== 'SYNCED') {
      return {
        success: true,
        routedTo: trade.bookType || 'B_BOOK',
        lpConnected: false,
        message: 'Trade was never synced to LP; nothing to close'
      }
    }

    trade.lpCloseAttemptedAt = new Date()

    // If trade was opened on MT5 (has positionId), close it on MT5. Otherwise
    // fall through to Corecen. We pick the venue based on the *original* push,
    // not the current config — config may have changed between open and close.
    if (trade.mt5PositionId) {
      const result = await mt5PushService.closeTrade(trade)
      if (result.success) {
        trade.lpCloseStatus = 'SYNCED'
        trade.lpCloseError = null
        return {
          success: true,
          routedTo: 'A_BOOK',
          venue: 'MT5',
          lpConnected: true,
          message: 'Close pushed to MT5'
        }
      }
      trade.lpCloseStatus = 'FAILED'
      trade.lpCloseError = result.error || 'Unknown error'
      return {
        success: false,
        routedTo: 'A_BOOK',
        venue: 'MT5',
        lpConnected: false,
        message: `MT5 close failed: ${result.error}`
      }
    }

    if (!lpIntegration.isConfigured()) {
      trade.lpCloseStatus = 'FAILED'
      trade.lpCloseError = 'No LP venue configured'
      return {
        success: false,
        routedTo: 'A_BOOK',
        lpConnected: false,
        message: 'No LP venue configured — close not propagated'
      }
    }

    const result = await lpIntegration.closeTrade(trade)
    if (result.success) {
      trade.lpCloseStatus = 'SYNCED'
      trade.lpCloseError = null
      try { corecenSocket.emitTradeClosed(trade) } catch (_) {}
      return {
        success: true,
        routedTo: 'A_BOOK',
        venue: 'CORECEN',
        lpConnected: true,
        message: 'Close pushed to Corecen LP'
      }
    }
    trade.lpCloseStatus = 'FAILED'
    trade.lpCloseError = result.error || 'Unknown error'
    return {
      success: false,
      routedTo: 'A_BOOK',
      venue: 'CORECEN',
      lpConnected: false,
      message: `Corecen close failed: ${result.error}`
    }
  }

  // Propagate SL/TP modifications to whichever venue holds the trade.
  async updateOnLP(trade) {
    if (trade.lpSyncStatus !== 'SYNCED') return { success: true, skipped: true }

    if (trade.mt5PositionId) {
      return await mt5PushService.updateTrade(trade)
    }
    if (!lpIntegration.isConfigured()) return { success: true, skipped: true }
    const result = await lpIntegration.updateTrade(trade)
    if (result.success) {
      try { corecenSocket.emitTradeUpdated(trade) } catch (_) {}
    }
    return result
  }

  getStatus() {
    const cfg = lpIntegration.getConfigStatus()
    const monitor = lpConnectionMonitor.getStatus()
    const mt5 = mt5PushService.getStatus()
    return {
      // Active venue — MT5 if configured, else Corecen.
      activeVenue: mt5.configured ? 'MT5' : (cfg.configured ? 'CORECEN' : 'NONE'),
      mt5: {
        enabled: mt5.enabled,
        configured: mt5.configured,
        connected: mt5.connected,
        accountId: mt5.accountId,
        lastError: mt5.lastError
      },
      corecen: {
        configured: cfg.configured,
        enabled: cfg.enabled,
        apiUrl: cfg.apiUrl,
        connected: monitor.connected,
        lastHeartbeat: monitor.lastHeartbeat,
        consecutiveFailures: monitor.consecutiveFailures
      },
      // Legacy flat fields preserved for existing callers.
      connected: mt5.configured ? mt5.connected : monitor.connected,
      configured: mt5.configured || cfg.configured
    }
  }

  async getRoutingStats() {
    const aBookCount = await BookAssignment.countDocuments({ bookType: 'A_BOOK', isActive: true })
    const bBookCount = await BookAssignment.countDocuments({ bookType: 'B_BOOK', isActive: true })
    const syncedTrades = await Trade.countDocuments({ bookType: 'A_BOOK', lpSyncStatus: 'SYNCED' })
    const failedTrades = await Trade.countDocuments({ bookType: 'A_BOOK', lpSyncStatus: 'FAILED' })
    const monitor = lpConnectionMonitor.getStatus()
    return {
      aBookUsers: aBookCount,
      bBookUsers: bBookCount,
      lpConnected: monitor.connected,
      lpProvider: 'Corecen',
      syncedTrades,
      failedTrades
    }
  }

  // Apply BookSettings (markup/commission) — informational for now; surfaced
  // by the admin dashboard. Actual LP execution uses Corecen's broker settings.
  async getSettingsSnapshot() {
    const settings = await BookSettings.getSettings()
    return settings
  }
}

export default new LPService()
