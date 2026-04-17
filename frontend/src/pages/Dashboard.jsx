import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
  LayoutDashboard, 
  User,
  Wallet,
  Users,
  Copy,
  UserCircle,
  HelpCircle,
  FileText,
  LogOut,
  TrendingUp,
  DollarSign,
  Newspaper,
  Calendar,
  RefreshCw,
  Activity,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Globe,
  Settings
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { API_URL } from '../config/api'
import logoImage from '../assets/logo.png'
import BannerSlider from '../components/BannerSlider'
import LanguageDropdown from '../components/LanguageDropdown'
import UserHeader from '../components/UserHeader'
import { useLockDocumentScroll } from '../hooks/useLockDocumentScroll'

const Dashboard = () => {
  useLockDocumentScroll()
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { t } = useTranslation()
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [economicEvents, setEconomicEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const [totalTrades, setTotalTrades] = useState(0)
  const [totalCharges, setTotalCharges] = useState(0)
  const [totalPnl, setTotalPnl] = useState(0)
  const [userAccounts, setUserAccounts] = useState([])
  const [accountTypes, setAccountTypes] = useState([])
  const [challengeModeEnabled, setChallengeModeEnabled] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const tradingViewRef = useRef(null)
  const economicCalendarRef = useRef(null)
  const forexHeatmapRef = useRef(null)
  const forexScreenerRef = useRef(null)
  const walletDropdownRef = useRef(null)
  
  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target)) {
        setShowWalletDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Handle responsive view switching
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Only redirect on initial load if mobile, not on resize
    }
    window.addEventListener('resize', handleResize)
    
    // Initial check - redirect to mobile only on first load
    if (window.innerWidth < 768 && !sessionStorage.getItem('viewChecked')) {
      sessionStorage.setItem('viewChecked', 'true')
      navigate('/mobile')
    }
    
    return () => window.removeEventListener('resize', handleResize)
  }, [navigate])

  // Check auth status on mount
  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token')
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

  // Fetch wallet balance and user data
  useEffect(() => {
    checkAuthStatus()
    fetchChallengeStatus()
    if (user._id) {
      fetchWalletBalance()
      fetchUserAccounts()
    }
  }, [user._id])
  
  // Fetch trades after accounts are loaded
  useEffect(() => {
    if (userAccounts.length > 0) {
      fetchTrades()
    }
  }, [userAccounts])

  const fetchChallengeStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/prop/status`)
      const data = await res.json()
      if (data.success) {
        setChallengeModeEnabled(data.enabled)
      }
    } catch (error) {
      console.error('Error fetching challenge status:', error)
    }
  }

  const fetchWalletBalance = async () => {
    try {
      const res = await fetch(`${API_URL}/wallet/${user._id}`)
      const data = await res.json()
      setWalletBalance(data.wallet?.balance || 0)
    } catch (error) {
      console.error('Error fetching wallet:', error)
    }
  }

  const fetchUserAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/trading-accounts/user/${user._id}`)
      const data = await res.json()
      console.log('Fetched accounts:', data.accounts)
      setUserAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/account-types`)
      const data = await res.json()
      // Filter only active, non-demo account types
      const liveTypes = (data.accountTypes || []).filter(type => type.isActive && !type.isDemo)
      setAccountTypes(liveTypes)
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
  }

  // Transfer funds from Main Wallet to Trading Account
  const handleTransferFunds = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setModalError('Please enter a valid amount')
      return
    }
    if (parseFloat(transferAmount) > walletBalance) {
      setModalError('Insufficient wallet balance')
      return
    }

    try {
      const res = await fetch(`${API_URL}/trading-accounts/${selectedAccount._id}/transfer`, {
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
        toast.success('Funds transferred successfully!')
        setShowTransferModal(false)
        setTransferAmount('')
        setSelectedAccount(null)
        setModalError('')
        fetchUserAccounts()
        fetchWalletBalance()
      } else {
        setModalError(data.message || 'Transfer failed')
      }
    } catch (error) {
      console.error('Transfer error:', error)
      setModalError('Error transferring funds')
    }
  }

  // Withdraw funds from Trading Account to Main Wallet
  const handleWithdrawFromAccount = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setModalError('Please enter a valid amount')
      return
    }
    if (parseFloat(transferAmount) > selectedAccount.balance) {
      setModalError('Insufficient account balance')
      return
    }

    try {
      const res = await fetch(`${API_URL}/trading-accounts/${selectedAccount._id}/transfer`, {
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
        setSelectedAccount(null)
        setModalError('')
        fetchUserAccounts()
        fetchWalletBalance()
      } else {
        setModalError(data.message || 'Withdrawal failed')
      }
    } catch (error) {
      console.error('Withdraw error:', error)
      setModalError('Error withdrawing funds')
    }
  }

  const fetchTrades = async () => {
    try {
      // Fetch trades for all user accounts
      let allTrades = []
      let charges = 0
      let pnl = 0
      
      for (const account of userAccounts) {
        // Fetch closed trades for history
        const historyRes = await fetch(`${API_URL}/trade/history/${account._id}`)
        const historyData = await historyRes.json()
        if (historyData.success && historyData.trades) {
          allTrades = [...allTrades, ...historyData.trades]
          // Calculate charges (commission + swap)
          historyData.trades.forEach(trade => {
            charges += (trade.commission || 0) + (trade.swap || 0)
            pnl += (trade.realizedPnl || 0)
          })
        }
        
        // Fetch open trades
        const openRes = await fetch(`${API_URL}/trade/open/${account._id}`)
        const openData = await openRes.json()
        if (openData.success && openData.trades) {
          allTrades = [...allTrades, ...openData.trades]
        }
      }
      
      setTotalTrades(allTrades.length)
      setTotalCharges(Math.abs(charges))
      setTotalPnl(pnl)
    } catch (error) {
      console.error('Error fetching trades:', error)
    }
  }

  // Fetch crypto news
  useEffect(() => {
    const fetchNews = async () => {
      setNewsLoading(true)
      try {
        // Using CoinGecko's free API for crypto news (no API key needed)
        const response = await fetch('https://api.coingecko.com/api/v3/news')
        if (response.ok) {
          const data = await response.json()
          setNews(data.data?.slice(0, 6) || [])
        } else {
          // Fallback sample news if API fails
          setNews([
            { title: 'Bitcoin Surges Past $100K Milestone', description: 'BTC reaches new all-time high amid institutional buying', updated_at: Date.now(), url: '#' },
            { title: 'Ethereum 2.0 Staking Rewards Increase', description: 'ETH staking yields hit 5.2% APY', updated_at: Date.now() - 3600000, url: '#' },
            { title: 'SEC Approves New Crypto ETFs', description: 'Multiple spot crypto ETFs get regulatory approval', updated_at: Date.now() - 7200000, url: '#' },
            { title: 'DeFi Total Value Locked Hits $200B', description: 'Decentralized finance continues rapid growth', updated_at: Date.now() - 10800000, url: '#' },
            { title: 'Major Bank Launches Crypto Custody', description: 'Traditional finance embraces digital assets', updated_at: Date.now() - 14400000, url: '#' },
            { title: 'NFT Market Shows Recovery Signs', description: 'Trading volume up 40% month-over-month', updated_at: Date.now() - 18000000, url: '#' },
          ])
        }
      } catch (error) {
        // Fallback sample news
        setNews([
          { title: 'Bitcoin Surges Past $100K Milestone', description: 'BTC reaches new all-time high amid institutional buying', updated_at: Date.now(), url: '#' },
          { title: 'Ethereum 2.0 Staking Rewards Increase', description: 'ETH staking yields hit 5.2% APY', updated_at: Date.now() - 3600000, url: '#' },
          { title: 'SEC Approves New Crypto ETFs', description: 'Multiple spot crypto ETFs get regulatory approval', updated_at: Date.now() - 7200000, url: '#' },
          { title: 'DeFi Total Value Locked Hits $200B', description: 'Decentralized finance continues rapid growth', updated_at: Date.now() - 10800000, url: '#' },
          { title: 'Major Bank Launches Crypto Custody', description: 'Traditional finance embraces digital assets', updated_at: Date.now() - 14400000, url: '#' },
          { title: 'NFT Market Shows Recovery Signs', description: 'Trading volume up 40% month-over-month', updated_at: Date.now() - 18000000, url: '#' },
        ])
      }
      setNewsLoading(false)
    }
    fetchNews()
    const interval = setInterval(fetchNews, 300000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Economic calendar events
  useEffect(() => {
    setEventsLoading(true)
    // Sample economic events (in production, use a real API like Forex Factory or Trading Economics)
    const sampleEvents = [
      { date: '2026-01-08', time: '08:30', country: 'US', event: 'Non-Farm Payrolls', impact: 'high', forecast: '180K', previous: '227K' },
      { date: '2026-01-08', time: '10:00', country: 'US', event: 'ISM Services PMI', impact: 'high', forecast: '53.5', previous: '52.1' },
      { date: '2026-01-09', time: '08:30', country: 'US', event: 'Initial Jobless Claims', impact: 'medium', forecast: '210K', previous: '211K' },
      { date: '2026-01-09', time: '14:00', country: 'US', event: 'FOMC Meeting Minutes', impact: 'high', forecast: '-', previous: '-' },
      { date: '2026-01-10', time: '08:30', country: 'US', event: 'CPI m/m', impact: 'high', forecast: '0.3%', previous: '0.3%' },
      { date: '2026-01-10', time: '08:30', country: 'US', event: 'Core CPI m/m', impact: 'high', forecast: '0.2%', previous: '0.3%' },
      { date: '2026-01-13', time: '08:30', country: 'US', event: 'PPI m/m', impact: 'medium', forecast: '0.2%', previous: '0.4%' },
      { date: '2026-01-14', time: '08:30', country: 'US', event: 'Retail Sales m/m', impact: 'high', forecast: '0.5%', previous: '0.7%' },
    ]
    setEconomicEvents(sampleEvents)
    setEventsLoading(false)
  }, [])


  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-orange-500'
      case 'low': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const menuItems = [
    { name: 'Dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Account', label: t('nav.account'), icon: User, path: '/account' },
    { name: 'Wallet', label: t('nav.wallet'), icon: Wallet, path: '/wallet' },
    { name: 'Orders', label: t('nav.orders'), icon: FileText, path: '/orders' },
    { name: 'IB', label: t('nav.ib'), icon: Users, path: '/ib' },
    { name: 'Copytrade', label: t('nav.copytrade'), icon: Copy, path: '/copytrade' },
    { name: 'Profile', label: t('nav.profile'), icon: UserCircle, path: '/profile' },
    { name: 'Support', label: t('nav.support'), icon: HelpCircle, path: '/support' },
    { name: 'Instructions', label: t('nav.instructions'), icon: FileText, path: '/instructions' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Logged out successfully!')
    navigate('/user/login')
  }

  // Load TradingView widgets - re-render when theme changes
  useEffect(() => {
    const colorTheme = isDarkMode ? "dark" : "light"
    
    // TradingView Timeline Widget (News)
    if (tradingViewRef.current) {
      tradingViewRef.current.innerHTML = ''
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js'
      script.async = true
      script.innerHTML = JSON.stringify({
        "feedMode": "all_symbols",
        "colorTheme": colorTheme,
        "isTransparent": false,
        "displayMode": "regular",
        "width": "100%",
        "height": "100%",
        "locale": "en"
      })
      tradingViewRef.current.appendChild(script)
    }

    // TradingView Economic Calendar Widget
    if (economicCalendarRef.current) {
      economicCalendarRef.current.innerHTML = ''
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'
      script.async = true
      script.innerHTML = JSON.stringify({
        "colorTheme": colorTheme,
        "isTransparent": false,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "importanceFilter": "0,1",
        "countryFilter": "us,eu,gb,jp,cn"
      })
      economicCalendarRef.current.appendChild(script)
    }

    // TradingView Forex Heatmap Widget
    if (forexHeatmapRef.current) {
      forexHeatmapRef.current.innerHTML = ''
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-forex-heat-map.js'
      script.async = true
      script.innerHTML = JSON.stringify({
        "width": "100%",
        "height": "100%",
        "currencies": ["EUR", "USD", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD"],
        "isTransparent": false,
        "colorTheme": colorTheme,
        "locale": "en"
      })
      forexHeatmapRef.current.appendChild(script)
    }

    // TradingView Forex Screener Widget
    if (forexScreenerRef.current) {
      forexScreenerRef.current.innerHTML = ''
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js'
      script.async = true
      script.innerHTML = JSON.stringify({
        "width": "100%",
        "height": "100%",
        "defaultColumn": "overview",
        "defaultScreen": "general",
        "market": "forex",
        "showToolbar": true,
        "colorTheme": colorTheme,
        "locale": "en",
        "isTransparent": false
      })
      forexScreenerRef.current.appendChild(script)
    }
  }, [isDarkMode])

  return (
    <div className={`flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-dark-900' : 'bg-gray-100'}`}>
      {/* Full Width Header */}
      <div className="w-full shrink-0 relative border-b bg-gradient-to-r from-dark-800 via-dark-900 to-dark-800 border-gray-800">
        <div className="flex items-center justify-between px-6 py-3">
          <img src={logoImage} alt="BlueStone" className="h-8 w-auto object-contain" />
          <UserHeader />
        </div>
      </div>

      {/* Main Layout - Sidebar + Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Collapsible Sidebar - Fixed */}
        <aside 
          className={`${sidebarExpanded ? 'w-48' : 'w-16'} ${isDarkMode ? 'bg-dark-900 border-gray-800' : 'bg-white border-gray-200'} border-r flex flex-col shrink-0 min-h-0 overflow-hidden transition-all duration-300 ease-in-out`}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          {/* Menu */}
        <nav className="hide-scrollbar flex-1 min-h-0 overflow-y-auto px-2 pt-4">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                activeMenu === item.name 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                  : isDarkMode 
                    ? 'text-gray-400 hover:text-white hover:bg-dark-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={!sidebarExpanded ? item.label : ''}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className={`p-2 border-t shrink-0 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors rounded-lg ${
              isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={!sidebarExpanded ? t('nav.logout') : ''}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">{t('nav.logout')}</span>}
          </button>
        </div>
        </aside>

        {/* Main Content - Scrollable */}
        <main className="hide-scrollbar flex-1 min-h-0 overflow-y-auto">
          {/* Dashboard Content */}
          <div className="p-6">
          {/* Banner Slider */}
          <div className="mb-6">
            <BannerSlider isDarkMode={isDarkMode} />
          </div>

          {/* Top Stats Boxes */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Wallet Box */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-accent-green/20 rounded-lg flex items-center justify-center">
                  <Wallet size={20} className="text-accent-green" />
                </div>
                <button onClick={() => navigate('/wallet')} className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium px-3 py-1 rounded-lg hover:opacity-90">{t('dashboard.view')}</button>
              </div>
              <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.walletBalance')}</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${walletBalance.toLocaleString()}</p>
            </div>

            {/* Total Trades Box */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp size={20} className="text-blue-500" />
                </div>
                <span className="text-gray-500 text-xs">{userAccounts.length} {t('dashboard.accounts')}</span>
              </div>
              <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.totalTrades')}</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalTrades.toLocaleString()}</p>
            </div>

            {/* Total Charges Box */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign size={20} className="text-orange-500" />
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.feesSwap')}</span>
              </div>
              <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.totalCharges')}</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${totalCharges.toFixed(2)}</p>
            </div>

            {/* Total PnL Box */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-purple-500" />
                </div>
                <span className={`text-xs font-medium ${totalPnl >= 0 ? 'text-accent-green' : 'text-red-500'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl !== 0 ? ((totalPnl / (walletBalance || 1)) * 100).toFixed(1) + '%' : '0%'}
                </span>
              </div>
              <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.totalPnl')}</p>
              <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-accent-green' : 'text-red-500'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Forex Heatmap */}
          <div className={`rounded-xl p-5 border mb-6 ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-orange-500" />
              </div>
              <div>
                <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.forexHeatmap')}</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.forexHeatmapDesc')}</p>
              </div>
            </div>
            <div className="h-80 overflow-hidden rounded-lg">
              <div ref={forexHeatmapRef} className="tradingview-widget-container h-full">
                <div className="tradingview-widget-container__widget h-full"></div>
              </div>
            </div>
            <div className="text-center mt-3">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Forex Heatmap <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 hover:underline cursor-pointer">by TradingView</a></span>
            </div>
          </div>

          {/* Forex Screener */}
          <div className={`rounded-xl p-5 border mb-6 ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={20} className="text-cyan-500" />
              </div>
              <div>
                <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.forexScreener')}</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.forexScreenerDesc')}</p>
              </div>
            </div>
            <div className="h-96 overflow-hidden rounded-lg">
              <div ref={forexScreenerRef} className="tradingview-widget-container h-full">
                <div className="tradingview-widget-container__widget h-full"></div>
              </div>
            </div>
          </div>

          {/* Market News & Economic Calendar - TradingView Widgets */}
          <div className="grid grid-cols-2 gap-6">
            {/* Market News - TradingView Timeline Widget */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Newspaper size={20} className="text-blue-500" />
                </div>
                <div>
                  <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.marketNews')}</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.marketNewsDesc')}</p>
                </div>
              </div>
              <div className="h-96 overflow-hidden rounded-lg">
                <div ref={tradingViewRef} className="tradingview-widget-container h-full">
                  <div className="tradingview-widget-container__widget h-full"></div>
                </div>
              </div>
            </div>

            {/* Economic Calendar - TradingView Widget */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Calendar size={20} className="text-purple-500" />
                </div>
                <div>
                  <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.economicCalendar')}</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t('dashboard.economicCalendarDesc')}</p>
                </div>
              </div>
              <div className="h-96 overflow-hidden rounded-lg">
                <div ref={economicCalendarRef} className="tradingview-widget-container h-full">
                  <div className="tradingview-widget-container__widget h-full"></div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </main>
      </div>

      {/* Transfer Modal (Main Wallet → Trading Account) */}
      {showTransferModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Transfer to Account</h3>
              <button 
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferAmount('')
                  setModalError('')
                }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className={`p-3 rounded-lg mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                  <TrendingUp size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedAccount.accountId}</p>
                  <p className="text-gray-500 text-xs">{selectedAccount.accountTypeId?.name}</p>
                </div>
              </div>
              <div className={`flex justify-between text-sm mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <span className="text-gray-400">Account Balance:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${selectedAccount.balance?.toLocaleString() || '0.00'}</span>
              </div>
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Main Wallet Balance:</span>
                <span className="text-green-500 font-medium">${walletBalance.toLocaleString()}</span>
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
                placeholder="Enter amount"
                className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:border-green-500 border ${isDarkMode ? 'bg-dark-700 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
              <button 
                type="button"
                onClick={() => setTransferAmount(walletBalance.toString())}
                className="text-green-500 text-xs hover:underline mt-2"
              >
                Max: ${walletBalance.toLocaleString()}
              </button>
            </div>

            {modalError && <p className="text-red-500 text-sm mb-4">{modalError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferAmount('')
                  setModalError('')
                }}
                className={`flex-1 py-3 rounded-lg transition-colors ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleTransferFunds}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:opacity-90 transition-colors"
              >
                Transfer Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal (Trading Account → Main Wallet) */}
      {showWithdrawModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Withdraw to Main Wallet</h3>
              <button 
                onClick={() => {
                  setShowWithdrawModal(false)
                  setTransferAmount('')
                  setModalError('')
                }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className={`p-3 rounded-lg mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                  <TrendingUp size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedAccount.accountId}</p>
                  <p className="text-gray-500 text-xs">{selectedAccount.accountTypeId?.name}</p>
                </div>
              </div>
              <div className={`flex justify-between text-sm mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <span className="text-gray-400">Available Balance:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${selectedAccount.balance?.toLocaleString() || '0.00'}</span>
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
                placeholder="Enter amount"
                className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:border-green-500 border ${isDarkMode ? 'bg-dark-700 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
              <button 
                type="button"
                onClick={() => setTransferAmount(selectedAccount.balance?.toString() || '0')}
                className="text-green-500 text-xs hover:underline mt-2"
              >
                Max: ${selectedAccount.balance?.toLocaleString() || '0.00'}
              </button>
            </div>

            {modalError && <p className="text-red-500 text-sm mb-4">{modalError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false)
                  setTransferAmount('')
                  setModalError('')
                }}
                className={`flex-1 py-3 rounded-lg transition-colors ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawFromAccount}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:opacity-90 transition-colors"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
