import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import infowayService from '../services/infowayService.js'

const router = express.Router()

// Popular instruments per category (shown by default - 15 max)
const POPULAR_INSTRUMENTS = {
  Forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'AUDCAD', 'AUDJPY', 'CADJPY'],
  Metals: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XAUEUR', 'XAUAUD', 'XAUGBP', 'XAUCHF', 'XAUJPY', 'XAGEUR'],
  Commodities: ['USOIL', 'UKOIL', 'NGAS', 'BRENT', 'WTI', 'GASOLINE', 'HEATING'],
  Crypto: ['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'DOTUSD', 'MATICUSD', 'LTCUSD', 'AVAXUSD', 'LINKUSD', 'SHIBUSD', 'UNIUSD', 'ATOMUSD'],
  Stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD'],
  Indices: ['US30', 'US500', 'NAS100', 'UK100', 'GER40', 'FRA40', 'JPN225', 'AUS200', 'SPX500', 'DJ30', 'USTEC', 'USDX', 'VIX']
}

// Use Infoway service for categorization
function categorizeSymbol(symbol) {
  return infowayService.categorizeSymbol(symbol)
}

// Default instruments fallback
function getDefaultInstruments() {
  return [
    { symbol: 'EURUSD', name: 'EUR/USD', category: 'Forex', digits: 5 },
    { symbol: 'GBPUSD', name: 'GBP/USD', category: 'Forex', digits: 5 },
    { symbol: 'USDJPY', name: 'USD/JPY', category: 'Forex', digits: 3 },
    { symbol: 'USDCHF', name: 'USD/CHF', category: 'Forex', digits: 5 },
    { symbol: 'AUDUSD', name: 'AUD/USD', category: 'Forex', digits: 5 },
    { symbol: 'NZDUSD', name: 'NZD/USD', category: 'Forex', digits: 5 },
    { symbol: 'USDCAD', name: 'USD/CAD', category: 'Forex', digits: 5 },
    { symbol: 'EURGBP', name: 'EUR/GBP', category: 'Forex', digits: 5 },
    { symbol: 'EURJPY', name: 'EUR/JPY', category: 'Forex', digits: 3 },
    { symbol: 'GBPJPY', name: 'GBP/JPY', category: 'Forex', digits: 3 },
    { symbol: 'XAUUSD', name: 'Gold', category: 'Metals', digits: 2 },
    { symbol: 'XAGUSD', name: 'Silver', category: 'Metals', digits: 3 },
    { symbol: 'BTCUSD', name: 'Bitcoin', category: 'Crypto', digits: 2 },
    { symbol: 'ETHUSD', name: 'Ethereum', category: 'Crypto', digits: 2 },
  ]
}

// GET /api/prices/instruments - Get all available instruments (only those with live prices)
router.get('/instruments', async (req, res) => {
  try {
    console.log('[Infoway] Returning supported instruments')
    
    // Get price cache from Infoway service
    const priceCache = infowayService.getPriceCache()
    
    // Only show symbols that have actual price data
    const symbolsWithPrices = Array.from(priceCache.keys())
    
    const instruments = symbolsWithPrices.map(symbol => {
      const category = categorizeSymbol(symbol)
      const isPopular = POPULAR_INSTRUMENTS[category]?.includes(symbol) || false
      const cached = priceCache.get(symbol) || {}
      return {
        symbol,
        name: getInstrumentName(symbol),
        category,
        digits: getDigits(symbol),
        contractSize: getContractSize(symbol),
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        popular: isPopular,
        bid: cached.bid || 0,
        ask: cached.ask || 0,
        change: cached.change || 0,
        changePercent: cached.changePercent || 0
      }
    })
    
    // Add fallback Indices if none found (Infoway may not support INDEX type)
    const hasIndices = instruments.some(i => i.category === 'Indices')
    if (!hasIndices) {
      const fallbackIndices = POPULAR_INSTRUMENTS.Indices.map(symbol => ({
        symbol,
        name: getInstrumentName(symbol),
        category: 'Indices',
        digits: 2,
        contractSize: 1,
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        popular: true
      }))
      instruments.push(...fallbackIndices)
    }
    
    // Add fallback Commodities if none found
    const hasCommodities = instruments.some(i => i.category === 'Commodities')
    if (!hasCommodities) {
      const fallbackCommodities = POPULAR_INSTRUMENTS.Commodities.map(symbol => ({
        symbol,
        name: getInstrumentName(symbol),
        category: 'Commodities',
        digits: 3,
        contractSize: 1000,
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        popular: true
      }))
      instruments.push(...fallbackCommodities)
    }
    
    console.log('[Infoway] Returning', instruments.length, 'instruments with live prices')
    res.json({ success: true, instruments })
  } catch (error) {
    console.error('[Infoway] Error fetching instruments:', error)
    res.json({ success: true, instruments: getDefaultInstruments() })
  }
})

// Helper to get instrument display name
function getInstrumentName(symbol) {
  const names = {
    // Forex Majors & Crosses
    'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY', 'USDCHF': 'USD/CHF',
    'AUDUSD': 'AUD/USD', 'NZDUSD': 'NZD/USD', 'USDCAD': 'USD/CAD', 'EURGBP': 'EUR/GBP',
    'EURJPY': 'EUR/JPY', 'GBPJPY': 'GBP/JPY', 'EURCHF': 'EUR/CHF', 'EURAUD': 'EUR/AUD',
    'EURCAD': 'EUR/CAD', 'GBPAUD': 'GBP/AUD', 'GBPCAD': 'GBP/CAD', 'AUDCAD': 'AUD/CAD',
    'AUDJPY': 'AUD/JPY', 'CADJPY': 'CAD/JPY', 'CHFJPY': 'CHF/JPY', 'NZDJPY': 'NZD/JPY',
    'AUDNZD': 'AUD/NZD', 'CADCHF': 'CAD/CHF', 'GBPCHF': 'GBP/CHF', 'GBPNZD': 'GBP/NZD',
    'EURNZD': 'EUR/NZD', 'NZDCAD': 'NZD/CAD', 'NZDCHF': 'NZD/CHF', 'AUDCHF': 'AUD/CHF',
    // Exotics
    'USDSGD': 'USD/SGD', 'EURSGD': 'EUR/SGD', 'GBPSGD': 'GBP/SGD', 'USDZAR': 'USD/ZAR',
    'USDTRY': 'USD/TRY', 'EURTRY': 'EUR/TRY', 'USDMXN': 'USD/MXN', 'USDPLN': 'USD/PLN',
    'USDSEK': 'USD/SEK', 'USDNOK': 'USD/NOK', 'USDDKK': 'USD/DKK', 'USDCNH': 'USD/CNH',
    // Metals
    'XAUUSD': 'Gold', 'XAGUSD': 'Silver', 'XPTUSD': 'Platinum', 'XPDUSD': 'Palladium',
    // Commodities
    'USOIL': 'US Oil', 'UKOIL': 'UK Oil', 'NGAS': 'Natural Gas', 'COPPER': 'Copper',
    // Crypto
    'BTCUSD': 'Bitcoin', 'ETHUSD': 'Ethereum', 'BNBUSD': 'BNB', 'SOLUSD': 'Solana',
    'XRPUSD': 'XRP', 'ADAUSD': 'Cardano', 'DOGEUSD': 'Dogecoin', 'TRXUSD': 'TRON',
    'LINKUSD': 'Chainlink', 'MATICUSD': 'Polygon', 'DOTUSD': 'Polkadot',
    'SHIBUSD': 'Shiba Inu', 'LTCUSD': 'Litecoin', 'BCHUSD': 'Bitcoin Cash', 'AVAXUSD': 'Avalanche',
    'XLMUSD': 'Stellar', 'UNIUSD': 'Uniswap', 'ATOMUSD': 'Cosmos', 'ETCUSD': 'Ethereum Classic',
    'FILUSD': 'Filecoin', 'ICPUSD': 'Internet Computer', 'VETUSD': 'VeChain',
    'NEARUSD': 'NEAR Protocol', 'GRTUSD': 'The Graph', 'AAVEUSD': 'Aave', 'MKRUSD': 'Maker',
    'ALGOUSD': 'Algorand', 'FTMUSD': 'Fantom', 'SANDUSD': 'The Sandbox', 'MANAUSD': 'Decentraland',
    'AXSUSD': 'Axie Infinity', 'THETAUSD': 'Theta Network', 'XMRUSD': 'Monero', 'FLOWUSD': 'Flow',
    'SNXUSD': 'Synthetix', 'EOSUSD': 'EOS', 'CHZUSD': 'Chiliz', 'ENJUSD': 'Enjin Coin',
    'PEPEUSD': 'Pepe', 'ARBUSD': 'Arbitrum', 'OPUSD': 'Optimism', 'SUIUSD': 'Sui',
    'APTUSD': 'Aptos', 'INJUSD': 'Injective', 'TONUSD': 'Toncoin', 'HBARUSD': 'Hedera',
    // Commodities
    'GASOLINE': 'Gasoline', 'CATTLE': 'Live Cattle', 'COCOA': 'Cocoa', 'COFFEE': 'Coffee', 'CORN': 'Corn', 'COTTON': 'Cotton', 'ALUMINUM': 'Aluminum',
    // Indices
    'US30': 'Dow Jones 30', 'US500': 'S&P 500', 'NAS100': 'NASDAQ 100', 'UK100': 'UK 100',
    'GER40': 'Germany 40', 'FRA40': 'France 40', 'JPN225': 'Japan 225', 'AUS200': 'Australia 200',
    'SPX500': 'S&P 500', 'DJ30': 'Dow Jones 30', 'USTEC': 'US Tech 100', 'USDX': 'US Dollar Index',
    'VIX': 'Volatility Index', 'AEX': 'AEX Index', 'CAC40': 'CAC 40', 'CAN60': 'Canada 60',
    'CN50': 'China 50', 'DAX': 'DAX German', 'DXY': 'US Dollar Index', 'EU50': 'Euro Stoxx 50',
    'EURX': 'Euro Index', 'GERMID50': 'MDAX 50',
    // Stocks
    'AAPL': 'Apple Inc', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet', 'AA': 'Alcoa Corp',
    'AAL': 'American Airlines', 'AAP': 'Advance Auto Parts', 'ABBV': 'AbbVie Inc',
    'ADBE': 'Adobe Inc', 'AIG': 'American Intl Group', 'AMD': 'AMD'
  }
  return names[symbol] || symbol
}

