import BookAssignment from '../models/BookAssignment.js'
import BookSettings from '../models/BookSettings.js'

class LPService {
  constructor() {
    this.connected = false
    this.lpConfig = null
  }

  // Initialize LP connection (to be implemented when LP is connected)
  async connect(config) {
    this.lpConfig = config
    // TODO: Implement actual LP connection
    // Example: Connect to LMAX, Currenex, PrimeXM, etc.
    console.log('[LP] LP Service initialized (pending connection)')
    this.connected = false // Set to true when actually connected
    return { success: true, message: 'LP Service ready for connection' }
  }

  // Check if user is A-Book
  async isABookUser(userId, tradingAccountId = null) {
    try {
      const bookType = await BookAssignment.getBookType(userId, tradingAccountId)
      return bookType === 'A_BOOK'
    } catch (error) {
      console.error('[LP] Error checking book type:', error)
      return false // Default to B-Book on error
    }
  }

  // Route trade to LP (A-Book) or keep internal (B-Book)
  async routeTrade(trade, userId, tradingAccountId) {
    const isABook = await this.isABookUser(userId, tradingAccountId)
    
    if (isABook) {
      return await this.sendToLP(trade)
    } else {
      return await this.processInternal(trade)
    }
  }

  // Send trade to Liquidity Provider (A-Book)
  async sendToLP(trade) {
    const settings = await BookSettings.getSettings()
    
    // Log A-Book trade for future LP integration
    console.log('[LP] A-BOOK TRADE - Routing to LP:', {
      tradeId: trade._id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.openPrice,
      userId: trade.userId,
      timestamp: new Date().toISOString()
    })

    if (!this.connected || !this.lpConfig) {
      // LP not connected yet - log for manual processing or future integration
      console.log('[LP] LP not connected - Trade logged for future routing')
      
      return {
        success: true,
        routedTo: 'A_BOOK',
        lpConnected: false,
        message: 'Trade logged for LP routing (LP pending connection)',
        tradeDetails: {
          tradeId: trade._id,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          openPrice: trade.openPrice,
          markup: settings.aBookSettings?.markupPips || 0,
          commission: settings.aBookSettings?.commissionPerLot || 7
        }
      }
    }

    // TODO: Implement actual LP API call when connected
    // Example structure for future implementation:
    /*
    try {
      const lpResponse = await this.lpClient.sendOrder({
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.openPrice + (settings.aBookSettings.markupPips * 0.0001),
        type: 'MARKET',
        clientOrderId: trade._id.toString()
      })
      
      return {
        success: true,
        routedTo: 'A_BOOK',
        lpConnected: true,
        lpOrderId: lpResponse.orderId,
        lpExecutionPrice: lpResponse.executionPrice,
        message: 'Trade sent to LP successfully'
      }
    } catch (error) {
      console.error('[LP] Error sending to LP:', error)
      // Fallback to B-Book on LP error
      return await this.processInternal(trade)
    }
    */

    return {
      success: true,
      routedTo: 'A_BOOK',
      lpConnected: false,
      message: 'Trade queued for LP (connection pending)'
    }
  }

  // Process trade internally (B-Book)
  async processInternal(trade) {
    console.log('[LP] B-BOOK TRADE - Processing internally:', {
      tradeId: trade._id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      userId: trade.userId
    })

    return {
      success: true,
      routedTo: 'B_BOOK',
      lpConnected: false,
      message: 'Trade processed internally (B-Book)'
    }
  }

  // Close trade on LP (for A-Book trades)
  async closeOnLP(trade) {
    const isABook = await this.isABookUser(trade.userId, trade.tradingAccountId)
    
    if (!isABook) {
      return { success: true, routedTo: 'B_BOOK', message: 'Internal close' }
    }

    console.log('[LP] A-BOOK CLOSE - Routing to LP:', {
      tradeId: trade._id,
      symbol: trade.symbol,
      side: trade.side === 'BUY' ? 'SELL' : 'BUY', // Opposite side to close
      quantity: trade.quantity,
      closePrice: trade.closePrice,
      pnl: trade.pnl
    })

    if (!this.connected) {
      return {
        success: true,
        routedTo: 'A_BOOK',
        lpConnected: false,
        message: 'Close logged for LP (connection pending)'
      }
    }

    // TODO: Implement actual LP close when connected
    return {
      success: true,
      routedTo: 'A_BOOK',
      lpConnected: false,
      message: 'Close queued for LP'
    }
  }

  // Get LP status
  getStatus() {
    return {
      connected: this.connected,
      config: this.lpConfig ? {
        provider: this.lpConfig.provider,
        endpoint: this.lpConfig.endpoint ? '***configured***' : null
      } : null
    }
  }

  // Get routing stats
  async getRoutingStats() {
    const aBookCount = await BookAssignment.countDocuments({ bookType: 'A_BOOK', isActive: true })
    const bBookCount = await BookAssignment.countDocuments({ bookType: 'B_BOOK', isActive: true })
    
    return {
      aBookUsers: aBookCount,
      bBookUsers: bBookCount,
      lpConnected: this.connected,
      lpProvider: this.lpConfig?.provider || 'Not configured'
    }
  }
}

export default new LPService()
