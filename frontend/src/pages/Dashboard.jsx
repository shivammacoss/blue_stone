import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  ExternalLink,
  RefreshCw,
  Activity,
  Trophy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const API_URL = 'http://localhost:5001/api'

const Dashboard = () => {
  const navigate = useNavigate()
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [economicEvents, setEconomicEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [totalTrades, setTotalTrades] = useState(0)
  const [totalCharges, setTotalCharges] = useState(0)
  const [totalPnl, setTotalPnl] = useState(0)
  const [userAccounts, setUserAccounts] = useState([])
  const [challengeModeEnabled, setChallengeModeEnabled] = useState(false)
  const [marketNews, setMarketNews] = useState([])
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)
  const tradingViewRef = useRef(null)
  const economicCalendarRef = useRef(null)
  const forexHeatmapRef = useRef(null)
  const forexScreenerRef = useRef(null)
  
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
        alert(data.message || 'Session expired. Please login again.')
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
      setUserAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
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

  // Fetch market news from free API
  useEffect(() => {
    const fetchMarketNews = async () => {
      try {
        // Using NewsData.io free tier or fallback to sample data
        const response = await fetch('https://newsdata.io/api/1/news?apikey=pub_63aboreal&q=forex%20OR%20currency%20OR%20trading&language=en&category=business')
        if (response.ok) {
          const data = await response.json()
          if (data.results && data.results.length > 0) {
            setMarketNews(data.results.slice(0, 10))
            return
          }
        }
      } catch (error) {
        console.log('Using fallback news data')
      }
      
      // Fallback sample news with images
      setMarketNews([
        { title: 'EUR/USD Breaks Key Resistance Level', description: 'Euro surges against dollar amid ECB hawkish stance', image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'Fed Signals Potential Rate Cuts in 2026', description: 'Federal Reserve hints at monetary policy shift', image_url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'GBP/JPY Volatility Spikes on BOJ News', description: 'Bank of Japan policy decision creates market turbulence', image_url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'Gold Prices Hit New Record High', description: 'Safe-haven demand drives precious metals rally', image_url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'Oil Markets React to OPEC+ Decision', description: 'Crude prices fluctuate on production cut news', image_url: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'USD/CHF Tests Critical Support Zone', description: 'Swiss franc strengthens on risk-off sentiment', image_url: 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'AUD/USD Rallies on China Data', description: 'Australian dollar gains on positive trade figures', image_url: 'https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=400', pubDate: new Date().toISOString(), link: '#' },
        { title: 'Crypto Markets Show Correlation with Forex', description: 'Bitcoin movements mirror dollar index trends', image_url: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400', pubDate: new Date().toISOString(), link: '#' },
      ])
    }
    
    fetchMarketNews()
    const interval = setInterval(fetchMarketNews, 600000) // Refresh every 10 minutes
    return () => clearInterval(interval)
  }, [])

  // Auto-slide news
  useEffect(() => {
    if (marketNews.length === 0) return
    const interval = setInterval(() => {
      setCurrentNewsIndex((prev) => (prev + 1) % marketNews.length)
    }, 5000) // Change slide every 5 seconds
    return () => clearInterval(interval)
  }, [marketNews.length])

  const nextNews = () => {
    setCurrentNewsIndex((prev) => (prev + 1) % marketNews.length)
  }

  const prevNews = () => {
    setCurrentNewsIndex((prev) => (prev - 1 + marketNews.length) % marketNews.length)
  }

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
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Account', icon: User, path: '/account' },
    { name: 'Wallet', icon: Wallet, path: '/wallet' },
    { name: 'IB', icon: Users, path: '/ib' },
    { name: 'Copytrade', icon: Copy, path: '/copytrade' },
    { name: 'Profile', icon: UserCircle, path: '/profile' },
    { name: 'Support', icon: HelpCircle, path: '/support' },
    { name: 'Instructions', icon: FileText, path: '/instructions' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/user/login')
  }

  // Load TradingView widgets
  useEffect(() => {
    // TradingView Timeline Widget (News)
    if (tradingViewRef.current) {
      tradingViewRef.current.innerHTML = ''
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js'
      script.async = true
      script.innerHTML = JSON.stringify({
        "feedMode": "all_symbols",
        "colorTheme": "dark",
        "isTransparent": true,
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
        "colorTheme": "dark",
        "isTransparent": true,
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
        "isTransparent": true,
        "colorTheme": "dark",
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
        "colorTheme": "dark",
        "locale": "en",
        "isTransparent": true
      })
      forexScreenerRef.current.appendChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Collapsible Sidebar */}
      <aside 
        className={`${sidebarExpanded ? 'w-48' : 'w-16'} bg-dark-900 border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo - Icon only */}
        <div className="p-4 flex items-center justify-center">
          <div className="w-8 h-8 bg-accent-green rounded flex items-center justify-center">
            <span className="text-black font-bold text-sm">⟨X</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-2">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                activeMenu === item.name 
                  ? 'bg-accent-green text-black' 
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
              title={!sidebarExpanded ? item.name : ''}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white transition-colors rounded-lg"
            title={!sidebarExpanded ? 'Log Out' : ''}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Market News Slider - Top Banner */}
        {marketNews.length > 0 && (
          <div className="relative bg-gradient-to-r from-dark-800 via-dark-900 to-dark-800 border-b border-gray-800">
            <div className="flex items-center">
              {/* News Label */}
              <div className="bg-red-500 px-4 py-3 flex items-center gap-2">
                <Newspaper size={16} className="text-white" />
                <span className="text-white font-bold text-sm uppercase">Breaking</span>
              </div>
              
              {/* News Slider */}
              <div className="flex-1 overflow-hidden relative">
                <div 
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentNewsIndex * 100}%)` }}
                >
                  {marketNews.map((item, index) => (
                    <a 
                      key={index}
                      href={item.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-full flex items-center gap-4 px-4 py-2 hover:bg-dark-700/50 transition-colors"
                    >
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{item.title}</p>
                        <p className="text-gray-400 text-xs truncate">{item.description}</p>
                      </div>
                      <ExternalLink size={14} className="text-gray-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-1 px-2">
                <button 
                  onClick={prevNews}
                  className="p-1.5 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-white"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={nextNews}
                  className="p-1.5 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-white"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Dots Indicator */}
              <div className="flex items-center gap-1 px-3 border-l border-gray-700">
                {marketNews.slice(0, 8).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentNewsIndex(index)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      currentNewsIndex === index ? 'bg-accent-green' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Simple Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome back!</p>
        </header>

        {/* Dashboard Content */}
        <div className="p-6">
          {/* Top Stats Boxes */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Wallet Box */}
            <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-accent-green/20 rounded-lg flex items-center justify-center">
                  <Wallet size={20} className="text-accent-green" />
                </div>
                <button onClick={() => navigate('/wallet')} className="text-accent-green text-xs font-medium hover:underline">View</button>
              </div>
              <p className="text-gray-500 text-sm mb-1">Wallet Balance</p>
              <p className="text-white text-2xl font-bold">${walletBalance.toLocaleString()}</p>
            </div>

            {/* Total Trades Box */}
            <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp size={20} className="text-blue-500" />
                </div>
                <span className="text-gray-500 text-xs">{userAccounts.length} accounts</span>
              </div>
              <p className="text-gray-500 text-sm mb-1">Total Trades</p>
              <p className="text-white text-2xl font-bold">{totalTrades.toLocaleString()}</p>
            </div>

            {/* Total Charges Box */}
            <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign size={20} className="text-orange-500" />
                </div>
                <span className="text-gray-500 text-xs">Fees & Swap</span>
              </div>
              <p className="text-gray-500 text-sm mb-1">Total Charges</p>
              <p className="text-white text-2xl font-bold">${totalCharges.toFixed(2)}</p>
            </div>

            {/* Total PnL Box */}
            <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-purple-500" />
                </div>
                <span className={`text-xs font-medium ${totalPnl >= 0 ? 'text-accent-green' : 'text-red-500'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl !== 0 ? ((totalPnl / (walletBalance || 1)) * 100).toFixed(1) + '%' : '0%'}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-1">Total PnL</p>
              <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-accent-green' : 'text-red-500'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Forex Heatmap */}
          <div className="bg-dark-800 rounded-xl p-5 border border-gray-800 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-orange-500" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Forex Heatmap</h2>
                <p className="text-gray-500 text-sm">Currency strength visualization</p>
              </div>
            </div>
            <div className="h-80 overflow-hidden rounded-lg">
              <div ref={forexHeatmapRef} className="tradingview-widget-container h-full">
                <div className="tradingview-widget-container__widget h-full"></div>
              </div>
            </div>
          </div>

          {/* Forex Screener */}
          <div className="bg-dark-800 rounded-xl p-5 border border-gray-800 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={20} className="text-cyan-500" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Forex Screener</h2>
                <p className="text-gray-500 text-sm">Real-time currency pair analysis</p>
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
            <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Newspaper size={20} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Market News</h2>
                  <p className="text-gray-500 text-sm">Real-time updates from TradingView</p>
                </div>
              </div>
              <div className="h-96 overflow-hidden rounded-lg">
                <div ref={tradingViewRef} className="tradingview-widget-container h-full">
                  <div className="tradingview-widget-container__widget h-full"></div>
                </div>
              </div>
            </div>

            {/* Economic Calendar - TradingView Widget */}
            <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Calendar size={20} className="text-purple-500" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Economic Calendar</h2>
                  <p className="text-gray-500 text-sm">Real-time events from TradingView</p>
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
  )
}

export default Dashboard