// Helper to get digits for symbol
function getDigits(symbol) {
  if (symbol.includes('JPY')) return 3
  if (symbol === 'XAUUSD') return 2
  if (symbol === 'XAGUSD') return 3
  const category = categorizeSymbol(symbol)
  if (category === 'Crypto') return 2
  if (category === 'Stocks') return 2
  return 5
}

// Helper to get contract size
function getContractSize(symbol) {
  const category = categorizeSymbol(symbol)
  if (category === 'Crypto') return 1
  if (category === 'Metals') return 100
  if (category === 'Energy') return 1000
  return 100000 // Forex default
}

// GET /api/prices/:symbol - Get single symbol price
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const SYMBOL_MAP = infowayService.SYMBOL_MAP
    
    // Check if symbol is supported (allow any symbol, will return null if not available)
    if (!SYMBOL_MAP[symbol] && !symbol) {
      return res.status(404).json({ success: false, message: `Symbol ${symbol} not supported` })
    }
    
    // Try to get from cache first
    let price = infowayService.getPrice(symbol)
    
    // If not in cache, fetch via REST API
    if (!price) {
      price = await infowayService.fetchPriceREST(symbol)
    }
    
    if (price) {
      res.json({
        success: true,
        price: {
          bid: price.bid,
          ask: price.ask,
          change: price.change || 0,
          changePercent: price.changePercent || 0
        }
      })
    } else {
      res.status(404).json({ success: false, message: 'Price not available' })
    }
  } catch (error) {
    console.error('[Infoway] Error fetching price:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prices/batch - Get multiple symbol prices
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ success: false, message: 'symbols array required' })
    }
    
    const SYMBOL_MAP = infowayService.SYMBOL_MAP
    const prices = {}
    const missingSymbols = []
    
    // Get prices from cache first
    for (const symbol of symbols) {
      // Allow any symbol, not just mapped ones

      const cached = infowayService.getPrice(symbol)
      if (cached) {
        prices[symbol] = {
          bid: cached.bid,
          ask: cached.ask,
          change: cached.change || 0,
          changePercent: cached.changePercent || 0
        }
      } else {
        missingSymbols.push(symbol)
      }
    }

    // Fetch missing prices via REST API
    if (missingSymbols.length > 0) {
      const batchPrices = await infowayService.fetchBatchPricesREST(missingSymbols)
      for (const [symbol, price] of Object.entries(batchPrices)) {
        prices[symbol] = {
          bid: price.bid,
          ask: price.ask,
          change: price.change || 0,
          changePercent: price.changePercent || 0
        }
      }
    }
    
    res.json({ success: true, prices })
  } catch (error) {
    console.error('[Infoway] Error fetching batch prices:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
