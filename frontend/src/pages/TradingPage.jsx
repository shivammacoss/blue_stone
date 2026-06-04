import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Search, Star, X, Plus, Minus, Settings, Home, Wallet, LayoutGrid, BarChart3, Pencil, Trophy, AlertTriangle, Sun, Moon, Grid2X2, Download, RefreshCw, TrendingUp, Lock } from 'lucide-react'
import bluestoneLogo from '../assets/logo.png'
import priceService from '../services/priceService'
import binanceApiService from '../services/binanceApi'
import priceStreamService from '../services/priceStream'
import { useTheme } from '../context/ThemeContext'
import { API_URL } from '../config/api'
import toast from 'react-hot-toast'
import TVChartContainer from '../components/TVChartContainer'

const TradingPage = () => {
  const navigate = useNavigate()
  const { accountId } = useParams()
  const [searchParams] = useSearchParams()
  const accountType = searchParams.get('type') // 'challenge' or null for regular
  const { isDarkMode, toggleDarkMode } = useTheme()
  
  const [account, setAccount] = useState(null)
  const [challengeAccount, setChallengeAccount] = useState(null)
  const [challengeRules, setChallengeRules] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [selectedInstrument, setSelectedInstrument] = useState({ symbol: 'XAUUSD', name: 'CFDs on Gold (US$ / OZ)', bid: 0, ask: 0, spread: 0 })
  const [showInstruments, setShowInstruments] = useState(window.innerWidth >= 768)
  const [showOrderPanel, setShowOrderPanel] = useState(window.innerWidth >= 768)
  const [orderTab, setOrderTab] = useState('Market')
  const [volume, setVolume] = useState('0.01')
  const [leverage, setLeverage] = useState('1:100')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [activePositionTab, setActivePositionTab] = useState('Positions')
  const [oneClickTrading, setOneClickTrading] = useState(false)
  const [selectedSide, setSelectedSide] = useState('BUY') // BUY or SELL
  const [openTabs, setOpenTabs] = useState([{ symbol: 'XAUUSD', name: 'CFDs on Gold (US$ / OZ)', bid: 0, ask: 0, spread: 0 }])
  const [activeTab, setActiveTab] = useState('XAUUSD')
  const [showFourCharts, setShowFourCharts] = useState(false)
  const [fourChartTimeframes, setFourChartTimeframes] = useState(['5', '15', '60', '240']) // 5m, 15m, 1h, 4h
  const [showTakeProfit, setShowTakeProfit] = useState(false)
  const [showStopLoss, setShowStopLoss] = useState(false)
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [pendingOrderType, setPendingOrderType] = useState('BUY LIMIT')
  const [entryPrice, setEntryPrice] = useState('')
  // Initialize with empty instruments - will be fetched from API
  const [instruments, setInstruments] = useState([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [starredSymbols, setStarredSymbols] = useState(() => {
    const saved = localStorage.getItem('starredSymbols')
    return saved ? JSON.parse(saved) : ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD']
  })
  
  // Fetch all instruments from API
  const fetchInstruments = async () => {
    try {
      const res = await fetch(`${API_URL}/prices/instruments`)
      const data = await res.json()
      if (data.success && data.instruments) {
        const instrumentsWithState = data.instruments.map(inst => ({
          ...inst,
          bid: inst.bid || 0,
          ask: inst.ask || 0,
          spread: 0,
          change: typeof inst.changePercent === 'number' ? inst.changePercent : 0,
          starred: starredSymbols.includes(inst.symbol)
        }))
        setInstruments(instrumentsWithState)
        setLoadingInstruments(false)
      } else {
        setLoadingInstruments(false)
      }
    } catch (err) {
      console.error('Error fetching instruments:', err)
      setLoadingInstruments(false)
    }
  }
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [openTrades, setOpenTrades] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [tradeHistory, setTradeHistory] = useState([])
  const [isExecutingTrade, setIsExecutingTrade] = useState(false)
  const [tradeError, setTradeError] = useState('')
  const [tradeSuccess, setTradeSuccess] = useState('')
  // Popup shown when the user tries to trade on a locked Algo account.
  const [algoLockPopup, setAlgoLockPopup] = useState(null) // { message, daysRemaining }
  const [accountSummary, setAccountSummary] = useState({
    balance: 0,
    credit: 0,
    equity: 0,
    usedMargin: 0,
    freeMargin: 0,
    floatingPnl: 0
  })
  const [livePrices, setLivePrices] = useState({}) // Store live prices separately
  const [adminSpreads, setAdminSpreads] = useState({}) // Store admin-set spreads
  const adminSpreadsRef = useRef({}) // Ref to access latest adminSpreads in intervals
  
  // History filter states
  const [historyFilter, setHistoryFilter] = useState('all') // all, today, week, month, year
  const [historyStartDate, setHistoryStartDate] = useState('')
  const [historyEndDate, setHistoryEndDate] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const historyPerPage = 20
  
  // Deposit/Withdraw Modal states
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [transferError, setTransferError] = useState('')
  
  // Modal states for iOS-style popups
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showCloseAllModal, setShowCloseAllModal] = useState(false)
  const [selectedTradeForModify, setSelectedTradeForModify] = useState(null)
  const [selectedTradeForClose, setSelectedTradeForClose] = useState(null)
  const [closeAllType, setCloseAllType] = useState('all') // 'all', 'profit', 'loss'
  const [modifySL, setModifySL] = useState('')
  const [modifyTP, setModifyTP] = useState('')
  
  // Kill Switch states
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false)
  const [killSwitchActive, setKillSwitchActive] = useState(false)
  const [killSwitchEndTime, setKillSwitchEndTime] = useState(null)
  const [killSwitchDuration, setKillSwitchDuration] = useState({ value: 30, unit: 'minutes' })
  const [killSwitchTimeLeft, setKillSwitchTimeLeft] = useState('')
  const [globalNotification, setGlobalNotification] = useState('')

  const categories = ['All', 'Starred', 'Forex', 'Metals', 'Commodities', 'Crypto', 'Indices']

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Toggle star/watchlist
  const toggleStar = (symbol) => {
    setStarredSymbols(prev => {
      const next = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      // Save to localStorage for persistence
      localStorage.setItem('starredSymbols', JSON.stringify(next))
      // Update instruments state to reflect starred flag
      setInstruments(insts => insts.map(inst => inst.symbol === symbol ? { ...inst, starred: next.includes(symbol) } : inst))
      return next
    })
  }

  useEffect(() => {
    fetchAccount()
    // Fetch all instruments from API
    fetchInstruments()
    // Fetch admin-set spreads FIRST, then fetch live prices
    fetchAdminSpreads().then(() => {
      fetchLivePrices()
    })
    
    // Refresh prices every 2 seconds for real-time P/L updates
    const priceInterval = setInterval(() => {
      fetchLivePrices()
    }, 2000)
    
    return () => {
      clearInterval(priceInterval)
      priceService.disconnect()
    }
  }, [accountId])

  // Fetch open trades and account summary when account is loaded
  useEffect(() => {
    if (accountId) {
      fetchOpenTrades()
      fetchPendingOrders()
      fetchTradeHistory()
      fetchAccountSummary()
      
      // Refresh account data every 5 seconds to keep balance in sync
      const accountInterval = setInterval(() => {
        fetchOpenTrades()
        fetchAccountSummary()
      }, 5000)
      
      return () => clearInterval(accountInterval)
    }
  }, [accountId])

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Keep order panel visible on desktop, hide on mobile by default
      if (!mobile) {
        setShowOrderPanel(true)
        setShowInstruments(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Real-time price updates via WebSocket for institutional-grade streaming
  useEffect(() => {
    // Subscribe to WebSocket price stream
    const unsubscribe = priceStreamService.subscribe('tradingPage', (prices, updated, timestamp) => {
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
      
      // Get latest admin spreads from ref
      const currentAdminSpreads = adminSpreadsRef.current
      
      // Update instruments with live prices + admin spread (only if price is valid)
      setInstruments(prev => prev.map(inst => {
        const priceData = prices[inst.symbol]
        if (priceData && priceData.bid && priceData.bid > 0) {
          const bid = priceData.bid
          const marketAsk = priceData.ask || priceData.bid
          // Apply admin spread if set. When admin spread is 0, collapse
          // bid and ask to the same price so they render identically.
          const adminSpread = currentAdminSpreads[inst.symbol]?.spread || 0
          const ask = adminSpread === 0 ? bid : marketAsk + adminSpread
          const spread = Math.abs(ask - bid)
          const change = typeof priceData.changePercent === 'number' ? priceData.changePercent : inst.change
          return { ...inst, bid, ask, spread, change }
        }
        return inst
      }))

      // Update selected instrument with admin spread (only if price is valid)
      const selectedPrice = prices[selectedInstrument?.symbol]
      if (selectedPrice && selectedPrice.bid && selectedPrice.bid > 0) {
        const marketAsk = selectedPrice.ask || selectedPrice.bid
        const adminSpread = currentAdminSpreads[selectedInstrument?.symbol]?.spread || 0
        const ask = adminSpread === 0 ? selectedPrice.bid : marketAsk + adminSpread
        setSelectedInstrument(prev => ({
          ...prev,
          bid: selectedPrice.bid,
          ask: ask,
          spread: Math.abs(ask - selectedPrice.bid)
        }))
      }
    })
    
    // Fallback: also fetch via HTTP for initial load
    fetchLivePrices()
    
    return () => unsubscribe()
  }, [selectedInstrument?.symbol])

  // Kill Switch - Check localStorage on load and update timer
  useEffect(() => {
    // Check auth status on mount
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!token || !user._id) {
        navigate('/user/login')
        return
      }
      
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        
        if (data.forceLogout || res.status === 403) {
          toast.error(data.message || 'Session expired. Please login again.')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/user/login')
          return
        }
      } catch (error) {
        console.error('Auth check error:', error)
      }
    }
    checkAuthStatus()

    // Check if kill switch is active from localStorage
    const savedKillSwitch = localStorage.getItem(`killSwitch_${accountId}`)
    if (savedKillSwitch) {
      const endTime = parseInt(savedKillSwitch)
      if (endTime > Date.now()) {
        setKillSwitchActive(true)
        setKillSwitchEndTime(endTime)
      } else {
        localStorage.removeItem(`killSwitch_${accountId}`)
      }
    }
  }, [accountId])

  // Kill Switch countdown timer
  useEffect(() => {
    if (!killSwitchActive || !killSwitchEndTime) return
    
    const updateTimer = () => {
      const now = Date.now()
      const remaining = killSwitchEndTime - now
      
      if (remaining <= 0) {
        setKillSwitchActive(false)
        setKillSwitchEndTime(null)
        setKillSwitchTimeLeft('')
        localStorage.removeItem(`killSwitch_${accountId}`)
        return
      }
      
      // Format time remaining
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
      
      let timeStr = ''
      if (days > 0) timeStr += `${days}d `
      if (hours > 0 || days > 0) timeStr += `${hours}h `
      if (minutes > 0 || hours > 0 || days > 0) timeStr += `${minutes}m `
      timeStr += `${seconds}s`
      
      setKillSwitchTimeLeft(timeStr.trim())
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [killSwitchActive, killSwitchEndTime, accountId])

  // Update account summary when prices change (for real-time equity/margin)
  useEffect(() => {
    // Skip if no live prices yet (prevent flickering to zero)
    if (Object.keys(livePrices).length === 0) return
    
    // Calculate total floating PnL from current prices
    let totalFloatingPnl = 0
    let totalUsedMargin = 0
    let hasValidPrices = false
    
    if (openTrades.length > 0) {
      openTrades.forEach(trade => {
        // Use livePrices first, fallback to instruments
        const livePrice = livePrices[trade.symbol]
        const inst = instruments.find(i => i.symbol === trade.symbol)
        
        // Only calculate if we have a valid price
        const currentPrice = livePrice?.bid 
          ? (trade.side === 'BUY' ? livePrice.bid : livePrice.ask)
          : (inst?.bid ? (trade.side === 'BUY' ? inst.bid : inst.ask) : null)
        
        if (currentPrice && currentPrice > 0) {
          hasValidPrices = true
          const pnl = trade.side === 'BUY'
            ? (currentPrice - trade.openPrice) * trade.quantity * trade.contractSize
            : (trade.openPrice - currentPrice) * trade.quantity * trade.contractSize
          totalFloatingPnl += pnl - (trade.commission || 0) - (trade.swap || 0)
        }
        totalUsedMargin += trade.marginUsed || 0
      })
    }
    
    // Only update if we have valid prices (prevent flickering to zero)
    if (!hasValidPrices && openTrades.length > 0) return
    
    // Always update account summary with real-time values
    const newEquity = Math.round((accountSummary.balance + (accountSummary.credit || 0) + totalFloatingPnl) * 100) / 100
    // Free Margin = Balance - Used Margin (not equity based)
    const newFreeMargin = Math.round((accountSummary.balance - totalUsedMargin) * 100) / 100
    
    setAccountSummary(prev => ({
      ...prev,
      floatingPnl: Math.round(totalFloatingPnl * 100) / 100,
      usedMargin: Math.round(totalUsedMargin * 100) / 100,
      equity: newEquity,
      freeMargin: newFreeMargin
    }))
    
    // CRITICAL: Check for stop out condition - equity <= 0 or free margin < 0
    if (openTrades.length > 0 && (newEquity <= 0 || newFreeMargin < -totalUsedMargin)) {
      checkStopOut()
    }
  }, [livePrices, instruments, openTrades])

  
  // Fetch live prices in background (non-blocking)
  const fetchLivePrices = async () => {
    try {
      // Get symbols from instruments for price display
      const instrumentSymbols = instruments.map(i => i.symbol)
      
      // Always include XAUUSD for SL/TP checking even if not in instruments
      const defaultSymbols = ['XAUUSD', 'EURUSD', 'GBPUSD']
      const allSymbols = [...new Set([...instrumentSymbols, ...defaultSymbols])]
      
      if (allSymbols.length === 0) return
      
      // Single batch call to backend (handles both MetaAPI and Binance)
      const allPrices = await priceService.getAllPrices(allSymbols)
      
      // Always update livePrices state for open trades display
      if (Object.keys(allPrices).length > 0) {
        setLoadingInstruments(false) // Prices loaded
        setLivePrices(prev => ({ ...prev, ...allPrices }))
        
        // Get latest admin spreads from ref (not stale state)
        const currentAdminSpreads = adminSpreadsRef.current
        
        setInstruments(prev => prev.map(inst => {
          const priceData = allPrices[inst.symbol]
          if (priceData && priceData.bid) {
            // Use bid for both if ask not provided, add admin spread.
            // When admin spread is 0, collapse bid and ask to the same price
            // (matches WebSocket path and commit b0988be8 behavior).
            const bid = priceData.bid
            const marketAsk = priceData.ask || priceData.bid
            const adminSpread = currentAdminSpreads[inst.symbol]?.spread || 0
            const ask = adminSpread === 0 ? bid : marketAsk + adminSpread
            const spread = Math.abs(ask - bid)
            const change = typeof priceData.changePercent === 'number' ? priceData.changePercent : inst.change
            return {
              ...inst,
              bid: bid,
              ask: ask,
              spread: spread,
              change
            }
          }
          return inst
        }))
        
        // Update selected instrument with live prices + admin spread
        setSelectedInstrument(prev => {
          const priceData = allPrices[prev.symbol]
          if (priceData && priceData.bid) {
            const bid = priceData.bid
            const marketAsk = priceData.ask || priceData.bid
            const adminSpread = currentAdminSpreads[prev.symbol]?.spread || 0
            const ask = adminSpread === 0 ? bid : marketAsk + adminSpread
            if (adminSpread > 0) {
              console.log(`[Spread] ${prev.symbol}: marketAsk=${marketAsk}, adminSpread=${adminSpread}, finalAsk=${ask}`)
            }
            return {
              ...prev,
              bid: bid,
              ask: ask,
              spread: Math.abs(ask - bid)
            }
          }
          return prev
        })

        // Update open tabs with live prices + admin spread
        setOpenTabs(prev => prev.map(tab => {
          const priceData = allPrices[tab.symbol]
          if (priceData && priceData.bid) {
            const bid = priceData.bid
            const marketAsk = priceData.ask || priceData.bid
            const adminSpread = currentAdminSpreads[tab.symbol]?.spread || 0
            const ask = adminSpread === 0 ? bid : marketAsk + adminSpread
            return {
              ...tab,
              bid: bid,
              ask: ask,
              spread: Math.abs(ask - bid)
            }
          }
          return tab
        }))

        // Check pending orders and SL/TP for all trades
        if (Object.keys(allPrices).length > 0) {
          try {
            // Check pending orders for execution
            const pendingRes = await fetch(`${API_URL}/trade/check-pending`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prices: allPrices })
            })
            const pendingData = await pendingRes.json()
            if (pendingData.success && pendingData.executedCount > 0) {
              fetchOpenTrades()
              fetchPendingOrders()
              pendingData.executedTrades.forEach(et => {
                setTradeSuccess(`${et.orderType} executed: ${et.symbol} ${et.side} @ ${et.executionPrice?.toFixed(5)}`)
              })
            }
            
            // Check SL/TP for all trades (auto-close when hit)
            // Always call check-sltp - backend will query all open trades
            const slTpRes = await fetch(`${API_URL}/trade/check-sltp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prices: allPrices })
            })
            if (!slTpRes.ok) {
              console.error('SL/TP check failed:', slTpRes.status)
              return
            }
            const slTpData = await slTpRes.json()
            if (slTpData.success && slTpData.closedCount > 0) {
              console.log('SL/TP triggered:', slTpData.closedTrades)
              // Refresh trades if any were closed by SL/TP
              fetchOpenTrades()
              fetchTradeHistory()
              // Show notification
              slTpData.closedTrades.forEach(ct => {
                setTradeSuccess(`Trade ${ct.symbol} closed by ${ct.reason}: ${ct.pnl >= 0 ? '+' : ''}$${ct.pnl.toFixed(2)}`)
              })
            }
          } catch (e) {
            console.error('SL/TP check error:', e)
          }
        }
      }
    } catch (e) {
      console.error('Live prices error:', e)
    }
  }

  const getSymbolCategory = (symbol) => {
    if (['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'].includes(symbol)) return 'Metals'
    if (['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'BCHUSD', 'BNBUSD', 'SOLUSD', 'ADAUSD', 'DOGEUSD', 'DOTUSD', 'MATICUSD', 'AVAXUSD', 'LINKUSD'].includes(symbol)) return 'Crypto'
    if (['US30', 'US500', 'NAS100', 'UK100', 'GER40', 'FRA40', 'JPN225'].includes(symbol)) return 'Indices'
    return 'Forex'
  }

  // Fetch admin-set spreads for instruments
  const fetchAdminSpreads = async () => {
    try {
      const res = await fetch(`${API_URL}/charges/spreads`)
      const data = await res.json()
      console.log('[AdminSpreads] Fetched:', data)
      if (data.success) {
        const spreads = data.spreads || {}
        console.log('[AdminSpreads] Setting spreads:', spreads)
        setAdminSpreads(spreads)
        adminSpreadsRef.current = spreads // Update ref for use in intervals
      }
    } catch (error) {
      console.error('Error fetching admin spreads:', error)
    }
  }

  // Fetch wallet balance (same as Account.jsx)
  const fetchWalletBalance = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!user._id) {
        console.error('User ID not found in localStorage')
        return
      }
      const res = await fetch(`${API_URL}/wallet/${user._id}`)
      const data = await res.json()
      setWalletBalance(data.wallet?.balance || 0)
    } catch (error) {
      console.error('Error fetching wallet balance:', error)
    }
  }

  // Handle deposit (Main Wallet → Account)
  const handleDeposit = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setTransferError('Please enter a valid amount')
      return
    }
    if (parseFloat(transferAmount) > walletBalance) {
      setTransferError('Insufficient wallet balance')
      return
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const res = await fetch(`${API_URL}/trading-accounts/${account._id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          amount: parseFloat(transferAmount),
          direction: 'deposit',
          skipPinVerification: true
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success('Funds deposited successfully!')
        setShowDepositModal(false)
        setTransferAmount('')
        setTransferError('')
        fetchAccountSummary()
        fetchWalletBalance()
      } else {
        setTransferError(data.message || 'Deposit failed')
      }
    } catch (error) {
      console.error('Deposit error:', error)
      setTransferError('Error depositing funds')
    }
  }

  // Handle withdraw (Account → Main Wallet)
  const handleWithdraw = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setTransferError('Please enter a valid amount')
      return
    }
    if (parseFloat(transferAmount) > accountSummary.balance) {
      setTransferError('Insufficient account balance')
      return
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const res = await fetch(`${API_URL}/trading-accounts/${account._id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          amount: parseFloat(transferAmount),
          direction: 'withdraw',
          skipPinVerification: true
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success('Funds withdrawn successfully!')
        setShowWithdrawModal(false)
        setTransferAmount('')
        setTransferError('')
        fetchAccountSummary()
        fetchWalletBalance()
      } else {
        setTransferError(data.message || 'Withdrawal failed')
      }
    } catch (error) {
      console.error('Withdraw error:', error)
      setTransferError('Error withdrawing funds')
    }
  }

  // Fetch open trades
  const fetchOpenTrades = async () => {
    try {
      const res = await fetch(`${API_URL}/trade/open/${accountId}`)
      const data = await res.json()
      if (data.success) {
        setOpenTrades(data.trades || [])
      }
    } catch (error) {
      console.error('Error fetching open trades:', error)
    }
  }

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/trade/pending/${accountId}`)
      const data = await res.json()
      if (data.success) {
        setPendingOrders(data.trades || [])
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error)
    }
  }

  // Fetch trade history (closed trades)
  const fetchTradeHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/trade/history/${accountId}`)
      const data = await res.json()
      if (data.success) {
        setTradeHistory(data.trades || [])
      }
    } catch (error) {
      console.error('Error fetching trade history:', error)
    }
  }

  // Filter trade history based on selected filter
  const getFilteredHistory = () => {
    const now = new Date()
    return tradeHistory.filter(trade => {
      const tradeDate = new Date(trade.closedAt)
      
      // Date range filter (takes priority if both dates are set)
      if (historyStartDate && historyEndDate) {
        const start = new Date(historyStartDate)
        const end = new Date(historyEndDate)
        end.setHours(23, 59, 59, 999)
        return tradeDate >= start && tradeDate <= end
      }
      
      if (historyFilter === 'all') return true
      if (historyFilter === 'today') {
        return tradeDate.toDateString() === now.toDateString()
      }
      if (historyFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return tradeDate >= weekAgo
      }
      if (historyFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return tradeDate >= monthAgo
      }
      if (historyFilter === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        return tradeDate >= yearAgo
      }
      return true
    })
  }

  // Calculate total P&L for filtered history
  const getHistoryTotalPnl = () => {
    return getFilteredHistory().reduce((sum, trade) => sum + (trade.realizedPnl || 0), 0)
  }

  // Download trade history as CSV
  const downloadHistoryCSV = () => {
    const filtered = getFilteredHistory()
    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Open Price', 'Close Price', 'Commission', 'Swap', 'P&L', 'Closed By']
    const rows = filtered.map(trade => [
      new Date(trade.closedAt).toLocaleString(),
      trade.symbol,
      trade.side,
      trade.quantity,
      trade.openPrice?.toFixed(5),
      trade.closePrice?.toFixed(5),
      trade.commission?.toFixed(2) || '0.00',
      trade.swap?.toFixed(2) || '0.00',
      trade.realizedPnl?.toFixed(2) || '0.00',
      trade.closedBy || 'USER'
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade_history_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Fetch account summary with current prices
  const fetchAccountSummary = async () => {
    try {
      // Build prices object from instruments
      const pricesObj = {}
      instruments.forEach(inst => {
        if (inst.bid && inst.ask) {
          pricesObj[inst.symbol] = { bid: inst.bid, ask: inst.ask }
        }
      })
      
      const pricesParam = encodeURIComponent(JSON.stringify(pricesObj))
      const res = await fetch(`${API_URL}/trade/summary/${accountId}?prices=${pricesParam}`)
      const data = await res.json()
      if (data.success) {
        setAccountSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching account summary:', error)
    }
  }

  // Check stop out - close all trades if equity goes negative
  const checkStopOut = async () => {
    try {
      const pricesObj = {}
      instruments.forEach(inst => {
        if (inst.bid && inst.ask) {
          pricesObj[inst.symbol] = { bid: inst.bid, ask: inst.ask }
        }
      })

      const res = await fetch(`${API_URL}/trade/check-stopout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradingAccountId: accountId,
          prices: pricesObj
        })
      })

      const data = await res.json()
      if (data.success && data.stopOutTriggered) {
        toast.error(`⚠️ STOP OUT: ${data.message} - All your trades have been closed to prevent further losses.`)
        fetchOpenTrades()
        fetchAccountSummary()
        fetchTradeHistory()
      }
    } catch (error) {
      console.error('Error checking stop out:', error)
    }
  }

  // Activate Kill Switch
  const activateKillSwitch = (customDuration = null) => {
    const multipliers = { seconds: 1000, minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 }
    const durationConfig = customDuration || killSwitchDuration
    const duration = durationConfig.value * multipliers[durationConfig.unit]
    const endTime = Date.now() + duration
    
    setKillSwitchActive(true)
    setKillSwitchEndTime(endTime)
    localStorage.setItem(`killSwitch_${accountId}`, endTime.toString())
    setShowKillSwitchModal(false)
    
    // Show global notification at top
    const timeStr = `${durationConfig.value} ${durationConfig.unit}`
    setGlobalNotification(`🛑 Kill Switch activated for ${timeStr}! Trading is now blocked.`)
    setTimeout(() => setGlobalNotification(''), 5000)
  }

  // Quick activate Kill Switch with default 30 minutes (one-click)
  const quickActivateKillSwitch = () => {
    activateKillSwitch({ value: 30, unit: 'minutes' })
  }

  // Deactivate Kill Switch
  const deactivateKillSwitch = () => {
    setKillSwitchActive(false)
    setKillSwitchEndTime(null)
    setKillSwitchTimeLeft('')
    localStorage.removeItem(`killSwitch_${accountId}`)
    
    // Show global notification at top
    setGlobalNotification('✅ Kill Switch deactivated. Trading is now enabled.')
    setTimeout(() => setGlobalNotification(''), 3000)
  }

  // Execute Market Order (BUY or SELL)
  const executeMarketOrder = async (side) => {
    // Check Kill Switch
    if (killSwitchActive) {
      setTradeError(`Trading blocked! Kill Switch active for ${killSwitchTimeLeft}`)
      return
    }
    
    setIsExecutingTrade(true)
    setTradeError('')
    setTradeSuccess('')

    try {
      const segment = getSymbolCategory(selectedInstrument.symbol)
      
      // Use livePrices first (real-time), fallback to selectedInstrument
      const livePrice = livePrices[selectedInstrument.symbol]
      const bid = livePrice?.bid || selectedInstrument.bid
      const ask = livePrice?.ask || selectedInstrument.ask
      
      if (!bid || !ask || bid <= 0 || ask <= 0 || isNaN(bid) || isNaN(ask)) {
        setTradeError('Market is closed or no price data available. Trading is not available at this time.')
        setIsExecutingTrade(false)
        return
      }
      
      const res = await fetch(`${API_URL}/trade/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          tradingAccountId: accountId,
          symbol: selectedInstrument.symbol,
          segment,
          side,
          orderType: 'MARKET',
          quantity: parseFloat(volume),
          bid,
          ask,
          leverage: leverage, // Send selected leverage
          sl: showStopLoss && stopLoss ? parseFloat(stopLoss) : null,
          tp: showTakeProfit && takeProfit ? parseFloat(takeProfit) : null
        })
      })

      const data = await res.json()

      if (data.success) {
        setTradeSuccess(`${side} order executed successfully!`)
        fetchOpenTrades()
        fetchAccountSummary()
        // Clear SL/TP after successful trade
        setStopLoss('')
        setTakeProfit('')
        setShowStopLoss(false)
        setShowTakeProfit(false)
      } else {
        // Algo account locked — show a blocking popup instead of an inline error
        if (data.code === 'ALGO_LOCKED') {
          setAlgoLockPopup({ message: data.message, daysRemaining: data.daysRemaining })
          setIsExecutingTrade(false)
          return
        }

        // Check if account failed due to rule violations
        if (data.accountFailed) {
          // Redirect to account page with fail reason
          navigate(`/account?failed=true&reason=${encodeURIComponent(data.failReason || data.message)}`)
          return
        }

        // Show warning count if available
        if (data.warningCount > 0) {
          setTradeError(`${data.message} (Warning ${data.warningCount}/3 - ${data.remainingWarnings} remaining before account fails)`)
        } else {
          setTradeError(data.message || 'Failed to execute order')
        }
      }
    } catch (error) {
      console.error('Error executing trade:', error)
      setTradeError('Failed to execute order. Please try again.')
    }

    setIsExecutingTrade(false)
    
    // Clear messages after 3 seconds
    setTimeout(() => {
      setTradeError('')
      setTradeSuccess('')
    }, 3000)
  }

  // Get pending order price validation warning (real-time like MT5)
  const getPendingOrderWarning = () => {
    if (!entryPrice) return null
    
    const livePrice = livePrices[selectedInstrument?.symbol]
    const currentBid = livePrice?.bid || selectedInstrument?.bid || 0
    const currentAsk = livePrice?.ask || selectedInstrument?.ask || 0
    const price = parseFloat(entryPrice)
    
    if (isNaN(price) || price <= 0) return null
    if (currentBid === 0 || currentAsk === 0) return null
    
    const orderType = pendingOrderType.replace(' ', '_')
    
    switch (orderType) {
      case 'BUY_LIMIT':
        if (price >= currentAsk) {
          return `Buy Limit must be below Ask (${currentAsk.toFixed(5)})`
        }
        break
      case 'SELL_LIMIT':
        if (price <= currentBid) {
          return `Sell Limit must be above Bid (${currentBid.toFixed(5)})`
        }
        break
      case 'BUY_STOP':
        if (price <= currentAsk) {
          return `Buy Stop must be above Ask (${currentAsk.toFixed(5)})`
        }
        break
      case 'SELL_STOP':
        if (price >= currentBid) {
          return `Sell Stop must be below Bid (${currentBid.toFixed(5)})`
        }
        break
    }
    return null
  }
  
  const pendingOrderWarning = getPendingOrderWarning()

  // Execute Pending Order
  const executePendingOrder = async () => {
    // Check Kill Switch
    if (killSwitchActive) {
      setTradeError(`Trading blocked! Kill Switch active for ${killSwitchTimeLeft}`)
      return
    }
    
    setIsExecutingTrade(true)
    setTradeError('')
    setTradeSuccess('')

    try {
      const segment = getSymbolCategory(selectedInstrument.symbol)
      const side = pendingOrderType.includes('BUY') ? 'BUY' : 'SELL'
      const orderType = pendingOrderType.replace(' ', '_')

      // For pending orders, send actual market prices for validation + entryPrice for trigger
      const livePrice = livePrices[selectedInstrument.symbol]
      const currentBid = livePrice?.bid || selectedInstrument.bid
      const currentAsk = livePrice?.ask || selectedInstrument.ask
      const pendingEntryPrice = entryPrice ? parseFloat(entryPrice) : null

      // Validate entry price is provided
      if (!pendingEntryPrice) {
        setTradeError('Please enter an entry price for pending order')
        setIsExecutingTrade(false)
        return
      }

      // Validate pending order entry price based on order type
      // BUY_LIMIT: Entry must be BELOW current ask (buy cheaper)
      // SELL_LIMIT: Entry must be ABOVE current bid (sell higher)
      // BUY_STOP: Entry must be ABOVE current ask (breakout buy)
      // SELL_STOP: Entry must be BELOW current bid (breakout sell)
      if (orderType === 'BUY_LIMIT' && pendingEntryPrice >= currentAsk) {
        setTradeError(`Buy Limit price must be below current Ask (${currentAsk.toFixed(5)})`)
        setIsExecutingTrade(false)
        return
      }
      if (orderType === 'SELL_LIMIT' && pendingEntryPrice <= currentBid) {
        setTradeError(`Sell Limit price must be above current Bid (${currentBid.toFixed(5)})`)
        setIsExecutingTrade(false)
        return
      }
      if (orderType === 'BUY_STOP' && pendingEntryPrice <= currentAsk) {
        setTradeError(`Buy Stop price must be above current Ask (${currentAsk.toFixed(5)})`)
        setIsExecutingTrade(false)
        return
      }
      if (orderType === 'SELL_STOP' && pendingEntryPrice >= currentBid) {
        setTradeError(`Sell Stop price must be below current Bid (${currentBid.toFixed(5)})`)
        setIsExecutingTrade(false)
        return
      }
      
      const res = await fetch(`${API_URL}/trade/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          tradingAccountId: accountId,
          symbol: selectedInstrument.symbol,
          segment,
          side,
          orderType,
          quantity: parseFloat(volume),
          bid: currentBid,
          ask: currentAsk,
          entryPrice: pendingEntryPrice, // User's requested trigger price for pending orders
          sl: showStopLoss && stopLoss ? parseFloat(stopLoss) : null,
          tp: showTakeProfit && takeProfit ? parseFloat(takeProfit) : null
        })
      })

      const data = await res.json()

      if (data.success) {
        setTradeSuccess(`${pendingOrderType} order placed successfully!`)
        fetchPendingOrders()
        setEntryPrice('')
      } else if (data.code === 'ALGO_LOCKED') {
        setAlgoLockPopup({ message: data.message, daysRemaining: data.daysRemaining })
      } else {
        setTradeError(data.message || 'Failed to place order')
      }
    } catch (error) {
      console.error('Error placing pending order:', error)
      setTradeError('Failed to place order. Please try again.')
    }

    setIsExecutingTrade(false)
    
    setTimeout(() => {
      setTradeError('')
      setTradeSuccess('')
    }, 3000)
  }

  // Close a trade
  const closeTrade = async (tradeId) => {
    try {
      const trade = openTrades.find(t => t._id === tradeId)
      if (!trade) return

      // Use livePrices first (real-time), fallback to instruments
      const livePrice = livePrices[trade.symbol]
      const instrument = instruments.find(i => i.symbol === trade.symbol) || selectedInstrument
      
      const bid = livePrice?.bid || instrument.bid
      const ask = livePrice?.ask || instrument.ask
      
      if (!bid || !ask || bid === 0 || ask === 0) {
        setTradeError('Price not available. Please wait for prices to load.')
        return
      }

      const res = await fetch(`${API_URL}/trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId,
          bid,
          ask
        })
      })

      const data = await res.json()

      if (data.success) {
        setTradeSuccess(`Trade closed. P/L: $${data.realizedPnl?.toFixed(2)}`)
        fetchOpenTrades()
        fetchTradeHistory()
        fetchAccountSummary()
      } else {
        setTradeError(data.message || 'Failed to close trade')
      }
    } catch (error) {
      console.error('Error closing trade:', error)
      setTradeError('Failed to close trade')
    }

    setTimeout(() => {
      setTradeError('')
      setTradeSuccess('')
    }, 3000)
  }

  // Cancel pending order
  const cancelPendingOrder = async (tradeId) => {
    try {
      const res = await fetch(`${API_URL}/trade/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId })
      })

      const data = await res.json()

      if (data.success) {
        setTradeSuccess('Order cancelled')
        fetchPendingOrders()
      } else {
        setTradeError(data.message || 'Failed to cancel order')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      setTradeError('Failed to cancel order')
    }

    setTimeout(() => {
      setTradeError('')
      setTradeSuccess('')
    }, 3000)
  }

  // Open modify SL/TP modal
  const openModifyModal = (trade) => {
    setSelectedTradeForModify(trade)
    // Check both sl/stopLoss and tp/takeProfit fields for compatibility
    setModifySL((trade.sl || trade.stopLoss)?.toString() || '')
    setModifyTP((trade.tp || trade.takeProfit)?.toString() || '')
    setShowModifyModal(true)
  }

  // Modify trade SL/TP
  const handleModifyTrade = async () => {
    console.log('handleModifyTrade called')
    
    if (!selectedTradeForModify) {
      console.log('No trade selected for modify')
      setTradeError('No trade selected')
      return
    }

    console.log('Modifying trade:', selectedTradeForModify._id, 'SL:', modifySL, 'TP:', modifyTP)
    setTradeError('') // Clear any previous error

    try {
      const requestBody = {
        tradeId: selectedTradeForModify._id,
        sl: modifySL ? parseFloat(modifySL) : null,
        tp: modifyTP ? parseFloat(modifyTP) : null
      }
      console.log('Request body:', JSON.stringify(requestBody))

      const res = await fetch(`${API_URL}/trade/modify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      console.log('Response status:', res.status)
      const data = await res.json()
      console.log('Response data:', data)

      if (data.success) {
        setTradeSuccess('Trade modified successfully')
        fetchOpenTrades()
        setShowModifyModal(false)
      } else {
        console.log('Modify failed:', data.message)
        // If trade is not open, refresh the trades list
        if (data.message?.includes('not open') || data.message?.includes('not found')) {
          fetchOpenTrades()
          setTradeError('This trade is no longer open. Refreshing...')
          setTimeout(() => setShowModifyModal(false), 1500)
        } else {
          setTradeError(data.message || 'Failed to modify trade')
        }
      }
    } catch (error) {
      console.error('Error modifying trade:', error)
      setTradeError('Failed to modify trade: ' + error.message)
    }

    setTimeout(() => {
      setTradeError('')
      setTradeSuccess('')
    }, 3000)
  }

  // Open close confirmation modal
  const openCloseModal = (trade) => {
    setSelectedTradeForClose(trade)
    setShowCloseModal(true)
  }

  // Confirm close trade
  const handleConfirmClose = async () => {
    if (!selectedTradeForClose) return
    await closeTrade(selectedTradeForClose._id)
    setShowCloseModal(false)
  }

  // Close all trades (all, profit only, or loss only)
  const handleCloseAllTrades = async (type) => {
    setCloseAllType(type)
    setShowCloseAllModal(true)
  }

  const confirmCloseAll = async () => {
    const tradesToClose = openTrades.filter(trade => {
      // Use livePrices first, fallback to instruments
      const livePrice = livePrices[trade.symbol]
      const inst = instruments.find(i => i.symbol === trade.symbol) || selectedInstrument
      const currentPrice = livePrice 
        ? (trade.side === 'BUY' ? livePrice.bid : livePrice.ask)
        : (trade.side === 'BUY' ? inst.bid : inst.ask)
      const rawPnl = trade.side === 'BUY' 
        ? (currentPrice - trade.openPrice) * trade.quantity * trade.contractSize
        : (trade.openPrice - currentPrice) * trade.quantity * trade.contractSize
      const pnl = rawPnl - (trade.commission || 0) - (trade.swap || 0)

      if (closeAllType === 'profit') return pnl > 0
      if (closeAllType === 'loss') return pnl < 0
      return true // 'all'
    })

    for (const trade of tradesToClose) {
      await closeTrade(trade._id)
    }

    setShowCloseAllModal(false)
    setTradeSuccess(`Closed ${tradesToClose.length} trade(s)`)
    setTimeout(() => setTradeSuccess(''), 3000)
  }

  const fetchAccount = async () => {
    setLoading(true)
    try {
      if (accountType === 'challenge') {
        // Fetch challenge account dashboard
        const res = await fetch(`${API_URL}/prop/account/${accountId}`)
        const data = await res.json()
        if (data.success && data.account) {
          setChallengeAccount(data)
          setChallengeRules(data.rules || {})
          // Get max leverage from challenge rules
          const challengeMaxLeverage = data.rules?.maxLeverage || 100
          // Create a compatible account object for the trading UI
          setAccount({
            _id: data.account._id,
            accountId: data.account.accountId,
            balance: data.balance?.current || 0,
            equity: data.balance?.equity || 0,
            leverage: `1:${challengeMaxLeverage}`,
            accountType: 'CHALLENGE',
            status: data.account.status
          })
          setLeverage(`1:${challengeMaxLeverage}`)
        } else {
          navigate('/account')
        }
      } else {
        // Fetch regular trading account
        const res = await fetch(`${API_URL}/trading-accounts/user/${user._id}`)
        const data = await res.json()
        const acc = data.accounts?.find(a => a._id === accountId)
        if (acc) {
          setAccount(acc)
          setLeverage(acc.leverage || '1:100')
        } else {
          navigate('/account')
        }
      }
    } catch (error) {
      console.error('Error fetching account:', error)
    }
    setLoading(false)
  }

  const getSymbolForTradingView = (symbol) => {
    if (!symbol) return 'OANDA:XAUUSD'
    
    // Crypto mappings - use BINANCE with USDT pairs for best coverage
    const cryptoMap = {
      'BTCUSD': 'BINANCE:BTCUSDT', 'ETHUSD': 'BINANCE:ETHUSDT', 'BNBUSD': 'BINANCE:BNBUSDT',
      'SOLUSD': 'BINANCE:SOLUSDT', 'XRPUSD': 'BINANCE:XRPUSDT', 'ADAUSD': 'BINANCE:ADAUSDT',
      'DOGEUSD': 'BINANCE:DOGEUSDT', 'TRXUSD': 'BINANCE:TRXUSDT', 'LINKUSD': 'BINANCE:LINKUSDT',
      'MATICUSD': 'BINANCE:MATICUSDT', 'DOTUSD': 'BINANCE:DOTUSDT', 'SHIBUSD': 'BINANCE:SHIBUSDT',
      'LTCUSD': 'BINANCE:LTCUSDT', 'BCHUSD': 'BINANCE:BCHUSDT', 'AVAXUSD': 'BINANCE:AVAXUSDT',
      'XLMUSD': 'BINANCE:XLMUSDT', 'UNIUSD': 'BINANCE:UNIUSDT', 'ATOMUSD': 'BINANCE:ATOMUSDT',
      'ETCUSD': 'BINANCE:ETCUSDT', 'FILUSD': 'BINANCE:FILUSDT', 'ICPUSD': 'BINANCE:ICPUSDT',
      'VETUSD': 'BINANCE:VETUSDT', 'NEARUSD': 'BINANCE:NEARUSDT', 'GRTUSD': 'BINANCE:GRTUSDT',
      'AAVEUSD': 'BINANCE:AAVEUSDT', 'MKRUSD': 'BINANCE:MKRUSDT', 'ALGOUSD': 'BINANCE:ALGOUSDT',
      'FTMUSD': 'BINANCE:FTMUSDT', 'SANDUSD': 'BINANCE:SANDUSDT', 'MANAUSD': 'BINANCE:MANAUSDT',
      'AXSUSD': 'BINANCE:AXSUSDT', 'THETAUSD': 'BINANCE:THETAUSDT', 'XMRUSD': 'BINANCE:XMRUSDT',
      'FLOWUSD': 'BINANCE:FLOWUSDT', 'SNXUSD': 'BINANCE:SNXUSDT', 'EOSUSD': 'BINANCE:EOSUSDT',
      'CHZUSD': 'BINANCE:CHZUSDT', 'ENJUSD': 'BINANCE:ENJUSDT', 'ZILUSD': 'BINANCE:ZILUSDT',
      'BATUSD': 'BINANCE:BATUSDT', 'CRVUSD': 'BINANCE:CRVUSDT', 'COMPUSD': 'BINANCE:COMPUSDT',
      'SUSHIUSD': 'BINANCE:SUSHIUSDT', 'ZRXUSD': 'BINANCE:ZRXUSDT', 'LRCUSD': 'BINANCE:LRCUSDT',
      'ANKRUSD': 'BINANCE:ANKRUSDT', 'GALAUSD': 'BINANCE:GALAUSDT', 'APEUSD': 'BINANCE:APEUSDT',
      'WAVESUSD': 'BINANCE:WAVESUSDT', 'ZECUSD': 'BINANCE:ZECUSDT',
    }
    
    if (cryptoMap[symbol]) return cryptoMap[symbol]
    
    // Forex pairs (6 char with USD, EUR, GBP, JPY, CHF, AUD, NZD, CAD)
    const forexCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'ZAR', 'MXN', 'TRY', 'CNH']
    if (symbol.length === 6) {
      const base = symbol.substring(0, 3)
      const quote = symbol.substring(3, 6)
      if (forexCurrencies.includes(base) && forexCurrencies.includes(quote)) {
        return `OANDA:${symbol}`
      }
    }
    
    // Metals
    if (symbol.startsWith('XAU') || symbol.startsWith('XAG') || symbol.startsWith('XPT') || symbol.startsWith('XPD')) {
      return `OANDA:${symbol}`
    }
    
    // Indices
    if (symbol.includes('US30') || symbol.includes('SPX') || symbol.includes('US500')) return 'FOREXCOM:SPXUSD'
    if (symbol.includes('NAS') || symbol.includes('NDX') || symbol.includes('US100')) return 'FOREXCOM:NSXUSD'
    if (symbol.includes('DJI') || symbol.includes('DJ30')) return 'FOREXCOM:DJI'
    if (symbol.includes('DAX') || symbol.includes('GER')) return 'PEPPERSTONE:GER40'
    if (symbol.includes('UK100') || symbol.includes('FTSE')) return 'PEPPERSTONE:UK100'
    
    // Oil
    if (symbol.includes('OIL') || symbol.includes('WTI') || symbol.includes('CRUDE')) return 'TVC:USOIL'
    if (symbol.includes('BRENT')) return 'TVC:UKOIL'
    
    // US Stocks - try NASDAQ first
    const usStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 'NFLX', 'ABBV', 'ABT', 'ADBE']
    if (usStocks.includes(symbol) || (symbol.length <= 5 && /^[A-Z]+$/.test(symbol))) {
      return `NASDAQ:${symbol}`
    }
    
    // Default: try FX for currency-like, otherwise skip chart
    if (symbol.endsWith('USD') && symbol.length > 6) {
      // Crypto-like symbol
      return `COINBASE:${symbol}`
    }
    
    return `OANDA:${symbol}`
  }

  // Filter instruments: show all when "All" tab or searching, popular for specific categories
  const filteredInstruments = instruments.filter(inst => {
    const matchesSearch = inst.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    // When searching, show all matching instruments across all categories
    if (searchTerm.length > 0) {
      return matchesSearch
    }
    
    // When viewing Starred, show all starred instruments
    if (activeCategory === 'Starred') {
      return inst.starred
    }
    
    // When viewing "All", show ALL instruments
    if (activeCategory === 'All') {
      return true
    }
    
    // For specific categories (Forex, Metals, etc.), show only popular by default
    return inst.category === activeCategory && inst.popular
  })

  const handleInstrumentClick = (inst) => {
    const existingTab = openTabs.find(tab => tab.symbol === inst.symbol)
    if (!existingTab) {
      setOpenTabs([...openTabs, inst])
    }
    setActiveTab(inst.symbol)
    setSelectedInstrument(inst)
    
    // When clicking from search, mark instrument as "added" so it shows in its category
    if (searchTerm.length > 0 && !inst.popular) {
      setInstruments(prevInsts => prevInsts.map(i => 
        i.symbol === inst.symbol ? { ...i, popular: true } : i
      ))
    }
    
    // Clear search after selection
    setSearchTerm('')
  }

  const handleTabClick = (symbol) => {
    setActiveTab(symbol)
    const inst = openTabs.find(tab => tab.symbol === symbol)
    if (inst) {
      setSelectedInstrument(inst)
    }
  }

  const handleCloseTab = (e, symbol) => {
    e.stopPropagation()
    if (openTabs.length === 1) return
    const newTabs = openTabs.filter(tab => tab.symbol !== symbol)
    setOpenTabs(newTabs)
    if (activeTab === symbol) {
      setActiveTab(newTabs[0].symbol)
      setSelectedInstrument(newTabs[0])
    }
  }

  const calculateMargin = () => {
    const vol = parseFloat(volume) || 0
    const price = selectedInstrument.ask || 0
    const lev = parseInt(leverage?.split(':')[1]) || 100
    return ((vol * 100000 * price) / lev).toFixed(2)
  }

  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}>
        <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>Loading...</div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex overflow-hidden text-sm transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}>
      {/* Left Sidebar */}
      <div className={`w-12 border-r flex flex-col items-center py-3 shrink-0 ${isDarkMode ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-200'}`}>
        <button 
          onClick={() => navigate('/account')}
          className={`w-9 h-9 flex items-center justify-center rounded-lg mb-2 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          title="Home"
        >
          <Home size={20} />
        </button>
        <button 
          onClick={() => setShowInstruments(!showInstruments)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg mb-2 transition-colors ${
            showInstruments ? (isDarkMode ? 'text-white bg-[#1a1a1a]' : 'text-gray-900 bg-gray-100') : (isDarkMode ? 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')
          }`}
          title="Instruments"
        >
          <LayoutGrid size={20} />
        </button>
        <button 
          onClick={() => navigate('/account')}
          className={`w-9 h-9 flex items-center justify-center rounded-lg mb-2 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          title="Wallet"
        >
          <Wallet size={20} />
        </button>
        <button 
          onClick={toggleDarkMode}
          className={`w-9 h-9 flex items-center justify-center rounded-lg mb-2 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} />}
        </button>
        <div className="flex-1" />
        <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:bg-red-600" onClick={() => setShowInstruments(false)}>
          <X size={14} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global Notification Banner - Top of Page */}
        {globalNotification && (
          <div className="fixed top-0 left-0 right-0 z-[100] animate-slide-down">
            <div className={`px-4 py-3 text-center font-medium text-sm shadow-lg ${
              globalNotification.includes('🛑') 
                ? 'bg-red-600 text-white' 
                : 'bg-green-600 text-white'
            }`}>
              {globalNotification}
            </div>
          </div>
        )}

        {/* Challenge Account Banner */}
        {accountType === 'challenge' && challengeAccount && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30 px-3 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Trophy size={18} className="text-yellow-500" />
              <span className="text-yellow-500 font-medium text-sm">
                {challengeAccount.challenge?.name || 'Challenge'} - Phase {challengeAccount.account?.currentPhase}/{challengeAccount.account?.totalPhases}
              </span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>|</span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Daily DD: <span className={challengeAccount.drawdown?.dailyUsed > 3 ? 'text-red-500' : 'text-green-500'}>{challengeAccount.drawdown?.dailyUsed?.toFixed(2) || 0}%</span> / {challengeAccount.drawdown?.dailyMax || 5}%
              </span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>|</span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Overall DD: <span className={challengeAccount.drawdown?.overallUsed > 6 ? 'text-red-500' : 'text-green-500'}>{challengeAccount.drawdown?.overallUsed?.toFixed(2) || 0}%</span> / {challengeAccount.drawdown?.overallMax || 10}%
              </span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>|</span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Profit: <span className="text-green-500">{challengeAccount.profit?.currentPercent?.toFixed(2) || 0}%</span> / {challengeAccount.profit?.targetPercent || 8}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{challengeAccount.time?.remainingDays || 0} days left</span>
              {challengeRules?.stopLossMandatory && (
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle size={12} /> SL Required
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Top Header */}
        <header className="h-14 sm:h-12 border-b flex items-center shrink-0 relative bg-black border-gray-800">
          {/* BlueStone Logo - Centered above Instruments panel (280px width, no padding) */}
          <div className="w-[280px] flex justify-center items-center shrink-0 border-r border-gray-800">
            <img src={bluestoneLogo} alt="BlueStone" className="h-7 sm:h-8" />
          </div>
          {/* Account info - starts right after Instruments panel border */}
          {!isMobile && (
            <div className="flex items-center pl-3 h-full">
              <span className="flex items-center gap-1 mr-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
              <span className="w-px h-6 mx-2 bg-gray-600"></span>
              <span className={`text-xs ${accountType === 'challenge' ? 'text-yellow-500' : 'text-teal-400'}`}>
                {accountType === 'challenge' ? 'Challenge' : (account?.accountTypeId?.name || 'Standard Acc')} - {account?.accountId}
              </span>
              <span className="w-px h-6 mx-3 bg-gray-600"></span>
              <span className="text-gray-400 text-xs">Credit: <span className="text-purple-400">${accountSummary.credit?.toFixed(2) || '0.00'}</span></span>
              <span className="w-px h-6 mx-3 bg-gray-600"></span>
              <span className="text-gray-400 text-xs">Eq: <span className={accountSummary.floatingPnl >= 0 ? 'text-green-500' : 'text-red-500'}>${accountSummary.equity?.toFixed(2) || '0.00'}</span></span>
              <span className="w-px h-6 mx-3 bg-gray-600"></span>
              <span className="text-gray-400 text-xs">Margin: <span className="text-yellow-500">${accountSummary.usedMargin?.toFixed(2) || '0.00'}</span></span>
              <span className="w-px h-6 mx-3 bg-gray-600"></span>
              <span className="text-gray-400 text-xs">Free: <span className={accountSummary.freeMargin >= 0 ? 'text-blue-400' : 'text-red-500'}>${accountSummary.freeMargin?.toFixed(2) || '0.00'}</span></span>
            </div>
          )}
          <div className="flex-1" />
          {/* Deposit & Withdraw Buttons */}
          {!isMobile && accountType !== 'challenge' && (
            <>
              <span className="w-px h-6 mr-3 bg-gray-600"></span>
              <button 
                onClick={() => { fetchWalletBalance(); setShowDepositModal(true); }}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded mr-2 flex items-center gap-1"
              >
                <Plus size={12} /> Deposit
              </button>
              <button 
                onClick={() => { setShowWithdrawModal(true); }}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1 rounded mr-3 flex items-center gap-1"
              >
                <Minus size={12} /> Withdraw
              </button>
            </>
          )}
          <button 
            onClick={() => setShowOrderPanel(!showOrderPanel)}
            className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-2 sm:px-3 py-1 rounded"
          >
            {isMobile ? 'Order' : 'New Order'}
          </button>
          {/* Kill Switch Button - One click to activate (30min default), long press for options */}
          <button 
            onClick={() => killSwitchActive ? deactivateKillSwitch() : quickActivateKillSwitch()}
            onContextMenu={(e) => { e.preventDefault(); if (!killSwitchActive) setShowKillSwitchModal(true) }}
            className={`ml-2 text-xs px-2 sm:px-3 py-1 rounded flex items-center gap-1 ${
              killSwitchActive 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
            title={killSwitchActive ? `Click to deactivate (${killSwitchTimeLeft} left)` : 'Click: Activate 30min | Right-click: Custom duration'}
          >
            {killSwitchActive ? (
              <>
                <span className="hidden sm:inline">🛑 {killSwitchTimeLeft}</span>
                <span className="sm:hidden">🛑</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">🛑 Kill Switch</span>
                <span className="sm:hidden">🛑</span>
              </>
            )}
          </button>
          <button onClick={() => setShowOrderPanel(!showOrderPanel)} className={`ml-1 sm:ml-2 ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            <Settings size={16} />
          </button>
          <button 
            onClick={toggleDarkMode}
            className={`ml-1 sm:ml-2 p-1.5 rounded transition-colors ${isDarkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-blue-500 hover:text-blue-400'}`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Instruments Panel */}
          {showInstruments && (
            <div className={`${isMobile ? 'absolute inset-0 z-20' : 'w-[280px]'} border-r flex flex-col shrink-0 ${isDarkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
              {/* Header */}
              <div className={`px-3 py-3 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Instruments</span>
                <button onClick={() => setShowInstruments(false)} className={isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
                  <X size={16} />
                </button>
              </div>
              {/* Search */}
              <div className={`px-3 py-2 ${isDarkMode ? 'bg-[#0d0d0d]' : 'bg-white'}`}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search instruments"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full rounded pl-9 pr-3 py-2 text-sm placeholder-gray-500 focus:outline-none border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white focus:border-gray-600' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'}`}
                  />
                </div>
              </div>
              
              {/* Category Tabs */}
              <div className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto ${isDarkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
                <button className="text-gray-600 hover:text-yellow-500 shrink-0">
                  <Star size={14} />
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors shrink-0 ${
                      activeCategory === cat 
                        ? 'bg-blue-600 text-white' 
                        : isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Instruments List */}
              <div className={`flex-1 overflow-y-auto px-2 ${!isDarkMode ? 'light-scrollbar' : ''}`}>
                {loadingInstruments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500 text-sm">Loading instruments...</div>
                  </div>
                ) : filteredInstruments.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500 text-sm">No instruments found</div>
                  </div>
                ) : (
                  filteredInstruments.map(inst => (
                    <button
                      key={inst.symbol}
                      onClick={() => handleInstrumentClick(inst)}
                      className={`w-full px-3 py-2.5 my-1 flex items-center rounded-lg border transition-colors ${
                        selectedInstrument.symbol === inst.symbol 
                          ? (isDarkMode ? 'bg-[#1a1a1a] border-blue-500' : 'bg-blue-50 border-blue-500')
                          : (isDarkMode ? 'border-gray-700 hover:border-gray-600 hover:bg-[#1a1a1a]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
                      }`}
                    >
                      <Star 
                        size={12} 
                        className={`shrink-0 mr-2 cursor-pointer hover:text-yellow-400 ${inst.starred ? 'text-yellow-500 fill-yellow-500' : 'text-gray-700'}`}
                        onClick={(e) => { e.stopPropagation(); toggleStar(inst.symbol); }}
                      />
                      <div className="text-left min-w-[55px]">
                        <div className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{inst.symbol}</div>
                        {(() => {
                          const ch = Number(inst.change) || 0
                          const sign = ch > 0 ? '+' : ''
                          const color = ch > 0 ? 'text-green-500' : ch < 0 ? 'text-red-500' : 'text-gray-500'
                          return <div className={`${color} text-[10px]`}>{sign}{ch.toFixed(2)}%</div>
                        })()}
                      </div>
                      <div className="flex-1" />
                      <div className="text-right w-16">
                        <div className="text-red-500 text-xs font-mono">
                          {inst.bid > 0 ? inst.bid.toFixed(inst.bid > 100 ? 2 : 5) : '...'}
                        </div>
                        <div className={`text-[9px] ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>Bid</div>
                      </div>
                      <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium min-w-[28px] text-center mx-2 ${isDarkMode ? 'bg-[#2a2a2a] text-cyan-400' : 'bg-blue-100 text-blue-600'}`}>
                        {/* Show admin-set spread if available, otherwise show 0 */}
                        {adminSpreads[inst.symbol]?.spread > 0 ? (
                          // Convert admin spread to pips for display
                          inst.symbol.includes('JPY') ? (adminSpreads[inst.symbol].spread * 100).toFixed(1) :
                          inst.bid > 100 ? adminSpreads[inst.symbol].spread.toFixed(2) :
                          (adminSpreads[inst.symbol].spread * 10000).toFixed(1)
                        ) : '0'}
                      </div>
                      <div className="text-right w-14">
                        <div className="text-green-500 text-xs font-mono">
                          {inst.ask > 0 ? inst.ask.toFixed(inst.ask > 100 ? 2 : 5) : '...'}
                        </div>
                        <div className={`text-[9px] ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>Ask</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              
              {/* Footer */}
              <div className={`px-3 py-2 border-t flex items-center justify-between shrink-0 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <span className="text-gray-500 text-xs">{filteredInstruments.length} instruments</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-500 text-xs">Live</span>
                </div>
              </div>
            </div>
          )}

        {/* Center - Chart Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${isDarkMode ? 'bg-[#0d0d0d]' : 'bg-gray-50'}`}>
          {/* Symbol Tab Bar */}
          <div className={`h-9 border-b flex items-center px-2 shrink-0 gap-1 ${isDarkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
            {openTabs.map(tab => (
              <div
                key={tab.symbol}
                onClick={() => handleTabClick(tab.symbol)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                  activeTab === tab.symbol 
                    ? 'bg-blue-600 text-white' 
                    : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                <span className="text-sm font-medium">{tab.symbol}</span>
                {openTabs.length > 1 && (
                  <button 
                    onClick={(e) => handleCloseTab(e, tab.symbol)}
                    className="hover:text-red-400 ml-1"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button className={`ml-1 p-1.5 rounded ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
              <Plus size={16} />
            </button>
            
            {/* 4 Charts Toggle Button */}
            {!isMobile && (
              <button 
                onClick={() => setShowFourCharts(!showFourCharts)}
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  showFourCharts 
                    ? 'bg-blue-600 text-white' 
                    : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Grid2X2 size={16} />
                <span className="text-sm font-medium">{showFourCharts ? 'Single' : '4 Charts'}</span>
              </button>
            )}
          </div>

          {/* Chart Area - Single or 4 Charts */}
          <div className={`flex-1 min-h-0 relative ${isDarkMode ? 'bg-[#0d0d0d]' : 'bg-white'}`}>
            {showFourCharts && !isMobile ? (
              /* 4 Charts Grid View */
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                {fourChartTimeframes.map((interval, index) => (
                  <div key={`chart-${index}-${interval}`} className="relative w-full h-full">
                    <TVChartContainer
                      symbol={selectedInstrument.symbol}
                      interval={interval}
                      theme={isDarkMode ? 'dark' : 'light'}
                      containerId={`tv_chart_${index}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Single Chart View - Advanced TradingView Chart */
              <TVChartContainer
                key={`${selectedInstrument.symbol}-${isDarkMode}`}
                symbol={selectedInstrument.symbol}
                interval="5"
                theme={isDarkMode ? 'dark' : 'light'}
                containerId="tv_chart_main"
              />
            )}
          </div>

          {/* Positions Panel */}
          <div className={`${isMobile ? 'h-32' : 'h-44'} border-t flex flex-col shrink-0 ${isDarkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className={`h-10 flex items-center justify-between px-2 sm:px-4 border-b overflow-x-auto ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex gap-2 sm:gap-6">
                {[
                  { name: 'Positions', count: openTrades.length },
                  { name: 'Pending', count: pendingOrders.length },
                  { name: 'History', count: tradeHistory.length },
                  { name: 'Cancelled', count: 0 }
                ].map(tab => (
                  <button
                    key={tab.name}
                    onClick={() => setActivePositionTab(tab.name)}
                    className={`text-xs sm:text-sm whitespace-nowrap ${activePositionTab === tab.name ? (isDarkMode ? 'text-white' : 'text-gray-900') : (isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-500 hover:text-gray-900')}`}
                  >
                    {isMobile ? `${tab.name.split(' ')[0]}(${tab.count})` : `${tab.name}(${tab.count})`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {!isMobile && (
                  <>
                    <span className="text-sm text-gray-500">One Click</span>
                    <button
                      onClick={() => setOneClickTrading(!oneClickTrading)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${oneClickTrading ? 'bg-blue-600' : 'bg-gray-600'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${oneClickTrading ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    {oneClickTrading && (
                      <>
                        <button 
                          onClick={() => executeMarketOrder('SELL')}
                          disabled={isExecutingTrade}
                          className="w-8 h-8 rounded-full bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          S
                        </button>
                        <input
                          type="text"
                          value={volume}
                          onChange={(e) => setVolume(e.target.value)}
                          className={`w-14 h-7 border rounded text-center text-sm font-medium focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                        />
                        <button 
                          onClick={() => executeMarketOrder('BUY')}
                          disabled={isExecutingTrade}
                          className="w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          B
                        </button>
                      </>
                    )}
                  </>
                )}
                <span className="text-xs sm:text-sm text-gray-500">P/L: <span className={accountSummary.floatingPnl >= 0 ? 'text-green-500' : 'text-red-500'}>{accountSummary.floatingPnl >= 0 ? '+' : ''}${accountSummary.floatingPnl?.toFixed(2) || '0.00'}</span></span>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              {activePositionTab === 'Positions' && (
              <table className="w-full text-sm">
                <thead className={`text-gray-500 border-b sticky top-0 ${isDarkMode ? 'border-gray-800 bg-[#0d0d0d]' : 'border-gray-200 bg-white'}`}>
                  <tr>
                    <th className="text-left py-2 px-3 font-normal">Time</th>
                    <th className="text-left py-2 px-3 font-normal">Symbol</th>
                    <th className="text-left py-2 px-3 font-normal">Side</th>
                    <th className="text-left py-2 px-3 font-normal">Lots</th>
                    <th className="text-left py-2 px-3 font-normal">Entry</th>
                    <th className="text-left py-2 px-3 font-normal">Current</th>
                    <th className="text-left py-2 px-3 font-normal">SL</th>
                    <th className="text-left py-2 px-3 font-normal">TP</th>
                    <th className="text-left py-2 px-3 font-normal">Charges</th>
                    <th className="text-left py-2 px-3 font-normal">Swap</th>
                    <th className="text-left py-2 px-3 font-normal">P/L</th>
                    <th className="text-left py-2 px-3 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="text-center py-8 text-gray-500">No open positions</td>
                    </tr>
                  ) : (
                    openTrades.map(trade => {
                      // Use livePrices first, fallback to instruments
                      const livePrice = livePrices[trade.symbol]
                      const inst = instruments.find(i => i.symbol === trade.symbol) || selectedInstrument
                      const currentPrice = livePrice 
                        ? (trade.side === 'BUY' ? livePrice.bid : livePrice.ask)
                        : (trade.side === 'BUY' ? inst.bid : inst.ask)
                      const rawPnl = trade.side === 'BUY' 
                        ? (currentPrice - trade.openPrice) * trade.quantity * trade.contractSize
                        : (trade.openPrice - currentPrice) * trade.quantity * trade.contractSize
                      const pnl = rawPnl - (trade.commission || 0) - (trade.swap || 0)
                      
                      // Format price based on symbol type
                      const formatPrice = (price) => {
                        if (!price) return '-'
                        if (trade.symbol.includes('JPY')) return price.toFixed(3)
                        if (['BTCUSD', 'ETHUSD', 'XAUUSD'].includes(trade.symbol)) return price.toFixed(2)
                        if (['XAGUSD'].includes(trade.symbol)) return price.toFixed(4)
                        return price.toFixed(5)
                      }
                      
                      return (
                        <tr key={trade._id} className={`border-t ${isDarkMode ? 'border-gray-800 hover:bg-[#1a1a1a]' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(trade.openedAt).toLocaleTimeString()}</td>
                          <td className={`py-2 px-3 text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{trade.symbol}</td>
                          <td className={`py-2 px-3 text-xs font-medium ${trade.side === 'BUY' ? 'text-blue-400' : 'text-red-400'}`}>{trade.side}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{trade.quantity}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{formatPrice(trade.openPrice)}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{formatPrice(currentPrice)}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{trade.stopLoss ? formatPrice(trade.stopLoss) : '-'}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{trade.takeProfit ? formatPrice(trade.takeProfit) : '-'}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>${trade.commission?.toFixed(2) || '0.00'}</td>
                          <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>${trade.swap?.toFixed(2) || '0.00'}</td>
                          <td className={`py-2 px-3 text-xs font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${pnl.toFixed(2)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => openModifyModal(trade)}
                                className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                title="Modify SL/TP"
                              >
                                <Pencil size={12} />
                              </button>
                              <button 
                                onClick={() => openCloseModal(trade)}
                                className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                title="Close Trade"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              )}

              {activePositionTab === 'History' && (
              <div className="flex flex-col h-full">
                {/* History Filters Row */}
                <div className={`flex flex-wrap items-center gap-2 px-3 py-2 border-b ${isDarkMode ? 'border-gray-800 bg-[#0d0d0d]' : 'border-gray-200 bg-gray-50'}`}>
                  {/* Refresh Button */}
                  <button
                    onClick={fetchTradeHistory}
                    className={`flex items-center gap-1 text-xs ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                  
                  {/* Filter Buttons */}
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'today', label: 'Today' },
                    { key: 'week', label: 'This Week' },
                    { key: 'month', label: 'This Month' },
                    { key: 'year', label: 'This Year' }
                  ].map(filter => (
                    <button
                      key={filter.key}
                      onClick={() => { setHistoryFilter(filter.key); setHistoryStartDate(''); setHistoryEndDate(''); setHistoryPage(1) }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        historyFilter === filter.key && !historyStartDate
                          ? 'bg-green-500 text-black' 
                          : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                  
                  {/* Date Range Picker */}
                  <div className="flex items-center gap-1 ml-2">
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1) }}
                      className={`px-2 py-1 rounded text-xs border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                    <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>to</span>
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1) }}
                      className={`px-2 py-1 rounded text-xs border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  
                  {/* Trade Count & P&L Summary */}
                  <span className={`ml-auto text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {getFilteredHistory().length} trades | P&L: <span className={getHistoryTotalPnl() >= 0 ? 'text-green-500' : 'text-red-500'}>${getHistoryTotalPnl().toFixed(2)}</span>
                  </span>
                  
                  {/* Download CSV Button */}
                  <button
                    onClick={downloadHistoryCSV}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${isDarkMode ? 'bg-[#1a1a1a] text-gray-300 hover:bg-[#252525]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    <Download size={12} /> Download CSV
                  </button>
                </div>
                
                {/* History Table */}
                <table className="w-full text-sm">
                  <thead className={`text-gray-500 border-b sticky top-0 ${isDarkMode ? 'border-gray-800 bg-[#0d0d0d]' : 'border-gray-200 bg-white'}`}>
                    <tr>
                      <th className="text-left py-2 px-3 font-normal">Closed</th>
                      <th className="text-left py-2 px-3 font-normal">Symbol</th>
                      <th className="text-left py-2 px-3 font-normal">Side</th>
                      <th className="text-left py-2 px-3 font-normal">Lots</th>
                      <th className="text-left py-2 px-3 font-normal">Entry</th>
                      <th className="text-left py-2 px-3 font-normal">Close</th>
                      <th className="text-left py-2 px-3 font-normal">Charges</th>
                      <th className="text-left py-2 px-3 font-normal">Swap</th>
                      <th className="text-left py-2 px-3 font-normal">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredHistory().length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-gray-500">No trade history</td>
                      </tr>
                    ) : (
                      getFilteredHistory().slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage).map(trade => {
                        const formatPrice = (price) => {
                          if (!price) return '-'
                          if (trade.symbol.includes('JPY')) return price.toFixed(3)
                          if (['BTCUSD', 'ETHUSD', 'XAUUSD'].includes(trade.symbol)) return price.toFixed(2)
                          if (['XAGUSD'].includes(trade.symbol)) return price.toFixed(4)
                          return price.toFixed(5)
                        }
                        
                        return (
                          <tr key={trade._id} className={`border-t ${isDarkMode ? 'border-gray-800 hover:bg-[#1a1a1a]' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(trade.closedAt).toLocaleString()}</td>
                            <td className={`py-2 px-3 text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{trade.symbol}</td>
                            <td className={`py-2 px-3 text-xs font-medium ${trade.side === 'BUY' ? 'text-blue-400' : 'text-red-400'}`}>{trade.side}</td>
                            <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{trade.quantity}</td>
                            <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{formatPrice(trade.openPrice)}</td>
                            <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{formatPrice(trade.closePrice)}</td>
                            <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>${trade.commission?.toFixed(2) || '0.00'}</td>
                            <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>${trade.swap?.toFixed(2) || '0.00'}</td>
                            <td className={`py-2 px-3 text-xs font-medium ${trade.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${trade.realizedPnl?.toFixed(2) || '0.00'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {getFilteredHistory().length > historyPerPage && (
                  <div className={`flex items-center justify-between px-3 py-2 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Page {historyPage} of {Math.ceil(getFilteredHistory().length / historyPerPage)} &nbsp;·&nbsp; {getFilteredHistory().length} trades
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className={`px-2 py-1 rounded text-xs disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-[#1a1a1a] text-gray-300 hover:bg-[#252525]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                      >
                        ‹ Prev
                      </button>
                      <button
                        onClick={() => setHistoryPage(p => Math.min(Math.ceil(getFilteredHistory().length / historyPerPage), p + 1))}
                        disabled={historyPage === Math.ceil(getFilteredHistory().length / historyPerPage)}
                        className={`px-2 py-1 rounded text-xs disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-[#1a1a1a] text-gray-300 hover:bg-[#252525]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                      >
                        Next ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {activePositionTab === 'Pending' && (
              <table className="w-full text-sm">
                <thead className={`text-gray-500 border-b sticky top-0 ${isDarkMode ? 'border-gray-800 bg-[#0d0d0d]' : 'border-gray-200 bg-white'}`}>
                  <tr>
                    <th className="text-left py-2 px-3 font-normal">Time</th>
                    <th className="text-left py-2 px-3 font-normal">Symbol</th>
                    <th className="text-left py-2 px-3 font-normal">Type</th>
                    <th className="text-left py-2 px-3 font-normal">Lots</th>
                    <th className="text-left py-2 px-3 font-normal">Price</th>
                    <th className="text-left py-2 px-3 font-normal">SL</th>
                    <th className="text-left py-2 px-3 font-normal">TP</th>
                    <th className="text-left py-2 px-3 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">No pending orders</td>
                    </tr>
                  ) : (
                    pendingOrders.map(order => (
                      <tr key={order._id} className={`border-t ${isDarkMode ? 'border-gray-800 hover:bg-[#1a1a1a]' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(order.createdAt).toLocaleTimeString()}</td>
                        <td className={`py-2 px-3 text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order.symbol}</td>
                        <td className={`py-2 px-3 text-xs font-medium ${order.orderType.includes('BUY') ? 'text-blue-400' : 'text-red-400'}`}>{order.orderType}</td>
                        <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{order.quantity}</td>
                        <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{order.pendingPrice?.toFixed(5)}</td>
                        <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{order.stopLoss || '-'}</td>
                        <td className={`py-2 px-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{order.takeProfit || '-'}</td>
                        <td className="py-2 px-3">
                          <button 
                            onClick={() => cancelPendingOrder(order._id)}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                            title="Cancel Order"
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              )}

              {activePositionTab === 'Cancelled' && (
                <div className="text-center py-8 text-gray-500">No cancelled orders</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Order */}
        {showOrderPanel && (
          <div className={`${isMobile ? 'absolute inset-0 z-20' : 'w-72'} border-l flex flex-col shrink-0 ${isDarkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className={`px-4 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <span className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInstrument.symbol} order</span>
              <button onClick={() => setShowOrderPanel(false)} className={isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
                <X size={18} />
              </button>
            </div>

            <div className={`flex border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setOrderTab('Market')}
                className={`flex-1 py-3 text-sm font-medium ${orderTab === 'Market' ? (isDarkMode ? 'text-white' : 'text-gray-900') + ' border-b-2 border-blue-500' : 'text-gray-500'}`}
              >
                Market
              </button>
              <button
                onClick={() => setOrderTab('Pending')}
                className={`flex-1 py-3 text-sm font-medium ${orderTab === 'Pending' ? (isDarkMode ? 'text-white' : 'text-gray-900') + ' border-b-2 border-blue-500' : 'text-gray-500'}`}
              >
                Pending
              </button>
            </div>

            {orderTab === 'Market' ? (
              <>
                <div className={`p-3 flex-1 overflow-y-auto ${!isDarkMode ? 'light-scrollbar' : ''}`}>
                  {/* One-Click Buy/Sell Buttons */}
                  <div className="flex gap-2 mb-3">
                    <button 
                      onClick={() => executeMarketOrder('SELL')}
                      disabled={isExecutingTrade}
                      className="flex-1 rounded py-3 text-center transition-colors bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-white text-[10px] font-medium">SELL</div>
                      <div className="text-white font-mono text-lg font-bold">
                        {selectedInstrument.symbol?.includes('JPY') 
                          ? selectedInstrument.bid?.toFixed(3)
                          : ['BTCUSD', 'ETHUSD', 'XAUUSD'].includes(selectedInstrument.symbol)
                            ? selectedInstrument.bid?.toFixed(2)
                            : selectedInstrument.bid?.toFixed(5)}
                      </div>
                    </button>
                    <button 
                      onClick={() => executeMarketOrder('BUY')}
                      disabled={isExecutingTrade}
                      className="flex-1 rounded py-3 text-center transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-white text-[10px] font-medium">BUY</div>
                      <div className="text-white font-mono text-lg font-bold">
                        {selectedInstrument.symbol?.includes('JPY') 
                          ? selectedInstrument.ask?.toFixed(3)
                          : ['BTCUSD', 'ETHUSD', 'XAUUSD'].includes(selectedInstrument.symbol)
                            ? selectedInstrument.ask?.toFixed(2)
                            : selectedInstrument.ask?.toFixed(5)}
                      </div>
                    </button>
                  </div>

                  {/* Side Selection for detailed order */}
                  <div className="flex gap-2 mb-3">
                    <button 
                      onClick={() => setSelectedSide('SELL')}
                      className={`flex-1 rounded py-1.5 text-center text-xs transition-colors ${
                        selectedSide === 'SELL' 
                          ? 'bg-red-500/20 border border-red-500 text-red-400' 
                          : isDarkMode ? 'bg-[#1a1a1a] border border-gray-600 text-gray-400 hover:border-red-500/50' : 'bg-gray-50 border border-gray-300 text-gray-600 hover:border-red-500/50'
                      }`}
                    >
                      Sell Side
                    </button>
                    <button 
                      onClick={() => setSelectedSide('BUY')}
                      className={`flex-1 rounded py-1.5 text-center text-xs transition-colors ${
                        selectedSide === 'BUY' 
                          ? 'bg-blue-500/20 border border-blue-500 text-blue-400' 
                          : isDarkMode ? 'bg-[#1a1a1a] border border-gray-600 text-gray-400 hover:border-blue-500/50' : 'bg-gray-50 border border-gray-300 text-gray-600 hover:border-blue-500/50'
                      }`}
                    >
                      Buy Side
                    </button>
                  </div>

                  {/* Volume */}
                  <div className="mb-3">
                    <label className={`text-xs mb-1 block ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Volume</label>
                    <div className={`flex items-center rounded border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                      <button onClick={() => setVolume((Math.max(0.01, parseFloat(volume) - 0.01)).toFixed(2))} className={`px-3 py-2 border-r ${isDarkMode ? 'text-gray-400 hover:text-white border-gray-700' : 'text-gray-600 hover:text-gray-900 border-gray-300'}`}>
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        className={`flex-1 bg-transparent text-center text-sm font-medium focus:outline-none py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      />
                      <button onClick={() => setVolume((parseFloat(volume) + 0.01).toFixed(2))} className={`px-3 py-2 border-l ${isDarkMode ? 'text-gray-400 hover:text-white border-gray-700' : 'text-gray-600 hover:text-gray-900 border-gray-300'}`}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="text-right text-gray-500 text-[10px] mt-1">{volume} lot</div>
                  </div>

                  {/* Leverage */}
                  <div className="mb-3">
                    <div className={`text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Leverage (Max: {account?.leverage || '1:100'})</div>
                    <div className="flex gap-2">
                      <select 
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                        className={`flex-1 rounded px-3 py-2 text-sm focus:outline-none border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                      >
                        {(() => {
                          const maxLev = parseInt((account?.leverage || '1:100').replace('1:', '')) || 100
                          const options = [50, 100, 200, 500, 1000, 2000, 5000].filter(l => l <= maxLev)
                          if (!options.includes(maxLev)) options.push(maxLev)
                          return options.sort((a, b) => a - b).map(l => (
                            <option key={l} value={`1:${l}`}>1:{l}</option>
                          ))
                        })()}
                      </select>
                      <div className={`rounded px-3 py-2 text-green-500 text-sm font-medium border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                        ${(() => {
                          const leverageNum = parseInt(leverage.replace('1:', '')) || 100
                          const contractSize = ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD'].includes(selectedInstrument.symbol) ? 1 
                            : selectedInstrument.symbol === 'XAUUSD' ? 100 
                            : selectedInstrument.symbol === 'XAGUSD' ? 5000 
                            : 100000
                          const margin = (parseFloat(volume || 0) * contractSize * (selectedInstrument.ask || 0)) / leverageNum
                          return margin.toFixed(2)
                        })()}
                      </div>
                    </div>
                    <div className="text-gray-500 text-[10px] mt-1">
                      Margin Required | Free: ${accountSummary.freeMargin?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-blue-400 text-[10px] mt-0.5">
                      Buying Power: ${(() => {
                        const leverageNum = parseInt(leverage.replace('1:', '')) || 100
                        return ((accountSummary.equity || 0) * leverageNum).toLocaleString()
                      })()}
                    </div>
                  </div>

                  {/* Take Profit */}
                  <div className="mb-2">
                    <button 
                      onClick={() => setShowTakeProfit(!showTakeProfit)}
                      className="flex items-center justify-between w-full py-2"
                    >
                      <span className="text-green-500 text-sm">Take profit</span>
                      <Plus size={16} className={`text-green-500 transition-transform ${showTakeProfit ? 'rotate-45' : ''}`} />
                    </button>
                    {showTakeProfit && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={takeProfit}
                          onChange={(e) => setTakeProfit(e.target.value)}
                          placeholder="Price"
                          className={`flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 border border-green-500/50 ${isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-gray-50 text-gray-900'}`}
                        />
                        <input
                          type="text"
                          placeholder="Pips"
                          className={`w-16 rounded px-2 py-2 text-sm focus:outline-none border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Stop Loss */}
                  <div className="mb-3">
                    <button 
                      onClick={() => setShowStopLoss(!showStopLoss)}
                      className="flex items-center justify-between w-full py-2"
                    >
                      <span className="text-red-500 text-sm">Stop loss</span>
                      <Plus size={16} className={`text-red-500 transition-transform ${showStopLoss ? 'rotate-45' : ''}`} />
                    </button>
                    {showStopLoss && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={stopLoss}
                          onChange={(e) => setStopLoss(e.target.value)}
                          placeholder="Price"
                          className={`flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500 border border-red-500/50 ${isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-gray-50 text-gray-900'}`}
                        />
                        <input
                          type="text"
                          placeholder="Pips"
                          className={`w-16 rounded px-2 py-2 text-sm focus:outline-none border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Trading Charges */}
                  <div className={`rounded p-3 mb-3 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Trading Charges</div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Spread</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>10 pips</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Commission</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>$0.10 ($10/lot)</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-xs">Margin Required</span>
                    <span className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${calculateMargin()}</span>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {tradeError && (
                  <div className="mx-3 mb-2 p-2 bg-red-500/20 border border-red-500 rounded text-red-400 text-xs text-center">
                    {tradeError}
                  </div>
                )}
                {tradeSuccess && (
                  <div className="mx-3 mb-2 p-2 bg-green-500/20 border border-green-500 rounded text-green-400 text-xs text-center">
                    {tradeSuccess}
                  </div>
                )}

                <div className={`p-3 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                  <button 
                    onClick={() => executeMarketOrder(selectedSide)}
                    disabled={isExecutingTrade}
                    className={`w-full py-3 rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedSide === 'BUY' 
                        ? 'bg-blue-600/20 border border-blue-600 hover:bg-blue-600/30 text-blue-400'
                        : 'bg-red-600/20 border border-red-600 hover:bg-red-600/30 text-red-400'
                    }`}
                  >
                    {isExecutingTrade ? 'Executing...' : `Open ${selectedSide} Order`}
                  </button>
                  <div className="text-center text-gray-500 text-xs mt-2">
                    {volume} lots @ {selectedSide === 'BUY' ? selectedInstrument.ask?.toFixed(2) : selectedInstrument.bid?.toFixed(2)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`p-3 flex-1 overflow-y-auto ${!isDarkMode ? 'light-scrollbar' : ''}`}>
                  {/* Order Type */}
                  <div className="mb-3">
                    <div className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Order type</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['BUY LIMIT', 'SELL LIMIT', 'BUY STOP', 'SELL STOP'].map(type => (
                        <button
                          key={type}
                          onClick={() => setPendingOrderType(type)}
                          className={`py-2 rounded text-xs font-medium transition-colors ${
                            pendingOrderType === type
                              ? type.includes('BUY') 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-red-600 text-white'
                              : type.includes('BUY')
                                ? isDarkMode ? 'bg-[#1a1a1a] border border-blue-500/30 text-blue-400 hover:bg-blue-500/10' : 'bg-gray-50 border border-blue-500/30 text-blue-600 hover:bg-blue-500/10'
                                : isDarkMode ? 'bg-[#1a1a1a] border border-red-500/30 text-red-400 hover:bg-red-500/10' : 'bg-gray-50 border border-red-500/30 text-red-600 hover:bg-red-500/10'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entry Price */}
                  <div className="mb-3">
                    <div className={`text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Entry price</div>
                    <input
                      type="text"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      placeholder="Enter price"
                      className={`w-full rounded px-3 py-2.5 text-sm focus:outline-none border ${
                        pendingOrderWarning 
                          ? 'border-red-500 bg-red-500/10' 
                          : isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white focus:border-gray-600' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'
                      } ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    />
                    {pendingOrderWarning && (
                      <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <span>⚠</span> {pendingOrderWarning}
                      </div>
                    )}
                  </div>

                  {/* Order Volume */}
                  <div className="mb-3">
                    <div className={`text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Order volume</div>
                    <div className={`flex items-center rounded border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                      <input
                        type="text"
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        className={`flex-1 bg-transparent text-center text-sm font-medium focus:outline-none py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      />
                      <button onClick={() => setVolume((Math.max(0.01, parseFloat(volume) - 0.01)).toFixed(2))} className={`px-3 py-2 border-l ${isDarkMode ? 'text-gray-400 hover:text-white border-gray-700' : 'text-gray-600 hover:text-gray-900 border-gray-300'}`}>
                        <Minus size={14} />
                      </button>
                      <button onClick={() => setVolume((parseFloat(volume) + 0.01).toFixed(2))} className={`px-3 py-2 border-l ${isDarkMode ? 'text-gray-400 hover:text-white border-gray-700' : 'text-gray-600 hover:text-gray-900 border-gray-300'}`}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Leverage */}
                  <div className="mb-3">
                    <div className={`text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Leverage (Max: {account?.leverage || '1:100'})</div>
                    <div className="flex gap-2">
                      <select 
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                        className={`flex-1 rounded px-3 py-2 text-sm focus:outline-none border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                      >
                        {(() => {
                          const maxLev = parseInt((account?.leverage || '1:100').replace('1:', '')) || 100
                          const options = [50, 100, 200, 500, 1000, 2000, 5000].filter(l => l <= maxLev)
                          if (!options.includes(maxLev)) options.push(maxLev)
                          return options.sort((a, b) => a - b).map(l => (
                            <option key={l} value={`1:${l}`}>1:{l}</option>
                          ))
                        })()}
                      </select>
                      <div className={`rounded px-3 py-2 text-green-500 text-sm border ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-300'}`}>$0</div>
                    </div>
                    <div className="text-gray-500 text-[10px] mt-1">Trading power: $0.00 × 100 = $0</div>
                  </div>

                  {/* Take Profit */}
                  <div className="mb-2">
                    <button 
                      onClick={() => setShowTakeProfit(!showTakeProfit)}
                      className="flex items-center justify-between w-full py-2"
                    >
                      <span className="text-green-500 text-sm">Take profit</span>
                      <Plus size={16} className={`text-green-500 transition-transform ${showTakeProfit ? 'rotate-45' : ''}`} />
                    </button>
                    {showTakeProfit && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={takeProfit}
                          onChange={(e) => setTakeProfit(e.target.value)}
                          placeholder="Price"
                          className={`flex-1 rounded px-3 py-2 text-sm focus:outline-none border border-green-500/50 focus:border-green-500 ${isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-gray-50 text-gray-900'}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Stop Loss */}
                  <div className="mb-3">
                    <button 
                      onClick={() => setShowStopLoss(!showStopLoss)}
                      className="flex items-center justify-between w-full py-2"
                    >
                      <span className="text-red-500 text-sm">Stop loss</span>
                      <Plus size={16} className={`text-red-500 transition-transform ${showStopLoss ? 'rotate-45' : ''}`} />
                    </button>
                    {showStopLoss && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={stopLoss}
                          onChange={(e) => setStopLoss(e.target.value)}
                          placeholder="Price"
                          className={`flex-1 rounded px-3 py-2 text-sm focus:outline-none border border-red-500/50 focus:border-red-500 ${isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-gray-50 text-gray-900'}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Trading Charges */}
                  <div className={`rounded p-3 mb-3 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Trading Charges</div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Spread</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>10 pips</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Commission</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>$0.10 ($10/lot)</span>
                    </div>
                  </div>
                </div>

                {/* Error/Success Messages for Pending */}
                {tradeError && (
                  <div className="mx-3 mb-2 p-2 bg-red-500/20 border border-red-500 rounded text-red-400 text-xs text-center">
                    {tradeError}
                  </div>
                )}
                {tradeSuccess && (
                  <div className="mx-3 mb-2 p-2 bg-green-500/20 border border-green-500 rounded text-green-400 text-xs text-center">
                    {tradeSuccess}
                  </div>
                )}

                <div className={`p-3 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                  <button 
                    onClick={executePendingOrder}
                    disabled={isExecutingTrade || pendingOrderWarning}
                    className={`w-full py-3 rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      pendingOrderWarning 
                        ? 'bg-gray-600/20 border border-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600/20 border border-blue-600 hover:bg-blue-600/30 text-blue-400'
                    }`}
                  >
                    {isExecutingTrade ? 'Placing...' : pendingOrderWarning ? 'Invalid Price' : `Place ${pendingOrderType}`}
                  </button>
                  <div className="text-center text-gray-500 text-xs mt-2">
                    {volume} lots @ {entryPrice || '--.--'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </div>

              </div>

      {/* iOS-Style Modify SL/TP Modal */}
      {showModifyModal && selectedTradeForModify && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => setShowModifyModal(false)}>
          <div className="w-full sm:w-96 bg-[#1c1c1e] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700/50 text-center">
              <h3 className="text-white font-semibold text-lg">Modify Trade</h3>
              <p className="text-gray-400 text-sm mt-1">
                {selectedTradeForModify.symbol} • {selectedTradeForModify.side} • {selectedTradeForModify.quantity} lots
              </p>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Error/Success messages */}
              {tradeError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {tradeError}
                </div>
              )}
              {tradeSuccess && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-400 text-sm">
                  {tradeSuccess}
                </div>
              )}
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
                type="button"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Save Changes clicked, trade:', selectedTradeForModify?._id)
                  await handleModifyTrade()
                }}
                className="w-full py-4 text-blue-500 font-semibold text-lg hover:bg-[#2c2c2e] transition-colors cursor-pointer active:bg-[#3c3c3e]"
              >
                Save Changes
              </button>
            </div>
            <div className="border-t border-gray-700/50">
              <button
                onClick={() => setShowModifyModal(false)}
                className="w-full py-4 text-gray-400 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS-Style Close Trade Confirmation Modal */}
      {showCloseModal && selectedTradeForClose && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:w-80 bg-[#1c1c1e] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="px-4 py-4 text-center">
              <h3 className="text-white font-semibold text-lg">Close Trade?</h3>
              <p className="text-gray-400 text-sm mt-2">
                {selectedTradeForClose.symbol} • {selectedTradeForClose.side} • {selectedTradeForClose.quantity} lots
              </p>
              <p className="text-gray-500 text-xs mt-1">
                This action cannot be undone
              </p>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-700/50">
              <button
                onClick={handleConfirmClose}
                className="w-full py-4 text-red-500 font-semibold text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Close Trade
              </button>
            </div>
            {/* Close All Options */}
            {openTrades.length > 1 && (
              <>
                <div className="border-t border-gray-700/50">
                  <button
                    onClick={() => { setShowCloseModal(false); handleCloseAllTrades('all'); }}
                    className="w-full py-4 text-orange-500 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
                  >
                    Close All ({openTrades.length})
                  </button>
                </div>
                <div className="border-t border-gray-700/50">
                  <button
                    onClick={() => { setShowCloseModal(false); handleCloseAllTrades('profit'); }}
                    className="w-full py-4 text-green-500 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
                  >
                    Close Profit
                  </button>
                </div>
                <div className="border-t border-gray-700/50">
                  <button
                    onClick={() => { setShowCloseModal(false); handleCloseAllTrades('loss'); }}
                    className="w-full py-4 text-red-400 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
                  >
                    Close Loss
                  </button>
                </div>
              </>
            )}
            <div className="border-t border-gray-700/50">
              <button
                onClick={() => setShowCloseModal(false)}
                className="w-full py-4 text-blue-500 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS-Style Close All Trades Confirmation Modal */}
      {showCloseAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:w-80 bg-[#1c1c1e] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="px-4 py-4 text-center">
              <h3 className="text-white font-semibold text-lg">
                {closeAllType === 'all' && 'Close All Trades?'}
                {closeAllType === 'profit' && 'Close Winning Trades?'}
                {closeAllType === 'loss' && 'Close Losing Trades?'}
              </h3>
              <p className="text-gray-400 text-sm mt-2">
                {closeAllType === 'all' && `This will close all ${openTrades.length} open trade(s)`}
                {closeAllType === 'profit' && 'This will close all trades currently in profit'}
                {closeAllType === 'loss' && 'This will close all trades currently in loss'}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                This action cannot be undone
              </p>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-700/50">
              <button
                onClick={confirmCloseAll}
                className={`w-full py-4 font-semibold text-lg hover:bg-[#2c2c2e] transition-colors ${
                  closeAllType === 'profit' ? 'text-green-500' : closeAllType === 'loss' ? 'text-red-500' : 'text-orange-500'
                }`}
              >
                {closeAllType === 'all' && 'Close All'}
                {closeAllType === 'profit' && 'Close Winners'}
                {closeAllType === 'loss' && 'Close Losers'}
              </button>
            </div>
            <div className="border-t border-gray-700/50">
              <button
                onClick={() => setShowCloseAllModal(false)}
                className="w-full py-4 text-blue-500 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Switch Modal */}
      {showKillSwitchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:w-96 bg-[#1c1c1e] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="px-4 py-4 text-center border-b border-gray-700/50">
              <div className="text-4xl mb-2">🛑</div>
              <h3 className="text-white text-lg font-semibold">Kill Switch</h3>
              <p className="text-gray-400 text-sm mt-1">
                Block all trading for a set period to prevent emotional decisions
              </p>
            </div>
            
            {/* Duration Selection */}
            <div className="p-4 space-y-4">
              {/* Value Input */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Duration</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={killSwitchDuration.value}
                    onChange={(e) => setKillSwitchDuration(prev => ({ ...prev, value: parseInt(e.target.value) || 1 }))}
                    className="flex-1 bg-[#2c2c2e] text-white px-3 py-2 rounded-lg text-center text-lg font-mono"
                  />
                  <select
                    value={killSwitchDuration.unit}
                    onChange={(e) => setKillSwitchDuration(prev => ({ ...prev, unit: e.target.value }))}
                    className="bg-[#2c2c2e] text-white px-3 py-2 rounded-lg"
                  >
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
              
              {/* Quick Select Buttons */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Quick Select</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setKillSwitchDuration({ value: 30, unit: 'seconds' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    30s
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 5, unit: 'minutes' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    5m
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 30, unit: 'minutes' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    30m
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 1, unit: 'hours' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    1h
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 4, unit: 'hours' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    4h
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 12, unit: 'hours' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    12h
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 1, unit: 'days' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    1d
                  </button>
                  <button
                    onClick={() => setKillSwitchDuration({ value: 7, unit: 'days' })}
                    className="bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white py-2 rounded-lg text-xs"
                  >
                    7d
                  </button>
                </div>
              </div>
              
              {/* Warning */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-orange-400 text-xs">
                  ⚠️ Once activated, you won't be able to open new trades until the timer expires. You can still close existing trades.
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="border-t border-gray-700/50">
              <button
                onClick={activateKillSwitch}
                className="w-full py-4 text-red-500 font-semibold text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Activate Kill Switch
              </button>
            </div>
            <div className="border-t border-gray-700/50">
              <button
                onClick={() => setShowKillSwitchModal(false)}
                className="w-full py-4 text-blue-500 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Transfer to Account</h3>
              <button 
                onClick={() => { setShowDepositModal(false); setTransferAmount(''); setTransferError(''); }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={20} />
              </button>
            </div>

            <div className={`p-3 rounded-lg mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                  <TrendingUp size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{account?.accountId}</p>
                  <p className="text-gray-500 text-xs">{account?.accountTypeId?.name || 'Trading Account'}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-gray-600">
                <span className="text-gray-400">Account Balance:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${accountSummary.balance?.toFixed(2) || '0.00'}</span>
              </div>
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Main Wallet Balance:</span>
                <span className="text-green-400 font-medium">${walletBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Transfer Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={transferAmount}
                onChange={(e) => {
                  const val = e.target.value.replace(/,/g, '.')
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setTransferAmount(val)
                  }
                }}
                placeholder="Enter amount (e.g., 100.50)"
                className={`w-full border rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:border-green-500 ${isDarkMode ? 'bg-dark-700 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              />
              <button 
                type="button"
                onClick={() => setTransferAmount(walletBalance.toString())}
                className="text-green-400 text-xs hover:underline mt-2"
              >
                Max: ${walletBalance.toLocaleString()}
              </button>
            </div>

            {transferError && <p className="text-red-500 text-sm mb-4">{transferError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDepositModal(false); setTransferAmount(''); setTransferError(''); }}
                className={`flex-1 py-3 rounded-lg transition-colors ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:opacity-90 transition-colors"
              >
                Transfer Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Withdraw to Main Wallet</h3>
              <button 
                onClick={() => { setShowWithdrawModal(false); setTransferAmount(''); setTransferError(''); }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={20} />
              </button>
            </div>

            <div className={`p-3 rounded-lg mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                  <TrendingUp size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{account?.accountId}</p>
                  <p className="text-gray-500 text-xs">{account?.accountTypeId?.name || 'Trading Account'}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-gray-600">
                <span className="text-gray-400">Available Balance:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${accountSummary.balance?.toFixed(2) || '0.00'}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Withdraw Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={transferAmount}
                onChange={(e) => {
                  const val = e.target.value.replace(/,/g, '.')
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setTransferAmount(val)
                  }
                }}
                placeholder="Enter amount (e.g., 100.50)"
                className={`w-full border rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:border-orange-500 ${isDarkMode ? 'bg-dark-700 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              />
              <button 
                type="button"
                onClick={() => setTransferAmount(accountSummary.balance?.toString() || '0')}
                className="text-orange-400 text-xs hover:underline mt-2"
              >
                Max: ${accountSummary.balance?.toFixed(2) || '0.00'}
              </button>
            </div>

            {transferError && <p className="text-red-500 text-sm mb-4">{transferError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowWithdrawModal(false); setTransferAmount(''); setTransferError(''); }}
                className={`flex-1 py-3 rounded-lg transition-colors ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:opacity-90 transition-colors"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Algo Account locked popup */}
      {algoLockPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1c1c1e] rounded-2xl overflow-hidden border border-purple-500/30">
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/15 flex items-center justify-center">
                <Lock size={26} className="text-purple-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Algo Account Locked</h3>
              <p className="text-gray-400 text-sm">
                {algoLockPopup.message || 'This is an Algo account. You cannot trade from this account.'}
              </p>
              {algoLockPopup.daysRemaining != null && (
                <div className="mt-4 inline-flex items-center gap-2 bg-purple-500/10 text-purple-300 px-4 py-2 rounded-lg">
                  <span className="text-2xl font-bold">{algoLockPopup.daysRemaining}</span>
                  <span className="text-sm">day{algoLockPopup.daysRemaining === 1 ? '' : 's'} until unlock</span>
                </div>
              )}
            </div>
            <div className="border-t border-gray-700/50 mt-4">
              <button
                onClick={() => setAlgoLockPopup(null)}
                className="w-full py-4 text-blue-500 font-medium text-lg hover:bg-[#2c2c2e] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradingPage
