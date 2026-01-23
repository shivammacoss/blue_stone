import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Home, BarChart2, TrendingUp, LineChart, MoreHorizontal,
  Copy, Users, HelpCircle, FileText, UserCircle, LogOut, Wallet,
  X, ChevronRight, Search, Star, ArrowUp, ArrowDown, Clock,
  Plus, Minus, Settings, RefreshCw, ChevronDown, Bell, User,
  ArrowDownCircle, ArrowUpCircle, Check, Pencil, Trash2, Sun, Moon
} from 'lucide-react'
import metaApiService from '../services/metaApi'
import priceStreamService from '../services/priceStream'
import { useTheme } from '../context/ThemeContext'
import logo from '../assets/logo.png'

import { API_URL } from '../config/api'

const MobileTradingApp = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const accountIdFromUrl = searchParams.get('account')
  const [activeTab, setActiveTab] = useState(accountIdFromUrl ? 'trade' : 'home')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showOrderPanel, setShowOrderPanel] = useState(false)
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  const [user, setUser] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [openTrades, setOpenTrades] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [tradeHistory, setTradeHistory] = useState([])
  const [instruments, setInstruments] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [tradeTab, setTradeTab] = useState('positions')
  const [chartTabs, setChartTabs] = useState([{ symbol: 'XAUUSD', name: 'Gold' }])
  const [activeChartTab, setActiveChartTab] = useState('XAUUSD')
  const [orderType, setOrderType] = useState('market')
  const [orderSide, setOrderSide] = useState('BUY')
  const [volume, setVolume] = useState('0.01')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [accountSummary, setAccountSummary] = useState({ balance: 0, equity: 0, credit: 0, freeMargin: 0, usedMargin: 0, floatingPnl: 0 })
  const [expandedTrade, setExpandedTrade] = useState(null)
  const chartContainerRef = useRef(null)
  const wsRef = useRef(null)
  
  // Modify trade modal states
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [selectedTradeForModify, setSelectedTradeForModify] = useState(null)
  const [modifySL, setModifySL] = useState('')
  const [modifyTP, setModifyTP] = useState('')
  const [isModifying, setIsModifying] = useState(false)
  
  // iOS-style notification states
  const [notifications, setNotifications] = useState([])
  const notificationIdRef = useRef(0)

  const categories = ['All', 'Starred', 'Forex', 'Metals', 'Crypto']

  // Same instruments as TradingPage
  const defaultInstruments = [
    { symbol: 'EURUSD', name: 'EUR/USD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: true },
    { symbol: 'GBPUSD', name: 'GBP/USD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: true },
    { symbol: 'USDJPY', name: 'USD/JPY', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'USDCHF', name: 'USD/CHF', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'AUDUSD', name: 'AUD/USD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'NZDUSD', name: 'NZD/USD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'USDCAD', name: 'USD/CAD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'EURGBP', name: 'EUR/GBP', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'EURJPY', name: 'EUR/JPY', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'GBPJPY', name: 'GBP/JPY', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: false },
    { symbol: 'XAUUSD', name: 'Gold', bid: 0, ask: 0, spread: 0, category: 'Metals', starred: true },
    { symbol: 'XAGUSD', name: 'Silver', bid: 0, ask: 0, spread: 0, category: 'Metals', starred: false },
    { symbol: 'BTCUSD', name: 'Bitcoin', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: true },
    { symbol: 'ETHUSD', name: 'Ethereum', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'BNBUSD', name: 'BNB', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'SOLUSD', name: 'Solana', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'XRPUSD', name: 'XRP', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'ADAUSD', name: 'Cardano', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'DOGEUSD', name: 'Dogecoin', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'DOTUSD', name: 'Polkadot', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'MATICUSD', name: 'Polygon', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'LTCUSD', name: 'Litecoin', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'AVAXUSD', name: 'Avalanche', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
    { symbol: 'LINKUSD', name: 'Chainlink', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: false },
  ]

  // Handle resize - redirect to dashboard if desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // Switch to desktop view
        sessionStorage.removeItem('viewChecked')
        navigate('/dashboard')
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [navigate])

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}')
    if (!userData._id) {
      navigate('/user/login')
      return
    }
    setUser(userData)
    setInstruments(defaultInstruments)
    fetchAccounts(userData._id)
    
    // Initial price fetch
    fetchLivePrices()

    return () => {
      metaApiService.disconnect()
    }
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      fetchOpenTrades()
      fetchPendingOrders()
      fetchTradeHistory()
      fetchAccountSummary()
      const interval = setInterval(() => {
        fetchOpenTrades()
        fetchAccountSummary()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [selectedAccount])

  // All symbols for price fetching
  const allSymbols = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
    'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD',
    'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'DOTUSD', 'MATICUSD',
    'LTCUSD', 'AVAXUSD', 'LINKUSD'
  ]

  // Real-time price updates via WebSocket for institutional-grade streaming
  useEffect(() => {
    const unsubscribe = priceStreamService.subscribe('mobileTradingApp', (prices, updated, timestamp) => {
      // Only update if we have valid prices (prevent flickering to zero)
      if (!prices || Object.keys(prices).length === 0) return
      
      // Merge prices to prevent losing existing data
      setLivePrices(prev => {
        const merged = { ...prev }
        Object.entries(prices).forEach(([symbol, price]) => {
          if (price && price.bid) {
            merged[symbol] = price
          }
        })
        return merged
      })
      
      // Update instruments with live prices (only if price is valid)
      setInstruments(prev => prev.map(inst => {
        const priceData = prices[inst.symbol]
        if (priceData && priceData.bid && priceData.bid > 0) {
          const bid = priceData.bid
          const ask = priceData.ask || priceData.bid
          const spread = Math.abs(ask - bid) || (bid * 0.0001)
          return { ...inst, bid, ask, spread }
        }
        return inst
      }))
      
      // Check pending orders and SL/TP in background
      if (Object.keys(prices).length > 0) {
        checkPendingOrdersAndSlTp(prices)
      }
    })
    
    // Fallback: also fetch via HTTP for initial load
    fetchLivePrices()
    
    return () => unsubscribe()
  }, [])

  // Fetch live prices using metaApiService (same as TradingPage)
  const fetchLivePrices = async () => {
    try {
      const allPrices = await metaApiService.getAllPrices(allSymbols)
      
      if (Object.keys(allPrices).length > 0) {
        setLoading(false)
        setLivePrices(allPrices)
        
        // Update instruments with live prices
        setInstruments(prev => prev.map(inst => {
          const priceData = allPrices[inst.symbol]
          if (priceData && priceData.bid) {
            const bid = priceData.bid
            const ask = priceData.ask || priceData.bid
            const spread = Math.abs(ask - bid) || (bid * 0.0001)
            return { ...inst, bid, ask, spread }
          }
          return inst
        }))
        
        // Check pending orders and SL/TP in background
        checkPendingOrdersAndSlTp(allPrices)
      }
    } catch (e) {
      console.error('Live prices error:', e)
    }
  }
  
  // Check pending orders and SL/TP execution
  const checkPendingOrdersAndSlTp = async (prices) => {
    if (!selectedAccount) return
    
    try {
      // Check pending orders for execution
      const pendingRes = await fetch(`${API_URL}/trade/check-pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices })
      })
      const pendingData = await pendingRes.json()
      
      if (pendingData.success && pendingData.executedCount > 0) {
        pendingData.executedTrades.forEach(trade => {
          showNotification(`${trade.orderType} order executed: ${trade.symbol} ${trade.side} @ ${trade.executionPrice?.toFixed(5)}`, 'success')
        })
        fetchOpenTrades()
        fetchPendingOrders()
      }
      
      // Check SL/TP for open trades
      const sltpRes = await fetch(`${API_URL}/trade/check-sltp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices })
      })
      const sltpData = await sltpRes.json()
      
      if (sltpData.success && sltpData.closedCount > 0) {
        sltpData.closedTrades.forEach(trade => {
          const pnlText = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`
          showNotification(`${trade.reason} hit: ${trade.symbol} closed at ${pnlText}`, trade.pnl >= 0 ? 'success' : 'error')
        })
        fetchOpenTrades()
        fetchTradeHistory()
        fetchAccountSummary()
      }
    } catch (e) {
      // Silently fail - this runs in background
    }
  }

  const fetchAccounts = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/trading-accounts/user/${userId}`)
      const data = await res.json()
      setAccounts(data.accounts || [])
      if (data.accounts?.length > 0) {
        // If account ID is passed in URL, select that account
        if (accountIdFromUrl) {
          const accountFromUrl = data.accounts.find(acc => acc._id === accountIdFromUrl)
          if (accountFromUrl) {
            setSelectedAccount(accountFromUrl)
          } else {
            setSelectedAccount(data.accounts[0])
          }
        } else {
          setSelectedAccount(data.accounts[0])
        }
      }
    } catch (e) {}
    setLoading(false)
  }

  const fetchOpenTrades = async () => {
    if (!selectedAccount) return
    try {
      const res = await fetch(`${API_URL}/trade/open/${selectedAccount._id}`)
      const data = await res.json()
      if (data.success) setOpenTrades(data.trades || [])
    } catch (e) {}
  }

  const fetchPendingOrders = async () => {
    if (!selectedAccount) return
    try {
      const res = await fetch(`${API_URL}/trade/pending/${selectedAccount._id}`)
      const data = await res.json()
      if (data.success) setPendingOrders(data.orders || [])
    } catch (e) {}
  }

  const fetchTradeHistory = async () => {
    if (!selectedAccount) return
    try {
      const res = await fetch(`${API_URL}/trade/history/${selectedAccount._id}?limit=50`)
      const data = await res.json()
      if (data.success) setTradeHistory(data.trades || [])
    } catch (e) {}
  }

  const fetchAccountSummary = async () => {
    if (!selectedAccount) return
    try {
      const pricesParam = encodeURIComponent(JSON.stringify(livePrices))
      const res = await fetch(`${API_URL}/trade/summary/${selectedAccount._id}?prices=${pricesParam}`)
      const data = await res.json()
      if (data.success) setAccountSummary(data.summary)
    } catch (e) {}
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/user/login')
  }

  const openOrderPanel = (instrument) => {
    setSelectedInstrument(instrument)
    setShowOrderPanel(true)
  }

  const executeOrder = async () => {
    if (!selectedAccount || !selectedInstrument || isExecuting) return
    setIsExecuting(true)

    const prices = livePrices[selectedInstrument.symbol] || {}
    
    // Check if market data is available
    if (!prices.bid || !prices.ask || prices.bid <= 0 || prices.ask <= 0) {
      showNotification('Market is closed or no price data available', 'error')
      setIsExecuting(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/trade/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          tradingAccountId: selectedAccount._id,
          symbol: selectedInstrument.symbol,
          segment: selectedInstrument.category,
          side: orderSide,
          orderType: orderType === 'market' ? 'MARKET' : 'PENDING',
          quantity: parseFloat(volume),
          bid: prices.bid,
          ask: prices.ask,
          sl: stopLoss ? parseFloat(stopLoss) : null,
          tp: takeProfit ? parseFloat(takeProfit) : null
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowOrderPanel(false)
        fetchOpenTrades()
        fetchAccountSummary()
        showNotification('Order executed successfully!', 'success')
      } else {
        showNotification(data.message || 'Order failed', 'error')
      }
    } catch (e) {
      showNotification('Error executing order', 'error')
    }
    setIsExecuting(false)
  }

  const closeTrade = async (tradeId) => {
    const trade = openTrades.find(t => t._id === tradeId)
    if (!trade) {
      showNotification('Trade not found', 'error')
      return
    }

    const prices = livePrices[trade.symbol] || {}
    
    // Check if market data is available
    if (!prices.bid || !prices.ask || prices.bid <= 0 || prices.ask <= 0) {
      showNotification('Market is closed or no price data. Cannot close trade.', 'error')
      return
    }

    try {
      const res = await fetch(`${API_URL}/trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: tradeId,
          bid: prices.bid,
          ask: prices.ask
        })
      })
      const data = await res.json()
      if (data.success) {
        const pnl = data.realizedPnl?.toFixed(2) || data.pnl?.toFixed(2) || '0.00'
        showNotification(`Trade closed! P/L: $${pnl}`, parseFloat(pnl) >= 0 ? 'success' : 'error')
        fetchOpenTrades()
        fetchTradeHistory()
        fetchAccountSummary()
      } else {
        showNotification(data.message || 'Failed to close trade', 'error')
      }
    } catch (e) {
      console.error('Close trade error:', e)
      showNotification('Error closing trade', 'error')
    }
  }

  // iOS-style notification function
  const showNotification = (message, type = 'success', duration = 3000) => {
    const id = ++notificationIdRef.current
    const notification = { id, message, type }
    setNotifications(prev => [...prev, notification])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, duration)
  }

  // Open modify SL/TP modal
  const openModifyModal = (trade) => {
    setSelectedTradeForModify(trade)
    setModifySL((trade.sl || trade.stopLoss)?.toString() || '')
    setModifyTP((trade.tp || trade.takeProfit)?.toString() || '')
    setShowModifyModal(true)
  }

  // Modify trade SL/TP
  const handleModifyTrade = async () => {
    if (!selectedTradeForModify || isModifying) return
    setIsModifying(true)

    try {
      const res = await fetch(`${API_URL}/trade/modify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: selectedTradeForModify._id,
          sl: modifySL ? parseFloat(modifySL) : null,
          tp: modifyTP ? parseFloat(modifyTP) : null
        })
      })
      const data = await res.json()
      if (data.success) {
        showNotification('Trade modified successfully', 'success')
        fetchOpenTrades()
        setShowModifyModal(false)
      } else {
        showNotification(data.message || 'Failed to modify trade', 'error')
      }
    } catch (e) {
      showNotification('Error modifying trade', 'error')
    }
    setIsModifying(false)
  }

  // Cancel pending order
  const cancelPendingOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/trade/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId: orderId })
      })
      const data = await res.json()
      if (data.success) {
        showNotification('Pending order cancelled', 'success')
        fetchPendingOrders()
      } else {
        showNotification(data.message || 'Failed to cancel order', 'error')
      }
    } catch (e) {
      showNotification('Error cancelling order', 'error')
    }
  }

  const filteredInstruments = instruments.filter(inst => {
    const matchesSearch = inst.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inst.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = activeCategory === 'All' || 
                           (activeCategory === 'Starred' && inst.starred) ||
                           inst.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const moreMenuItems = [
    { name: 'Dashboard', icon: Home, path: '/dashboard', action: () => setActiveTab('home') },
    { name: 'Wallet', icon: Wallet, path: '/wallet' },
    { name: 'Copy Trade', icon: Copy, path: '/copytrade' },
    { name: 'IB Program', icon: Users, path: '/ib' },
    { name: 'Profile', icon: UserCircle, path: '/profile' },
    { name: 'Support', icon: HelpCircle, path: '/support' },
    { name: 'Instructions', icon: FileText, path: '/instructions' },
  ]

  const getPrice = (symbol) => livePrices[symbol] || { bid: 0, ask: 0 }

  const calculatePnl = (trade) => {
    const prices = getPrice(trade.symbol)
    const currentPrice = trade.side === 'BUY' ? prices.bid : prices.ask
    // Return previous PnL or 0 if no valid price (prevent flickering)
    if (!currentPrice || currentPrice <= 0) return trade._lastPnl || 0
    const pnl = trade.side === 'BUY'
      ? (currentPrice - trade.openPrice) * trade.quantity * (trade.contractSize || 100000)
      : (trade.openPrice - currentPrice) * trade.quantity * (trade.contractSize || 100000)
    trade._lastPnl = pnl // Cache for fallback
    return pnl
  }

  // Calculate total floating PnL and update account summary in real-time
  // Only calculate if we have valid prices
  const hasValidPrices = Object.keys(livePrices).length > 0 && 
    openTrades.some(t => livePrices[t.symbol]?.bid > 0)
  
  const totalFloatingPnl = hasValidPrices 
    ? openTrades.reduce((sum, trade) => sum + calculatePnl(trade), 0)
    : (accountSummary.floatingPnl || 0) // Use cached value if no valid prices
  const totalUsedMargin = openTrades.reduce((sum, trade) => sum + (trade.marginUsed || 0), 0)
  
  // Real-time equity calculation
  const realTimeEquity = (accountSummary.balance || 0) + (accountSummary.credit || 0) + totalFloatingPnl
  const realTimeFreeMargin = realTimeEquity - totalUsedMargin

  // Light/Dark mode color scheme
  const colors = {
    // Backgrounds
    bgMain: isDarkMode ? 'bg-dark-900' : 'bg-slate-50',
    bgCard: isDarkMode ? 'bg-dark-800' : 'bg-white',
    bgCardAlt: isDarkMode ? 'bg-dark-700' : 'bg-slate-100',
    bgHover: isDarkMode ? 'bg-dark-600' : 'bg-slate-200',
    bgAccent: isDarkMode ? 'bg-accent-green/20' : 'bg-blue-50',
    // Text
    textPrimary: isDarkMode ? 'text-white' : 'text-slate-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-slate-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-slate-500',
    // Borders
    border: isDarkMode ? 'border-gray-800' : 'border-slate-200',
    borderLight: isDarkMode ? 'border-gray-700' : 'border-slate-300',
    // Dividers
    divide: isDarkMode ? 'divide-gray-800' : 'divide-slate-200',
    // Shadows (light mode only)
    shadow: isDarkMode ? '' : 'shadow-sm',
    shadowMd: isDarkMode ? '' : 'shadow-md',
  }

  // HOME TAB
  const [showAccountSelector, setShowAccountSelector] = useState(false)
  
  const renderHome = () => (
    <div className={`p-4 pb-20 ${colors.bgMain} min-h-screen`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="BlueStone" className="h-24 object-contain" />
          <div>
            <p className={`${colors.textMuted} text-xs`}>Welcome back,</p>
            <h1 className={`${colors.textPrimary} text-lg font-bold`}>{user?.firstName || 'Trader'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleDarkMode} className={`p-2 ${colors.bgCard} ${colors.shadow} rounded-full`}>
            {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600" />}
          </button>
          <button onClick={() => navigate('/profile')} className={`p-2 ${colors.bgCard} ${colors.shadow} rounded-full`}>
            <UserCircle size={20} className={colors.textSecondary} />
          </button>
          <button className={`p-2 ${colors.bgCard} ${colors.shadow} rounded-full`}>
            <Bell size={20} className={colors.textSecondary} />
          </button>
        </div>
      </div>

      {/* Account Selector Card */}
      {selectedAccount && (
        <div className={`${isDarkMode ? 'bg-gradient-to-br from-accent-green/20 to-dark-800 border-accent-green/30' : 'bg-gradient-to-br from-blue-50 to-white border-blue-200'} rounded-xl p-4 mb-4 border ${colors.shadowMd}`}>
          {/* Account Header with Switch */}
          <div 
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => setShowAccountSelector(!showAccountSelector)}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${isDarkMode ? 'bg-accent-green/30' : 'bg-blue-100'} rounded-full flex items-center justify-center`}>
                <User size={16} className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} />
              </div>
              <div>
                <p className={`${colors.textPrimary} font-medium text-sm`}>{selectedAccount.accountId}</p>
                <p className={`${colors.textSecondary} text-xs`}>{selectedAccount.accountType || 'Standard'}</p>
              </div>
            </div>
            <ChevronRight size={18} className={`${colors.textSecondary} transition-transform ${showAccountSelector ? 'rotate-90' : ''}`} />
          </div>
          
          {/* Account Selector Dropdown */}
          {showAccountSelector && accounts.length > 1 && (
            <div className={`mb-3 border-t ${colors.border} pt-3`}>
              <p className={`${colors.textMuted} text-xs mb-2`}>Switch Account</p>
              <div className="space-y-2">
                {accounts.map(acc => (
                  <button
                    key={acc._id}
                    onClick={() => { setSelectedAccount(acc); setShowAccountSelector(false) }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg ${
                      selectedAccount._id === acc._id 
                        ? (isDarkMode ? 'bg-accent-green/20 border border-accent-green/50' : 'bg-blue-50 border border-blue-300') 
                        : colors.bgCardAlt
                    }`}
                  >
                    <span className={`${colors.textPrimary} text-sm`}>{acc.accountId}</span>
                    {selectedAccount._id === acc._id && <Check size={14} className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Balance & Equity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`${colors.textSecondary} text-xs`}>Balance</p>
              <p className={`${colors.textPrimary} text-xl font-bold`}>${(accountSummary.balance || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className={`${colors.textSecondary} text-xs`}>Equity</p>
              <p className="text-xl font-bold" style={{ color: totalFloatingPnl >= 0 ? '#3B82F6' : '#EF4444' }}>
                ${realTimeEquity.toFixed(2)}
              </p>
            </div>
          </div>
          
          {/* Deposit/Withdraw Buttons */}
          <div className="flex gap-2 mt-3">
            <button 
              onClick={() => navigate('/wallet')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 ${isDarkMode ? 'bg-accent-green text-black' : 'bg-blue-600 text-white'} rounded-lg text-sm font-medium`}
            >
              <ArrowDownCircle size={16} />
              Deposit
            </button>
            <button 
              onClick={() => navigate('/wallet')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 ${colors.bgCardAlt} ${colors.textPrimary} rounded-lg text-sm font-medium border ${colors.border}`}
            >
              <ArrowUpCircle size={16} />
              Withdraw
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions - 2 rows */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button onClick={() => navigate('/account')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <User size={20} className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>Account</span>
        </button>
        <button onClick={() => setActiveTab('market')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <BarChart2 size={20} className="text-blue-500" />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>Market</span>
        </button>
        <button onClick={() => setActiveTab('trade')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <TrendingUp size={20} className="text-amber-500" />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>Trade</span>
        </button>
        <button onClick={() => setActiveTab('chart')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <LineChart size={20} className="text-orange-500" />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>Chart</span>
        </button>
        <button onClick={() => navigate('/wallet')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <Wallet size={20} className="text-green-500" />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>Wallet</span>
        </button>
        <button onClick={() => navigate('/copytrade')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <Copy size={20} className="text-purple-500" />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>Copy</span>
        </button>
        <button onClick={() => navigate('/ib')} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <Users size={20} className="text-pink-500" />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>IB</span>
        </button>
        <button onClick={() => setShowMoreMenu(true)} className={`flex flex-col items-center p-2.5 ${colors.bgCard} ${colors.shadow} rounded-xl`}>
          <MoreHorizontal size={20} className={colors.textSecondary} />
          <span className={`${colors.textPrimary} text-[10px] mt-1`}>More</span>
        </button>
      </div>

      {/* Open Positions Summary */}
      <div className={`${colors.bgCard} ${colors.shadow} rounded-xl p-4 mb-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`${colors.textPrimary} font-semibold`}>Open Positions</h3>
          <span className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} style={{ fontSize: '0.875rem' }}>{openTrades.length} active</span>
        </div>
        {openTrades.length === 0 ? (
          <p className={`${colors.textMuted} text-sm text-center py-4`}>No open positions</p>
        ) : (
          <div className="space-y-2">
            {openTrades.slice(0, 3).map(trade => {
              const pnl = calculatePnl(trade)
              return (
                <div key={trade._id} className={`flex items-center justify-between p-3 ${colors.bgCardAlt} rounded-lg`}>
                  <div>
                    <p className={`${colors.textPrimary} font-medium`}>{trade.symbol}</p>
                    <p className={`text-xs ${trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.side} • {trade.quantity} lots
                    </p>
                  </div>
                  <p className="font-semibold" style={{ color: pnl >= 0 ? '#3B82F6' : '#EF4444' }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </p>
                </div>
              )
            })}
            {openTrades.length > 3 && (
              <button onClick={() => setActiveTab('trade')} className={`w-full ${isDarkMode ? 'text-accent-green' : 'text-blue-600'} text-sm py-2`}>
                View all {openTrades.length} positions →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Market Movers */}
      <div className={`${colors.bgCard} ${colors.shadow} rounded-xl p-4`}>
        <h3 className={`${colors.textPrimary} font-semibold mb-3`}>Market Watch</h3>
        <div className="space-y-2">
          {instruments.filter(i => i.starred).slice(0, 4).map(inst => {
            const prices = getPrice(inst.symbol)
            return (
              <button
                key={inst.symbol}
                onClick={() => openOrderPanel(inst)}
                className={`w-full flex items-center justify-between p-3 ${colors.bgCardAlt} rounded-lg`}
              >
                <div className="flex items-center gap-3">
                  <Star size={16} className="text-yellow-500 fill-yellow-500" />
                  <div className="text-left">
                    <p className={`${colors.textPrimary} font-medium`}>{inst.symbol}</p>
                    <p className={`${colors.textMuted} text-xs`}>{inst.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={colors.textPrimary}>{prices.bid?.toFixed(inst.category === 'Forex' ? 5 : 2) || '-'}</p>
                  <p className={`${colors.textMuted} text-xs`}>Spread: {((prices.ask - prices.bid) * (inst.category === 'Forex' ? 10000 : 1)).toFixed(1)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  // MARKET TAB
  const renderMarket = () => (
    <div className={`flex flex-col h-full pb-16 ${colors.bgMain}`}>
      {/* Search */}
      <div className={`p-4 ${colors.bgCard} border-b ${colors.border}`}>
        <div className="relative mb-3">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textMuted}`} size={18} />
          <input
            type="text"
            placeholder="Search instruments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${colors.bgCardAlt} border ${colors.border} rounded-xl pl-10 pr-4 py-3 ${colors.textPrimary} placeholder-slate-400`}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
                activeCategory === cat 
                  ? (isDarkMode ? 'bg-accent-green text-black' : 'bg-blue-600 text-white') 
                  : `${colors.bgCardAlt} ${colors.textSecondary}`
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Instruments List */}
      <div className={`flex-1 overflow-auto ${colors.bgMain}`}>
        {filteredInstruments.map(inst => {
          const prices = getPrice(inst.symbol)
          return (
            <div
              key={inst.symbol}
              className={`flex items-center justify-between p-4 border-b ${colors.border} ${colors.bgCard}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setInstruments(prev => prev.map(i => 
                      i.symbol === inst.symbol ? { ...i, starred: !i.starred } : i
                    ))
                  }}
                  className="p-1"
                >
                  <Star size={18} className={inst.starred ? 'text-yellow-500 fill-yellow-500' : colors.textMuted} />
                </button>
                <div className="text-left">
                  <p className={`${colors.textPrimary} font-medium`}>{inst.symbol}</p>
                  <p className={`${colors.textMuted} text-xs`}>{inst.name}</p>
                </div>
              </div>
              <button
                onClick={() => openOrderPanel(inst)}
                className={`flex items-center gap-3 active:${colors.bgHover} rounded-lg p-2`}
              >
                <div className="text-right">
                  <p className="text-red-500 text-sm">{prices.bid?.toFixed(inst.category === 'Forex' ? 5 : 2) || '-'}</p>
                  <p className={`${colors.textMuted} text-xs`}>Bid</p>
                </div>
                <div className="text-right">
                  <p className="text-green-500 text-sm">{prices.ask?.toFixed(inst.category === 'Forex' ? 5 : 2) || '-'}</p>
                  <p className={`${colors.textMuted} text-xs`}>Ask</p>
                </div>
              </button>
              <button
                onClick={() => {
                  const existingTab = chartTabs.find(t => t.symbol === inst.symbol)
                  if (!existingTab) {
                    setChartTabs(prev => [...prev, { symbol: inst.symbol, name: inst.name }])
                  }
                  setActiveChartTab(inst.symbol)
                  setActiveTab('chart')
                }}
                className={`p-2 ${colors.bgCardAlt} rounded-lg`}
              >
                <LineChart size={18} className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  // TRADE TAB - Like reference image with real-time updates
  const renderTrade = () => (
    <div className={`flex flex-col h-full pb-16 ${colors.bgMain}`}>
      {/* Account Summary List - Real-time values */}
      <div className={`${colors.bgCard} border-b ${colors.border}`}>
        <div className={`${colors.divide}`}>
          <div className="flex justify-between px-4 py-2.5">
            <span className={`${colors.textSecondary} text-sm`}>Balance</span>
            <span className={`${colors.textPrimary} text-sm`}>{(accountSummary.balance || 0).toFixed(2)}</span>
          </div>
          <div className={`flex justify-between px-4 py-2.5 border-t ${colors.border}`}>
            <span className={`${colors.textSecondary} text-sm`}>Equity</span>
            <span className="text-sm" style={{ color: totalFloatingPnl >= 0 ? '#3B82F6' : '#EF4444' }}>
              {realTimeEquity.toFixed(2)}
            </span>
          </div>
          <div className={`flex justify-between px-4 py-2.5 border-t ${colors.border}`}>
            <span className={`${colors.textSecondary} text-sm`}>Credit</span>
            <span className={`${colors.textPrimary} text-sm`}>{(accountSummary.credit || 0).toFixed(2)}</span>
          </div>
          <div className={`flex justify-between px-4 py-2.5 border-t ${colors.border}`}>
            <span className={`${colors.textSecondary} text-sm`}>Used Margin</span>
            <span className={`${colors.textPrimary} text-sm`}>{totalUsedMargin.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between px-4 py-2.5 border-t ${colors.border}`}>
            <span className={`${colors.textSecondary} text-sm`}>Free Margin</span>
            <span className={`text-sm ${realTimeFreeMargin >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{realTimeFreeMargin.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between px-4 py-2.5 border-t ${colors.border}`}>
            <span className={`${colors.textSecondary} text-sm`}>Floating PL</span>
            <span className="text-sm" style={{ color: totalFloatingPnl >= 0 ? '#3B82F6' : '#EF4444' }}>
              {totalFloatingPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs - Positions / Pending / History */}
      <div className={`flex ${colors.bgCard} border-b ${colors.border}`}>
        {['positions', 'pending', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setTradeTab(tab)}
            className={`flex-1 py-3 text-sm font-medium ${
              tradeTab === tab 
                ? (isDarkMode ? 'text-accent-green border-b-2 border-accent-green' : 'text-blue-600 border-b-2 border-blue-600') 
                : colors.textMuted
            }`}
          >
            {tab === 'positions' ? `Positions (${openTrades.length})` :
             tab === 'pending' ? `Pending (${pendingOrders.length})` : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto ${colors.bgMain}`}>
        {tradeTab === 'positions' && (
          openTrades.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full ${colors.textMuted}`}>
              <TrendingUp size={48} className="mb-2 opacity-50" />
              <p>No open positions</p>
            </div>
          ) : (
            <div className={`${colors.divide}`}>
              {openTrades.map(trade => {
                const pnl = calculatePnl(trade)
                const prices = getPrice(trade.symbol)
                const isExpanded = expandedTrade === trade._id
                const currentPrice = trade.side === 'BUY' ? prices.bid : prices.ask
                return (
                  <div key={trade._id} className={`${colors.bgCard} border-b ${colors.border}`}>
                    {/* Slim View - Always visible */}
                    <div 
                      className="flex items-center justify-between px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedTrade(isExpanded ? null : trade._id)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`${colors.textPrimary} font-medium text-sm`}>{trade.symbol}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              trade.side === 'BUY' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'
                            }`}>
                              {trade.side}
                            </span>
                          </div>
                          <p className={`${colors.textMuted} text-xs`}>{trade.quantity} lots @ {trade.openPrice?.toFixed(5)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Pen icon for quick SL/TP edit */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openModifyModal(trade) }}
                          className="p-2 bg-blue-500/20 rounded-lg active:bg-blue-500/30"
                        >
                          <Pencil size={14} className="text-blue-400" />
                        </button>
                        <div className="text-right">
                          <p className="font-semibold text-sm" style={{ color: pnl >= 0 ? '#3B82F6' : '#EF4444' }}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </p>
                          <p className={`${colors.textMuted} text-xs`}>{currentPrice?.toFixed(5) || '-'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className={`px-4 pb-3 border-t ${colors.border} ${colors.bgCardAlt}`}>
                        <div className="grid grid-cols-2 gap-3 py-3 text-xs">
                          <div>
                            <p className={colors.textMuted}>Open Price</p>
                            <p className={colors.textPrimary}>{trade.openPrice?.toFixed(5)}</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Current Price</p>
                            <p className={colors.textPrimary}>{currentPrice?.toFixed(5) || '-'}</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Volume</p>
                            <p className={colors.textPrimary}>{trade.quantity} lots</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Margin Used</p>
                            <p className={colors.textPrimary}>${(trade.marginUsed || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Swap</p>
                            <p className={colors.textPrimary}>${(trade.swap || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Commission</p>
                            <p className={colors.textPrimary}>${(trade.commission || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Stop Loss</p>
                            <p className={trade.sl || trade.stopLoss ? 'text-red-500' : colors.textMuted}>{(trade.sl || trade.stopLoss)?.toFixed(5) || 'Not set'}</p>
                          </div>
                          <div>
                            <p className={colors.textMuted}>Take Profit</p>
                            <p className={trade.tp || trade.takeProfit ? 'text-green-500' : colors.textMuted}>{(trade.tp || trade.takeProfit)?.toFixed(5) || 'Not set'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openModifyModal(trade) }}
                            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <Pencil size={14} />
                            Modify SL/TP
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); closeTrade(trade._id) }}
                            className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium"
                          >
                            Close Trade
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {tradeTab === 'pending' && (
          pendingOrders.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full ${colors.textMuted}`}>
              <Clock size={48} className="mb-2 opacity-50" />
              <p>No pending orders</p>
            </div>
          ) : (
            <div className={colors.divide}>
              {pendingOrders.map(order => {
                const prices = getPrice(order.symbol)
                const currentPrice = order.side === 'BUY' ? prices.ask : prices.bid
                return (
                <div key={order._id} className={`p-4 ${colors.bgCard} border-b ${colors.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`${colors.textPrimary} font-medium`}>{order.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        order.side === 'BUY' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'
                      }`}>
                        {order.orderType}
                      </span>
                    </div>
                    <span className="text-amber-500 text-xs font-medium">PENDING</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <p className={colors.textMuted}>Entry Price</p>
                      <p className={colors.textPrimary}>{order.pendingPrice?.toFixed(5)}</p>
                    </div>
                    <div>
                      <p className={colors.textMuted}>Current</p>
                      <p className={colors.textPrimary}>{currentPrice?.toFixed(5) || '-'}</p>
                    </div>
                    <div>
                      <p className={colors.textMuted}>Volume</p>
                      <p className={colors.textPrimary}>{order.quantity} lots</p>
                    </div>
                    <div>
                      <p className={colors.textMuted}>Stop Loss</p>
                      <p className={order.sl || order.stopLoss ? 'text-red-500' : colors.textMuted}>{(order.sl || order.stopLoss)?.toFixed(5) || 'Not set'}</p>
                    </div>
                    <div>
                      <p className={colors.textMuted}>Take Profit</p>
                      <p className={order.tp || order.takeProfit ? 'text-green-500' : colors.textMuted}>{(order.tp || order.takeProfit)?.toFixed(5) || 'Not set'}</p>
                    </div>
                    <div>
                      <p className={colors.textMuted}>Created</p>
                      <p className={colors.textPrimary}>{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelPendingOrder(order._id)}
                    className="w-full py-2 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    Cancel Order
                  </button>
                </div>
              )})}
            </div>
          )
        )}

        {tradeTab === 'history' && (
          tradeHistory.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full ${colors.textMuted}`}>
              <FileText size={48} className="mb-2 opacity-50" />
              <p>No trade history</p>
            </div>
          ) : (
            <div className={colors.divide}>
              {tradeHistory.map(trade => (
                <div key={trade._id} className={`p-4 ${colors.bgCard} border-b ${colors.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`${colors.textPrimary} font-medium`}>{trade.symbol}</span>
                      <span className={`text-xs ${trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                        {trade.side}
                      </span>
                      {trade.closedBy === 'ADMIN' && (
                        <span className="text-xs bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">
                          Admin Close
                        </span>
                      )}
                    </div>
                    <span className="font-semibold" style={{ color: trade.realizedPnl >= 0 ? '#3B82F6' : '#EF4444' }}>
                      {trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl?.toFixed(2)}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between text-xs ${colors.textMuted}`}>
                    <span>{trade.quantity} lots</span>
                    <span>{new Date(trade.closedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )

  // TradingView symbol mapping (same as TradingPage)
  const getSymbolForTradingView = (symbol) => {
    const symbolMap = {
      'EURUSD': 'OANDA:EURUSD', 'GBPUSD': 'OANDA:GBPUSD', 'USDJPY': 'OANDA:USDJPY',
      'USDCHF': 'OANDA:USDCHF', 'AUDUSD': 'OANDA:AUDUSD', 'NZDUSD': 'OANDA:NZDUSD',
      'USDCAD': 'OANDA:USDCAD', 'EURGBP': 'OANDA:EURGBP', 'EURJPY': 'OANDA:EURJPY',
      'GBPJPY': 'OANDA:GBPJPY', 'XAUUSD': 'OANDA:XAUUSD', 'XAGUSD': 'OANDA:XAGUSD',
      'BTCUSD': 'COINBASE:BTCUSD', 'ETHUSD': 'COINBASE:ETHUSD', 'LTCUSD': 'COINBASE:LTCUSD',
      'XRPUSD': 'BITSTAMP:XRPUSD', 'BNBUSD': 'BINANCE:BNBUSDT', 'SOLUSD': 'COINBASE:SOLUSD',
      'ADAUSD': 'COINBASE:ADAUSD', 'DOGEUSD': 'BINANCE:DOGEUSDT', 'DOTUSD': 'COINBASE:DOTUSD',
      'MATICUSD': 'COINBASE:MATICUSD', 'AVAXUSD': 'COINBASE:AVAXUSD', 'LINKUSD': 'COINBASE:LINKUSD',
    }
    return symbolMap[symbol] || `OANDA:${symbol}`
  }

  // CHART TAB - Full screen chart with buy/sell at bottom
  const renderChart = () => {
    const chartInst = instruments.find(i => i.symbol === activeChartTab)
    const isForex = chartInst?.category === 'Forex'
    const decimals = isForex ? 5 : 2
    const spreadMultiplier = isForex ? 10000 : 1
    const chartTheme = isDarkMode ? 'dark' : 'light'
    const chartBg = isDarkMode ? '0d0d0d' : 'ffffff'
    
    return (
    <div className={`flex flex-col h-screen ${colors.bgMain}`}>
      {/* Chart Tabs - Minimal height */}
      <div className={`flex items-center ${colors.bgCard} border-b ${colors.border} overflow-x-auto shrink-0`} style={{ height: '40px' }}>
        {chartTabs.map(tab => (
          <button
            key={tab.symbol}
            onClick={() => setActiveChartTab(tab.symbol)}
            className={`flex items-center gap-2 px-3 py-2 text-xs whitespace-nowrap border-r ${colors.border} ${
              activeChartTab === tab.symbol ? `${colors.bgCardAlt} ${colors.textPrimary}` : colors.textMuted
            }`}
          >
            {tab.symbol}
            {chartTabs.length > 1 && (
              <X
                size={12}
                onClick={(e) => {
                  e.stopPropagation()
                  setChartTabs(prev => prev.filter(t => t.symbol !== tab.symbol))
                  if (activeChartTab === tab.symbol && chartTabs.length > 1) {
                    setActiveChartTab(chartTabs[0].symbol)
                  }
                }}
                className="hover:text-red-500"
              />
            )}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('market')}
          className={`px-3 py-2 ${colors.textMuted} hover:${colors.textPrimary}`}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Full Screen TradingView Chart */}
      <div className={`flex-1 ${isDarkMode ? 'bg-[#0d0d0d]' : 'bg-white'} relative min-h-0`} ref={chartContainerRef}>
        <iframe
          key={`${activeChartTab}-${isDarkMode}`}
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_mobile&symbol=${getSymbolForTradingView(activeChartTab)}&interval=5&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=1&saveimage=0&toolbarbg=${chartBg}&studies=[]&theme=${chartTheme}&style=1&timezone=Etc%2FUTC&withdateranges=0&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=["left_toolbar","header_fullscreen_button"]&locale=en&utm_source=localhost&utm_medium=widget_new&utm_campaign=chart`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          title="TradingView Chart"
        />
      </div>

      {/* Compact Buy/Sell Bar - Fixed at bottom above nav */}
      <div className={`${colors.bgCard} border-t ${colors.border} shrink-0`} style={{ paddingBottom: '64px' }}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-center">
            <p className={`${colors.textMuted} text-[10px]`}>Bid</p>
            <p className="text-red-500 font-semibold text-sm">{getPrice(activeChartTab).bid?.toFixed(decimals) || '-'}</p>
          </div>
          <div className="text-center">
            <p className={`${colors.textMuted} text-[10px]`}>Spread</p>
            <p className={`${colors.textPrimary} text-xs`}>
              {((getPrice(activeChartTab).ask - getPrice(activeChartTab).bid) * spreadMultiplier).toFixed(1)}
            </p>
          </div>
          <div className="text-center">
            <p className={`${colors.textMuted} text-[10px]`}>Ask</p>
            <p className="text-green-500 font-semibold text-sm">{getPrice(activeChartTab).ask?.toFixed(decimals) || '-'}</p>
          </div>
        </div>
        <div className="flex gap-2 px-3 pb-2">
          <button
            onClick={() => {
              const inst = instruments.find(i => i.symbol === activeChartTab) || { symbol: activeChartTab, category: 'Forex' }
              setSelectedInstrument(inst)
              setOrderSide('SELL')
              setShowOrderPanel(true)
            }}
            className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl"
          >
            SELL
          </button>
          <button
            onClick={() => {
              const inst = instruments.find(i => i.symbol === activeChartTab) || { symbol: activeChartTab, category: 'Forex' }
              setSelectedInstrument(inst)
              setOrderSide('BUY')
              setShowOrderPanel(true)
            }}
            className="flex-1 py-3 bg-blue-500 text-white font-semibold rounded-xl"
          >
            BUY
          </button>
        </div>
      </div>
    </div>
  )
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${colors.bgMain} flex items-center justify-center`}>
        <RefreshCw size={32} className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${colors.bgMain} flex flex-col`}>
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'trade' && renderTrade()}
        {activeTab === 'chart' && renderChart()}
      </main>

      {/* Bottom Navigation - Home, Market, Trade, Chart, More */}
      <nav className={`fixed bottom-0 left-0 right-0 ${colors.bgCard} border-t ${colors.border} z-40 safe-area-pb ${colors.shadow}`}>
        <div className="flex items-center justify-around h-14">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'market', icon: BarChart2, label: 'Market' },
            { id: 'trade', icon: TrendingUp, label: 'Trade' },
            { id: 'chart', icon: LineChart, label: 'Chart' },
            { id: 'more', icon: MoreHorizontal, label: 'More' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'more') {
                  setShowMoreMenu(true)
                } else {
                  setActiveTab(item.id)
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                activeTab === item.id ? (isDarkMode ? 'text-accent-green' : 'text-blue-600') : colors.textMuted
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Order Panel Slide-up */}
      {showOrderPanel && selectedInstrument && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowOrderPanel(false)} />
          <div className={`absolute bottom-0 left-0 right-0 ${colors.bgCard} rounded-t-3xl animate-slide-up max-h-[80vh] overflow-auto ${colors.shadowMd}`}>
            <div className="flex justify-center pt-3 pb-2">
              <div className={`w-10 h-1 ${isDarkMode ? 'bg-gray-600' : 'bg-slate-300'} rounded-full`} />
            </div>
            
            <div className="px-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`${colors.textPrimary} font-semibold text-lg`}>{selectedInstrument.symbol}</h3>
                  <p className={`${colors.textMuted} text-sm`}>{selectedInstrument.name}</p>
                </div>
                <button onClick={() => setShowOrderPanel(false)} className="p-2">
                  <X size={20} className={colors.textSecondary} />
                </button>
              </div>

              {/* Leverage Display */}
              <div className={`flex items-center justify-between ${colors.bgCardAlt} rounded-lg px-4 py-2 mb-4`}>
                <span className={`${colors.textSecondary} text-sm`}>Leverage</span>
                <span className="text-amber-500 font-bold">{selectedAccount?.leverage || '1:100'}</span>
              </div>

              {/* One-Click Buy/Sell */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => { setOrderSide('SELL'); executeOrder() }}
                  disabled={isExecuting}
                  className="flex-1 py-3 bg-red-600 rounded-xl disabled:opacity-50"
                >
                  <p className="text-white text-xs">SELL</p>
                  <p className="text-white text-lg font-bold">
                    {getPrice(selectedInstrument.symbol).bid?.toFixed(selectedInstrument.category === 'Forex' ? 5 : 2) || '-'}
                  </p>
                </button>
                <button
                  onClick={() => { setOrderSide('BUY'); executeOrder() }}
                  disabled={isExecuting}
                  className="flex-1 py-3 bg-blue-600 rounded-xl disabled:opacity-50"
                >
                  <p className="text-white text-xs">BUY</p>
                  <p className="text-white text-lg font-bold">
                    {getPrice(selectedInstrument.symbol).ask?.toFixed(selectedInstrument.category === 'Forex' ? 5 : 2) || '-'}
                  </p>
                </button>
              </div>

              {/* Prices Info */}
              <div className="flex items-center justify-center mb-4 text-xs">
                <span className={colors.textMuted}>Spread: </span>
                <span className={`${colors.textPrimary} ml-1`}>
                  {((getPrice(selectedInstrument.symbol).ask - getPrice(selectedInstrument.symbol).bid) * (selectedInstrument.category === 'Forex' ? 10000 : 1)).toFixed(1)} pips
                </span>
              </div>

              {/* Order Type */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setOrderType('market')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    orderType === 'market' 
                      ? (isDarkMode ? 'bg-accent-green text-black' : 'bg-blue-600 text-white') 
                      : `${colors.bgCardAlt} ${colors.textSecondary}`
                  }`}
                >
                  Market
                </button>
                <button
                  onClick={() => setOrderType('pending')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    orderType === 'pending' 
                      ? (isDarkMode ? 'bg-accent-green text-black' : 'bg-blue-600 text-white') 
                      : `${colors.bgCardAlt} ${colors.textSecondary}`
                  }`}
                >
                  Pending
                </button>
              </div>

              {/* Volume */}
              <div className="mb-4">
                <label className={`${colors.textSecondary} text-sm mb-2 block`}>Volume (Lots)</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVolume(prev => Math.max(0.01, parseFloat(prev) - 0.01).toFixed(2))}
                    className={`p-3 ${colors.bgCardAlt} rounded-lg`}
                  >
                    <Minus size={18} className={colors.textPrimary} />
                  </button>
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className={`flex-1 ${colors.bgCardAlt} border ${colors.border} rounded-lg px-4 py-3 ${colors.textPrimary} text-center`}
                  />
                  <button
                    onClick={() => setVolume(prev => (parseFloat(prev) + 0.01).toFixed(2))}
                    className={`p-3 ${colors.bgCardAlt} rounded-lg`}
                  >
                    <Plus size={18} className={colors.textPrimary} />
                  </button>
                </div>
              </div>

              {/* SL/TP */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className={`${colors.textSecondary} text-sm mb-2 block`}>Stop Loss</label>
                  <input
                    type="text"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="Optional"
                    className={`w-full ${colors.bgCardAlt} border ${colors.border} rounded-lg px-4 py-3 ${colors.textPrimary}`}
                  />
                </div>
                <div>
                  <label className={`${colors.textSecondary} text-sm mb-2 block`}>Take Profit</label>
                  <input
                    type="text"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="Optional"
                    className={`w-full ${colors.bgCardAlt} border ${colors.border} rounded-lg px-4 py-3 ${colors.textPrimary}`}
                  />
                </div>
              </div>

              {/* Buy/Sell Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setOrderSide('SELL'); executeOrder() }}
                  disabled={isExecuting}
                  className="flex-1 py-4 bg-red-500 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {isExecuting ? 'Executing...' : 'SELL'}
                </button>
                <button
                  onClick={() => { setOrderSide('BUY'); executeOrder() }}
                  disabled={isExecuting}
                  className="flex-1 py-4 bg-blue-500 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {isExecuting ? 'Executing...' : 'BUY'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* More Menu */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMoreMenu(false)} />
          <div className={`absolute bottom-0 left-0 right-0 ${colors.bgCard} rounded-t-3xl animate-slide-up ${colors.shadowMd}`}>
            <div className="flex justify-center pt-3 pb-2">
              <div className={`w-10 h-1 ${isDarkMode ? 'bg-gray-600' : 'bg-slate-300'} rounded-full`} />
            </div>
            
            <div className="px-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${colors.textPrimary} font-semibold text-lg`}>More</h3>
                <button onClick={() => setShowMoreMenu(false)} className="p-2">
                  <X size={20} className={colors.textSecondary} />
                </button>
              </div>
              
              <div className="space-y-1">
                {moreMenuItems.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => { 
                      if (item.action) {
                        item.action()
                      } else {
                        navigate(item.path)
                      }
                      setShowMoreMenu(false) 
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl hover:${colors.bgHover}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${colors.bgCardAlt} rounded-full flex items-center justify-center`}>
                        <item.icon size={20} className={isDarkMode ? 'text-accent-green' : 'text-blue-600'} />
                      </div>
                      <span className={`${colors.textPrimary} font-medium`}>{item.name}</span>
                    </div>
                    <ChevronRight size={20} className={colors.textMuted} />
                  </button>
                ))}
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-red-500/10 mt-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                      <LogOut size={20} className="text-red-500" />
                    </div>
                    <span className="text-red-500 font-medium">Log Out</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS-Style Modify SL/TP Modal */}
      {showModifyModal && selectedTradeForModify && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowModifyModal(false)}>
          <div className="w-full bg-[#1c1c1e] rounded-t-3xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700/50 text-center">
              <h3 className="text-white font-semibold text-lg">Modify Trade</h3>
              <p className="text-gray-400 text-sm mt-1">
                {selectedTradeForModify.symbol} • {selectedTradeForModify.side} • {selectedTradeForModify.quantity} lots
              </p>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Stop Loss</label>
                <input
                  type="number"
                  value={modifySL}
                  onChange={(e) => setModifySL(e.target.value)}
                  placeholder="Enter stop loss price"
                  step="0.00001"
                  className="w-full bg-[#2c2c2e] border border-gray-600 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Take Profit</label>
                <input
                  type="number"
                  value={modifyTP}
                  onChange={(e) => setModifyTP(e.target.value)}
                  placeholder="Enter take profit price"
                  step="0.00001"
                  className="w-full bg-[#2c2c2e] border border-gray-600 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-700/50">
              <button
                onClick={handleModifyTrade}
                disabled={isModifying}
                className="w-full py-4 text-blue-500 font-semibold text-lg border-b border-gray-700/50 disabled:opacity-50"
              >
                {isModifying ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setShowModifyModal(false)}
                className="w-full py-4 text-gray-400 font-medium text-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS-Style Notifications */}
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="pointer-events-auto mx-4 mt-4 animate-slide-down"
            style={{ marginTop: `${index * 60 + 16}px` }}
          >
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl shadow-lg ${
              notification.type === 'success' 
                ? 'bg-green-500/90' 
                : notification.type === 'error' 
                  ? 'bg-red-500/90' 
                  : 'bg-gray-800/90'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                notification.type === 'success' ? 'bg-white/20' : 'bg-white/20'
              }`}>
                {notification.type === 'success' ? (
                  <Check size={18} className="text-white" />
                ) : (
                  <X size={18} className="text-white" />
                )}
              </div>
              <p className="text-white font-medium text-sm flex-1">{notification.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MobileTradingApp
