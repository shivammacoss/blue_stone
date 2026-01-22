import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, User, Wallet, Users, Copy, UserCircle, HelpCircle, FileText, LogOut,
  TrendingUp, DollarSign, UserPlus, Link, ChevronDown, ChevronRight, Award, Trophy,
  ArrowLeft, Home, Crown, Share2, RefreshCw, Sun, Moon
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import logo from '../assets/logo.png'

import { API_URL } from '../config/api'

const IBPage = () => {
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [ibProfile, setIbProfile] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [commissions, setCommissions] = useState([])
  const [downline, setDownline] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [challengeModeEnabled, setChallengeModeEnabled] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [levelProgress, setLevelProgress] = useState(null)
  const [entryFeeSettings, setEntryFeeSettings] = useState({ entryFeeEnabled: false, entryFee: 0 })
  const [eligibility, setEligibility] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Account', icon: User, path: '/account' },
    { name: 'Wallet', icon: Wallet, path: '/wallet' },
    { name: 'Orders', icon: FileText, path: '/orders' },
    { name: 'IB', icon: Users, path: '/ib' },
    { name: 'Copytrade', icon: Copy, path: '/copytrade' },
    { name: 'Profile', icon: UserCircle, path: '/profile' },
    { name: 'Support', icon: HelpCircle, path: '/support' },
    { name: 'Instructions', icon: FileText, path: '/instructions' },
  ]

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchChallengeStatus()
    fetchIBProfile()
    fetchEntryFeeSettings()

    // Auto-refresh every 15 seconds
    const refreshInterval = setInterval(() => {
      fetchIBProfile()
    }, 15000)

    return () => clearInterval(refreshInterval)
  }, [])

  const fetchEntryFeeSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/entry-fee-settings`)
      const data = await res.json()
      if (data.success) {
        setEntryFeeSettings({
          entryFeeEnabled: data.entryFeeEnabled,
          entryFee: data.entryFee
        })
        // Check eligibility if entry fee is enabled
        if (data.entryFeeEnabled && data.entryFee > 0) {
          checkEligibility()
        }
      }
    } catch (error) {
      console.error('Error fetching entry fee settings:', error)
    }
  }

  const checkEligibility = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/check-eligibility/${user._id}`)
      const data = await res.json()
      if (data.success) {
        setEligibility(data)
      }
    } catch (error) {
      console.error('Error checking eligibility:', error)
    }
  }

  const fetchChallengeStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/prop/status`)
      const data = await res.json()
      if (data.success) setChallengeModeEnabled(data.enabled)
    } catch (error) {
      console.error('Error fetching challenge status:', error)
    }
  }

  const fetchIBProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/my-profile/${user._id}`)
      const data = await res.json()
      if (data.ibUser) {
        // Merge ibUser, wallet, and stats into one profile object
        setIbProfile({
          ...data.ibUser,
          ibWalletBalance: data.wallet?.balance || 0,
          totalCommissionEarned: data.wallet?.totalEarned || 0,
          pendingWithdrawal: data.wallet?.pendingWithdrawal || 0,
          totalWithdrawn: data.wallet?.totalWithdrawn || 0,
          stats: data.stats || {}
        })
        // Set level progress data
        if (data.levelProgress) {
          setLevelProgress(data.levelProgress)
        }
        // Check both status and ibStatus for compatibility
        if (data.ibUser.status === 'ACTIVE' || data.ibUser.ibStatus === 'ACTIVE') {
          fetchReferrals()
          fetchCommissions()
          fetchDownline()
        }
      }
    } catch (error) {
      console.error('Error fetching IB profile:', error)
    }
    setLoading(false)
  }

  const fetchReferrals = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/my-referrals/${user._id}`)
      const data = await res.json()
      setReferrals(data.referrals || [])
    } catch (error) {
      console.error('Error fetching referrals:', error)
    }
  }

  const fetchCommissions = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/my-commissions/${user._id}`)
      const data = await res.json()
      setCommissions(data.commissions || [])
    } catch (error) {
      console.error('Error fetching commissions:', error)
    }
  }

  const fetchDownline = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/my-downline/${user._id}`)
      const data = await res.json()
      // The API returns tree with downlines array
      setDownline(data.tree?.downlines || [])
    } catch (error) {
      console.error('Error fetching downline:', error)
    }
  }

  const handleApply = async () => {
    // Check if entry fee is required and user doesn't have enough balance
    if (entryFeeSettings.entryFeeEnabled && entryFeeSettings.entryFee > 0) {
      if (eligibility && !eligibility.eligible) {
        alert(`Insufficient wallet balance. You need $${entryFeeSettings.entryFee} to become an IB. Please deposit funds first.`)
        navigate('/wallet')
        return
      }
    }

    setApplying(true)
    try {
      const res = await fetch(`${API_URL}/ib/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      })
      const data = await res.json()
      
      // Handle insufficient balance error from backend
      if (data.code === 'INSUFFICIENT_BALANCE') {
        alert(`Insufficient wallet balance. You need $${data.entryFee} to become an IB. Your current balance is $${data.walletBalance}. Please deposit $${data.shortfall.toFixed(2)} more.`)
        navigate('/wallet')
        setApplying(false)
        return
      }
      
      if (data.success || data.ibUser || data.user) {
        // Set the profile with PENDING status immediately
        const userData = data.ibUser || data.user || {}
        setIbProfile({
          ...userData,
          status: userData.ibStatus || 'PENDING',
          ibStatus: userData.ibStatus || 'PENDING'
        })
        const feeMsg = entryFeeSettings.entryFeeEnabled && entryFeeSettings.entryFee > 0 
          ? ` Entry fee of $${entryFeeSettings.entryFee} has been deducted from your wallet.` 
          : ''
        alert(`IB application submitted successfully!${feeMsg}`)
        // Refresh profile to get latest data
        setTimeout(() => fetchIBProfile(), 500)
      } else {
        alert(data.message || 'Failed to apply')
      }
    } catch (error) {
      console.error('Error applying:', error)
      alert('Failed to submit application')
    }
    setApplying(false)
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    try {
      const res = await fetch(`${API_URL}/ib/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          amount: parseFloat(withdrawAmount)
        })
      })
      const data = await res.json()
      if (data.status) {
        alert(data.message)
        setWithdrawAmount('')
        fetchIBProfile()
      } else {
        alert(data.message || 'Failed to withdraw')
      }
    } catch (error) {
      console.error('Error withdrawing:', error)
      alert('Failed to process withdrawal')
    }
  }

  const copyReferralLink = () => {
    const link = `${window.location.origin}/user/signup?ref=${ibProfile?.referralCode}`
    navigator.clipboard.writeText(link)
    alert('Referral link copied!')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/user/login')
  }

  const renderDownlineTree = (nodes, level = 0) => {
    if (!nodes || nodes.length === 0) return null
    return nodes.map((node, idx) => (
      <div key={node._id || idx} className="ml-4 border-l border-gray-700 pl-4 py-2">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${node.isIB ? 'bg-accent-green/20' : 'bg-gray-700'}`}>
            <span className={node.isIB ? 'text-accent-green' : 'text-gray-400'}>{node.firstName?.charAt(0) || '?'}</span>
          </div>
          <div>
            <p className="text-white text-sm">{node.firstName || 'Unknown'}</p>
            <p className="text-gray-500 text-xs">{node.email}</p>
          </div>
          <div className="ml-auto text-right">
            <span className={`px-2 py-1 rounded text-xs ${node.isIB ? 'bg-accent-green/20 text-accent-green' : 'bg-gray-700 text-gray-400'}`}>
              {node.isIB ? 'IB' : 'User'} • Level {(node.level || 0) + 1}
            </span>
          </div>
        </div>
      </div>
    ))
  }

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${isDarkMode ? 'bg-dark-900' : 'bg-gray-100'}`}>
      {/* Mobile Header */}
      {isMobile && (
        <header className={`fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center gap-4 ${isDarkMode ? 'bg-dark-800 border-b border-gray-800' : 'bg-white border-b border-gray-200'}`}>
          <button onClick={() => navigate('/mobile')} className={`p-2 -ml-2 rounded-lg ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft size={22} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
          </button>
          <h1 className={`font-semibold text-lg flex-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>IB Program</h1>
          <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${isDarkMode ? 'text-yellow-400 hover:bg-dark-700' : 'text-blue-500 hover:bg-gray-100'}`}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => navigate('/mobile')} className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}>
            <Home size={20} className="text-gray-400" />
          </button>
        </header>
      )}

      {/* Sidebar - Hidden on Mobile */}
      {!isMobile && (
        <aside 
          className={`${sidebarExpanded ? 'w-48' : 'w-16'} ${isDarkMode ? 'bg-dark-900 border-gray-800' : 'bg-white border-gray-200'} border-r flex flex-col transition-all duration-300`}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <div className="p-4 flex items-center justify-center">
            <img src={logo} alt="ProfitVisionFX" className="h-12 object-contain" />
          </div>
          <nav className="flex-1 px-2">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  item.name === 'IB' ? 'bg-accent-green text-black' : isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {sidebarExpanded && <span className="text-sm font-medium">{item.name}</span>}
              </button>
            ))}
          </nav>
          <div className={`p-2 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <button onClick={toggleDarkMode} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 ${isDarkMode ? 'text-yellow-400 hover:bg-dark-700' : 'text-blue-500 hover:bg-gray-100'}`}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              {sidebarExpanded && <span className="text-sm">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              <LogOut size={18} />
              {sidebarExpanded && <span className="text-sm">Log Out</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${isMobile ? 'pt-14' : ''}`}>
        {!isMobile && (
          <header className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Introducing Broker (IB)</h1>
          </header>
        )}

        <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : !ibProfile ? (
            /* Not an IB - Show Apply */
            <div className={`${isMobile ? '' : 'max-w-lg mx-auto'} text-center ${isMobile ? 'py-6' : 'py-12'}`}>
              <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Award size={isMobile ? 32 : 40} className="text-accent-green" />
              </div>
              <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white mb-3`}>Become an Introducing Broker</h2>
              <p className="text-gray-400 mb-4 text-sm">
                Earn commissions by referring traders. Get up to 5 levels of referral commissions!
              </p>
              
              {/* Entry Fee Notice */}
              {entryFeeSettings.entryFeeEnabled && entryFeeSettings.entryFee > 0 && (
                <div className={`${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-xl p-4 mb-4`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign size={20} className="text-yellow-500" />
                    <span className="text-yellow-500 font-semibold">Entry Fee: ${entryFeeSettings.entryFee}</span>
                  </div>
                  {eligibility && !eligibility.eligible ? (
                    <div>
                      <p className="text-red-400 text-sm mb-2">
                        Insufficient balance. You need ${eligibility.shortfall?.toFixed(2)} more.
                      </p>
                      <p className="text-gray-400 text-xs">
                        Your wallet: ${eligibility.walletBalance?.toFixed(2) || '0.00'}
                      </p>
                      <button
                        onClick={() => navigate('/wallet')}
                        className="mt-3 bg-yellow-500 text-black px-6 py-2 rounded-lg font-semibold hover:bg-yellow-400 text-sm"
                      >
                        Deposit Now
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs">
                      This fee will be deducted from your wallet upon application.
                    </p>
                  )}
                </div>
              )}

              <div className={`${isDarkMode ? 'bg-dark-800' : 'bg-gray-100'} rounded-xl ${isMobile ? 'p-4' : 'p-6'} mb-4 text-left`}>
                <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-semibold mb-3 text-sm`}>Benefits:</h3>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li className="flex items-center gap-2">
                    <ChevronRight size={14} className="text-accent-green flex-shrink-0" />
                    Earn commission on every trade your referrals make
                  </li>
                  <li className="flex items-center gap-2">
                    <ChevronRight size={14} className="text-accent-green flex-shrink-0" />
                    Multi-level commissions (up to 5 levels)
                  </li>
                  <li className="flex items-center gap-2">
                    <ChevronRight size={14} className="text-accent-green flex-shrink-0" />
                    Real-time commission tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <ChevronRight size={16} className="text-accent-green" />
                    Easy withdrawal to your wallet
                  </li>
                </ul>
              </div>
              <button
                onClick={handleApply}
                disabled={applying || (entryFeeSettings.entryFeeEnabled && eligibility && !eligibility.eligible)}
                className="bg-accent-green text-black px-8 py-3 rounded-lg font-semibold hover:bg-accent-green/90 disabled:opacity-50"
              >
                {applying ? 'Applying...' : entryFeeSettings.entryFeeEnabled && entryFeeSettings.entryFee > 0 ? `Apply Now ($${entryFeeSettings.entryFee})` : 'Apply Now'}
              </button>
            </div>
          ) : (ibProfile.status === 'PENDING' || ibProfile.ibStatus === 'PENDING') ? (
            /* Pending Approval */
            <div className={`${isMobile ? '' : 'max-w-lg mx-auto'} text-center ${isMobile ? 'py-6' : 'py-12'}`}>
              <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Award size={isMobile ? 32 : 40} className="text-yellow-500" />
              </div>
              <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white mb-3`}>Application Pending</h2>
              <p className="text-gray-400 text-sm">
                Your IB application is under review. You will be notified once approved.
              </p>
            </div>
          ) : (ibProfile.status === 'REJECTED' || ibProfile.ibStatus === 'REJECTED') ? (
            /* Rejected */
            <div className={`${isMobile ? '' : 'max-w-lg mx-auto'} text-center ${isMobile ? 'py-6' : 'py-12'}`}>
              <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Award size={isMobile ? 32 : 40} className="text-red-500" />
              </div>
              <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white mb-3`}>Application Rejected</h2>
              <p className="text-gray-400 mb-2 text-sm">Unfortunately, your IB application was not approved.</p>
              {ibProfile.rejectionReason && (
                <p className="text-red-400 text-sm">Reason: {ibProfile.rejectionReason}</p>
              )}
            </div>
          ) : (
            /* Active IB Dashboard */
            <div>
              {/* Stats Cards */}
              <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-4'} mb-4`}>
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-3' : 'p-5'} border`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-accent-green/20 rounded-lg flex items-center justify-center`}>
                      <DollarSign size={isMobile ? 16 : 20} className="text-accent-green" />
                    </div>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Available Balance</p>
                  <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${ibProfile.ibWalletBalance?.toFixed(2) || '0.00'}</p>
                </div>
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-3' : 'p-5'} border`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-blue-500/20 rounded-lg flex items-center justify-center`}>
                      <TrendingUp size={isMobile ? 16 : 20} className="text-blue-500" />
                    </div>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Total Earned</p>
                  <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${ibProfile.totalCommissionEarned?.toFixed(2) || '0.00'}</p>
                </div>
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-3' : 'p-5'} border`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-purple-500/20 rounded-lg flex items-center justify-center`}>
                      <Users size={isMobile ? 16 : 20} className="text-purple-500" />
                    </div>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Direct Referrals</p>
                  <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{ibProfile.stats?.directReferrals || 0}</p>
                </div>
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-3' : 'p-5'} border`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-orange-500/20 rounded-lg flex items-center justify-center`}>
                      <UserPlus size={isMobile ? 16 : 20} className="text-orange-500" />
                    </div>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Total Downline</p>
                  <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{ibProfile.stats?.totalDownline || 0}</p>
                </div>
              </div>

              {/* Commission Rate & Referral Link Row */}
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'} mb-4`}>
                {/* Your Commission Rate */}
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-4' : 'p-5'} border`}>
                  <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your Commission Rate</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-bold text-3xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        ${levelProgress?.currentLevel?.commissionRate || 2}
                        <span className={`text-lg font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>/lot</span>
                      </p>
                      <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                        Level: <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{levelProgress?.currentLevel?.name || 'Standard'}</span>
                      </p>
                    </div>
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${levelProgress?.currentLevel?.color || '#10B981'}20` }}
                    >
                      <DollarSign size={28} style={{ color: levelProgress?.currentLevel?.color || '#10B981' }} />
                    </div>
                  </div>
                  <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>Earn commission on every trade your referrals make.</p>
                </div>

                {/* Referral Link */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl p-5">
                  <p className="text-white/80 text-sm mb-1">Your Referral Link</p>
                  <p className="text-white text-sm font-mono mb-1 truncate">
                    {window.location.origin}/user/signup?ref={ibProfile.referralCode}
                  </p>
                  <p className="text-white/60 text-xs mb-3">Code: <span className="text-white font-bold">{ibProfile.referralCode}</span></p>
                  <div className="flex gap-2">
                    <button
                      onClick={copyReferralLink}
                      className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Copy size={16} />
                      Copy Link
                    </button>
                    <button className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                      <Share2 size={18} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Unlock Progress Section */}
              {levelProgress && (
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-4' : 'p-5'} border mb-4`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Award size={20} className="text-accent-green" />
                      <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Level Unlock Progress</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                      {levelProgress.referralCount} Direct Referrals
                    </span>
                  </div>

                  {/* Two Column Layout for Direct Income and Referral Income */}
                  <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-2 gap-6'}`}>
                    {/* Direct Income (Trade Commission) */}
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Direct Income</h4>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Trade Commission Levels</p>
                        </div>
                        <div className="text-right">
                          <p className="text-accent-green font-bold text-lg">{levelProgress.directIncome?.unlockedLevels || 0}</p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>of {levelProgress.directIncome?.maxLevels || 18} levels</p>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className={`h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-dark-600' : 'bg-gray-200'} mb-3`}>
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-accent-green to-emerald-400 transition-all duration-500"
                          style={{ width: `${((levelProgress.directIncome?.unlockedLevels || 0) / (levelProgress.directIncome?.maxLevels || 18)) * 100}%` }}
                        />
                      </div>

                      {/* Tier Progress */}
                      <div className="space-y-2">
                        {levelProgress.directIncome?.tiers?.map((tier, idx) => (
                          <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${
                            levelProgress.referralCount >= tier.referralsRequired 
                              ? 'bg-accent-green/10 border border-accent-green/30' 
                              : isDarkMode ? 'bg-dark-600' : 'bg-gray-100'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                levelProgress.referralCount >= tier.referralsRequired 
                                  ? 'bg-accent-green text-black' 
                                  : isDarkMode ? 'bg-dark-500 text-gray-500' : 'bg-gray-300 text-gray-500'
                              }`}>
                                {levelProgress.referralCount >= tier.referralsRequired ? '✓' : idx + 1}
                              </div>
                              <span className={`text-sm ${levelProgress.referralCount >= tier.referralsRequired ? 'text-accent-green' : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {tier.referralsRequired} Referral{tier.referralsRequired > 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className={`text-sm font-medium ${levelProgress.referralCount >= tier.referralsRequired ? 'text-accent-green' : isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              {tier.levelsUnlocked} Levels
                            </span>
                          </div>
                        ))}
                      </div>

                      {!levelProgress.directIncome?.isFullyUnlocked && (
                        <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                          Need {levelProgress.directIncome?.referralsNeeded} more referral{levelProgress.directIncome?.referralsNeeded > 1 ? 's' : ''} to unlock next tier
                        </p>
                      )}
                      {levelProgress.directIncome?.isFullyUnlocked && (
                        <p className="text-xs mt-3 text-accent-green font-medium">✓ All levels unlocked!</p>
                      )}
                    </div>

                    {/* Referral Income */}
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Referral Income</h4>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Downline Referral Bonus</p>
                        </div>
                        <div className="text-right">
                          <p className="text-blue-400 font-bold text-lg">{levelProgress.referralIncome?.unlockedLevels || 0}</p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>of {levelProgress.referralIncome?.maxLevels || 11} levels</p>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className={`h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-dark-600' : 'bg-gray-200'} mb-3`}>
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${((levelProgress.referralIncome?.unlockedLevels || 0) / (levelProgress.referralIncome?.maxLevels || 11)) * 100}%` }}
                        />
                      </div>

                      {/* Tier Progress */}
                      <div className="space-y-2">
                        {levelProgress.referralIncome?.tiers?.map((tier, idx) => (
                          <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${
                            levelProgress.referralCount >= tier.referralsRequired 
                              ? 'bg-blue-500/10 border border-blue-500/30' 
                              : isDarkMode ? 'bg-dark-600' : 'bg-gray-100'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                levelProgress.referralCount >= tier.referralsRequired 
                                  ? 'bg-blue-500 text-white' 
                                  : isDarkMode ? 'bg-dark-500 text-gray-500' : 'bg-gray-300 text-gray-500'
                              }`}>
                                {levelProgress.referralCount >= tier.referralsRequired ? '✓' : idx + 1}
                              </div>
                              <span className={`text-sm ${levelProgress.referralCount >= tier.referralsRequired ? 'text-blue-400' : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {tier.referralsRequired} Referral{tier.referralsRequired > 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className={`text-sm font-medium ${levelProgress.referralCount >= tier.referralsRequired ? 'text-blue-400' : isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              {tier.levelsUnlocked} Levels
                            </span>
                          </div>
                        ))}
                      </div>

                      {!levelProgress.referralIncome?.isFullyUnlocked && (
                        <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                          Need {levelProgress.referralIncome?.referralsNeeded} more referral{levelProgress.referralIncome?.referralsNeeded > 1 ? 's' : ''} to unlock next tier
                        </p>
                      )}
                      {levelProgress.referralIncome?.isFullyUnlocked && (
                        <p className="text-xs mt-3 text-blue-400 font-medium">✓ All levels unlocked!</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className={`flex ${isMobile ? 'gap-1 overflow-x-auto pb-2' : 'gap-4'} mb-4`}>
                {['overview', 'referrals', 'commissions', 'downline', 'withdraw'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`${isMobile ? 'px-3 py-1.5 text-xs whitespace-nowrap' : 'px-4 py-2'} rounded-lg font-medium capitalize transition-colors ${
                      activeTab === tab ? 'bg-accent-green text-black' : isDarkMode ? 'bg-dark-800 text-gray-400 hover:text-white' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-5 gap-4'}`}>
                  {[1, 2, 3, 4, 5].map(level => (
                    <div key={level} className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-3' : 'p-4'} border text-center`}>
                      <p className={`text-xs mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Level {level} Commissions</p>
                      <p className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{ibProfile.stats?.[`level${level}Count`] || 0}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>trades</p>
                      <p className="text-accent-green text-sm mt-1">${(ibProfile.stats?.[`level${level}Commission`] || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'referrals' && (
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl border overflow-hidden`}>
                  {referrals.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-8' : 'py-12'} text-gray-500 text-sm`}>No referrals yet</div>
                  ) : isMobile ? (
                    <div className={`divide-y ${isDarkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                      {referrals.map(ref => (
                        <div key={ref._id} className="p-3">
                          <div className="flex justify-between items-start mb-1">
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{ref.firstName} {ref.lastName}</p>
                            <p className="text-gray-500 text-xs">{new Date(ref.createdAt).toLocaleDateString()}</p>
                          </div>
                          <p className="text-gray-400 text-xs">{ref.email}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className={isDarkMode ? 'bg-dark-700' : 'bg-gray-50'}>
                        <tr>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>User</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Joined</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Volume</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map(ref => (
                          <tr key={ref._id} className={`border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{ref.firstName} {ref.lastName}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{ref.email}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{new Date(ref.createdAt).toLocaleDateString()}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>-</td>
                            <td className="px-4 py-3 text-accent-green text-sm">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'commissions' && (
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl border overflow-hidden`}>
                  {commissions.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-8' : 'py-12'} text-gray-500 text-sm`}>No commissions yet</div>
                  ) : isMobile ? (
                    <div className={`divide-y ${isDarkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                      {commissions.map(comm => (
                        <div key={comm._id} className="p-3">
                          <div className="flex justify-between items-start mb-1">
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{comm.symbol}</p>
                            <p className="text-accent-green text-sm font-medium">${comm.commissionAmount?.toFixed(2)}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-gray-400 text-xs">Level {comm.level} • {comm.tradeLotSize?.toFixed(2)} lots</p>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              comm.status === 'CREDITED' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                            }`}>{comm.status}</span>
                          </div>
                          <p className="text-gray-500 text-xs mt-1">{new Date(comm.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className={isDarkMode ? 'bg-dark-700' : 'bg-gray-50'}>
                        <tr>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Date</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Trader</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Symbol</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Level</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Lots</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Commission</th>
                          <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map(comm => (
                          <tr key={comm._id} className={`border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{new Date(comm.createdAt).toLocaleDateString()}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{comm.traderUserId?.firstName || 'Unknown'}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{comm.symbol}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Level {comm.level}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{comm.tradeLotSize?.toFixed(2)}</td>
                            <td className="px-4 py-3 text-accent-green text-sm">${comm.commissionAmount?.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                comm.status === 'CREDITED' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                              }`}>
                                {comm.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'downline' && (
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-3' : 'p-5'} border`}>
                  {downline.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-8' : 'py-12'} text-gray-500 text-sm`}>No downline yet</div>
                  ) : (
                    <div>{renderDownlineTree(downline)}</div>
                  )}
                </div>
              )}

              {activeTab === 'withdraw' && (
                <div className={isMobile ? '' : 'max-w-md'}>
                  <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl ${isMobile ? 'p-4' : 'p-6'} border`}>
                    <h3 className={`font-semibold ${isMobile ? 'mb-3 text-sm' : 'mb-4'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Withdraw Commission</h3>
                    <div className="mb-3">
                      <p className="text-gray-400 text-xs mb-1">Available Balance</p>
                      <p className={`text-accent-green font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>${ibProfile.ibWalletBalance?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="mb-3">
                      <label className="text-gray-400 text-xs mb-1 block">Amount</label>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Enter amount"
                        className={`w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white ${isMobile ? 'text-sm' : ''}`}
                      />
                    </div>
                    <button
                      onClick={handleWithdraw}
                      disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                      className={`w-full bg-accent-green text-black py-2 rounded-lg font-medium hover:bg-accent-green/90 disabled:opacity-50 ${isMobile ? 'text-sm' : ''}`}
                    >
                      Request Withdrawal
                    </button>
                    {ibProfile.pendingWithdrawal > 0 && (
                      <p className="text-yellow-500 text-sm mt-3">
                        Pending withdrawal: ${ibProfile.pendingWithdrawal.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default IBPage
