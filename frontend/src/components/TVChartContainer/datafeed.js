// Custom Datafeed for TradingView Advanced Charts
// Uses Infoway prices via backend API and WebSocket

import { API_URL } from '../../config/api'
import priceStreamService from '../../services/priceStream'

// Supported resolutions
const supportedResolutions = ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M']

// Resolution to milliseconds mapping
const resolutionToMs = {
  '1': 60 * 1000,
  '5': 5 * 60 * 1000,
  '15': 15 * 60 * 1000,
  '30': 30 * 60 * 1000,
  '60': 60 * 60 * 1000,
  '240': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  'D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  'W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  'M': 30 * 24 * 60 * 60 * 1000,
}

// Store for real-time subscriptions
const subscriptions = new Map()

// Price cache for generating bars
let priceCache = {}

// Subscribe to price stream
priceStreamService.subscribe('tvDatafeed', (prices) => {
  priceCache = prices
  
  // Update all active subscriptions with new prices
  subscriptions.forEach((subscription, subscriberUID) => {
    const { symbol, resolution, onTick, lastBar } = subscription
    const priceData = prices[symbol]
    
    if (priceData && lastBar) {
      const currentTime = Date.now()
      const resMs = resolutionToMs[resolution] || 60000
      const barTime = Math.floor(currentTime / resMs) * resMs
      
      const price = (priceData.bid + priceData.ask) / 2
      
      if (barTime > lastBar.time) {
        // New bar
        const newBar = {
          time: barTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        }
        subscription.lastBar = newBar
        onTick(newBar)
      } else {
        // Update current bar
        const updatedBar = {
          ...lastBar,
          high: Math.max(lastBar.high, price),
          low: Math.min(lastBar.low, price),
          close: price
        }
        subscription.lastBar = updatedBar
        onTick(updatedBar)
      }
    }
  })
})

// Datafeed configuration
const configurationData = {
  supported_resolutions: supportedResolutions,
  exchanges: [
    { value: 'BlueStone', name: 'BlueStone Exchange', desc: 'BlueStone Exchange' }
  ],
  symbols_types: [
    { name: 'Forex', value: 'forex' },
    { name: 'Crypto', value: 'crypto' },
    { name: 'Metals', value: 'metals' },
    { name: 'Commodities', value: 'commodity' },
    { name: 'Indices', value: 'index' },
    { name: 'Stocks', value: 'stock' }
  ]
}

// Fetch instruments from backend
let instrumentsCache = null
async function fetchInstruments() {
  if (instrumentsCache) return instrumentsCache
  
  try {
    const response = await fetch(`${API_URL}/prices/instruments`)
    const data = await response.json()
    if (data.success && data.instruments) {
      instrumentsCache = data.instruments
      return instrumentsCache
    }
  } catch (error) {
    console.error('[TVDatafeed] Error fetching instruments:', error)
  }
  return []
}

// Get symbol info
function getSymbolInfo(symbol, instruments) {
  const instrument = instruments.find(i => i.symbol === symbol)
  if (!instrument) return null
  
  const categoryToType = {
    'Forex': 'forex',
    'Crypto': 'crypto',
    'Metals': 'metals',
    'Commodities': 'commodity',
    'Indices': 'index',
    'Stocks': 'stock'
  }
  
  return {
    symbol: instrument.symbol,
    full_name: instrument.symbol,
    description: instrument.name,
    type: categoryToType[instrument.category] || 'forex',
    session: '24x7',
    timezone: 'Etc/UTC',
    exchange: 'BlueStone',
    minmov: 1,
    pricescale: Math.pow(10, instrument.digits || 5),
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: supportedResolutions,
    volume_precision: 2,
    data_status: 'streaming',
  }
}

// Generate historical bars from current price (simulated history)
function generateHistoricalBars(symbol, resolution, from, to, currentPrice) {
  const bars = []
  const resMs = resolutionToMs[resolution] || 60000
  
  // Generate bars from 'from' to 'to'
  let time = Math.floor(from * 1000 / resMs) * resMs
  const endTime = to * 1000
  
  // Use current price as base, add some variation for historical data
  let price = currentPrice || 1.0
  const volatility = price * 0.0005 // 0.05% volatility per bar
  
  while (time <= endTime && bars.length < 1000) {
    // Random walk for historical simulation
    const change = (Math.random() - 0.5) * 2 * volatility
    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.random() * volatility
    const low = Math.min(open, close) - Math.random() * volatility
    
    bars.push({
      time: time,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: Math.floor(Math.random() * 1000)
    })
    
    price = close
    time += resMs
  }
  
  return bars
}

// The Datafeed object
const Datafeed = {
  onReady: (callback) => {
    console.log('[TVDatafeed] onReady called')
    setTimeout(() => callback(configurationData), 0)
  },

  searchSymbols: async (userInput, exchange, symbolType, onResultReadyCallback) => {
    console.log('[TVDatafeed] searchSymbols:', userInput)
    const instruments = await fetchInstruments()
    
    const filtered = instruments
      .filter(inst => {
        const matchesSearch = inst.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
          inst.name.toLowerCase().includes(userInput.toLowerCase())
        const matchesType = !symbolType || inst.category.toLowerCase() === symbolType.toLowerCase()
        return matchesSearch && matchesType
      })
      .map(inst => ({
        symbol: inst.symbol,
        full_name: inst.symbol,
        description: inst.name,
        exchange: 'BlueStone',
        type: inst.category.toLowerCase()
      }))
    
    onResultReadyCallback(filtered)
  },

  resolveSymbol: async (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
    console.log('[TVDatafeed] resolveSymbol:', symbolName)
    const instruments = await fetchInstruments()
    
    // Clean symbol name (remove exchange prefix if present)
    const cleanSymbol = symbolName.includes(':') ? symbolName.split(':')[1] : symbolName
    
    const symbolInfo = getSymbolInfo(cleanSymbol, instruments)
    
    if (symbolInfo) {
      setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0)
    } else {
      // Fallback for unknown symbols
      const fallbackInfo = {
        symbol: cleanSymbol,
        full_name: cleanSymbol,
        description: cleanSymbol,
        type: 'forex',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'BlueStone',
        minmov: 1,
        pricescale: 100000,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: supportedResolutions,
        volume_precision: 2,
        data_status: 'streaming',
      }
      setTimeout(() => onSymbolResolvedCallback(fallbackInfo), 0)
    }
  },

  getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
    const { from, to, firstDataRequest } = periodParams
    console.log('[TVDatafeed] getBars:', symbolInfo.symbol, resolution, new Date(from * 1000), new Date(to * 1000))
    
    try {
      // Get current price from cache
      const priceData = priceCache[symbolInfo.symbol]
      const currentPrice = priceData ? (priceData.bid + priceData.ask) / 2 : null
      
      if (!currentPrice) {
        // No price data yet, return empty
        onHistoryCallback([], { noData: true })
        return
      }
      
      // Generate historical bars based on current price
      const bars = generateHistoricalBars(symbolInfo.symbol, resolution, from, to, currentPrice)
      
      if (bars.length === 0) {
        onHistoryCallback([], { noData: true })
      } else {
        onHistoryCallback(bars, { noData: false })
      }
    } catch (error) {
      console.error('[TVDatafeed] getBars error:', error)
      onErrorCallback(error.message)
    }
  },

  subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
    console.log('[TVDatafeed] subscribeBars:', symbolInfo.symbol, resolution, subscriberUID)
    
    // Get initial last bar
    const priceData = priceCache[symbolInfo.symbol]
    const currentPrice = priceData ? (priceData.bid + priceData.ask) / 2 : 0
    const resMs = resolutionToMs[resolution] || 60000
    const barTime = Math.floor(Date.now() / resMs) * resMs
    
    const lastBar = {
      time: barTime,
      open: currentPrice,
      high: currentPrice,
      low: currentPrice,
      close: currentPrice,
      volume: 0
    }
    
    // Store subscription
    subscriptions.set(subscriberUID, {
      symbol: symbolInfo.symbol,
      resolution,
      onTick: onRealtimeCallback,
      lastBar
    })
  },

  unsubscribeBars: (subscriberUID) => {
    console.log('[TVDatafeed] unsubscribeBars:', subscriberUID)
    subscriptions.delete(subscriberUID)
  },

  getMarks: (symbolInfo, from, to, onDataCallback, resolution) => {
    onDataCallback([])
  },

  getTimescaleMarks: (symbolInfo, from, to, onDataCallback, resolution) => {
    onDataCallback([])
  },

  getServerTime: (callback) => {
    callback(Math.floor(Date.now() / 1000))
  }
}

export default Datafeed
