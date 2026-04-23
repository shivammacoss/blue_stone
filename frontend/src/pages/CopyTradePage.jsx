import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, User, Wallet, Users, Copy, UserCircle, HelpCircle, FileText, LogOut,
  TrendingUp, Star, UserPlus, Pause, Play, X, Search, Filter, ChevronRight, Trophy, Crown, DollarSign,
  ArrowLeft, Home, Sun, Moon, Globe, Settings
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { API_URL } from '../config/api'
import logoImage from '../assets/logo.png'
import toast from 'react-hot-toast'
import LanguageDropdown from '../components/LanguageDropdown'
import UserHeader from '../components/UserHeader'
import { useLockDocumentScroll } from '../hooks/useLockDocumentScroll'

const CopyTradePage = () => {
  useLockDocumentScroll()
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { t } = useTranslation()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('discover')
  const [masters, setMasters] = useState([])
  const [mySubscriptions, setMySubscriptions] = useState([])
  const [myCopyTrades, setMyCopyTrades] = useState([])
  const [myFollowers, setMyFollowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFollowModal, setShowFollowModal] = useState(false)
  const [selectedMaster, setSelectedMaster] = useState(null)
  const [copyMode, setCopyMode] = useState('FIXED_LOT')
  const [copyValue, setCopyValue] = useState('0.01')
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [challengeModeEnabled, setChallengeModeEnabled] = useState(false)
  
  // Master trader states
  const [myMasterProfile, setMyMasterProfile] = useState(null)
  const [showMasterModal, setShowMasterModal] = useState(false)
  const [masterForm, setMasterForm] = useState({
    displayName: '',
    description: '',
    tradingAccountId: '',
    requestedCommissionPercentage: 10
  })
  const [applyingMaster, setApplyingMaster] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  
  // Edit subscription states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState(null)
  const [editAccount, setEditAccount] = useState('')
  const [editCopyMode, setEditCopyMode] = useState('FIXED_LOT')
  const [editCopyValue, setEditCopyValue] = useState('0.01')
  
  // Earnings withdrawal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  
  // Master detail modal states
  const [showMasterDetailModal, setShowMasterDetailModal] = useState(false)
  const [selectedMasterDetail, setSelectedMasterDetail] = useState(null)
  const [masterDetailStats, setMasterDetailStats] = useState(null)
  const [masterTrades, setMasterTrades] = useState([])
  const [masterRatings, setMasterRatings] = useState([])
  const [loadingMasterDetail, setLoadingMasterDetail] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [userReview, setUserReview] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  
  // Edit master profile states
  const [showEditMasterModal, setShowEditMasterModal] = useState(false)
  const [editMasterForm, setEditMasterForm] = useState({
    displayName: '',
    description: '',
    commissionPercentage: 10
  })
  const [savingMasterProfile, setSavingMasterProfile] = useState(false)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchChallengeStatus()
    fetchMasters()
    fetchMySubscriptions()
    fetchMyCopyTrades()
    fetchAccounts()
    fetchMyMasterProfile()
  }, [])

  // Fetch my followers when master profile is loaded
  useEffect(() => {
    if (myMasterProfile?._id) {
      fetchMyFollowers()
    }
  }, [myMasterProfile])

  const fetchMyFollowers = async () => {
    if (!myMasterProfile?._id) return
    try {
      const res = await fetch(`${API_URL}/copy/my-followers/${myMasterProfile._id}`)
      const data = await res.json()
      setMyFollowers(data.followers || [])
    } catch (error) {
      console.error('Error fetching my followers:', error)
    }
  }

  const fetchChallengeStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/prop/status`)
      const data = await res.json()
      if (data.success) setChallengeModeEnabled(data.enabled)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchMasters = async () => {
    try {
      const res = await fetch(`${API_URL}/copy/masters`)
      const data = await res.json()
      setMasters(data.masters || [])
    } catch (error) {
      console.error('Error fetching masters:', error)
    }
    setLoading(false)
  }

  const fetchMySubscriptions = async () => {
    try {
      const res = await fetch(`${API_URL}/copy/my-subscriptions/${user._id}`)
      const data = await res.json()
      setMySubscriptions(data.subscriptions || [])
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    }
  }

  const fetchMyCopyTrades = async () => {
    try {
      const res = await fetch(`${API_URL}/copy/my-copy-trades/${user._id}?limit=50`)
      const data = await res.json()
      setMyCopyTrades(data.copyTrades || [])
    } catch (error) {
      console.error('Error fetching copy trades:', error)
    }
  }

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/trading-accounts/user/${user._id}`)
      const data = await res.json()
      setAccounts(data.accounts || [])
      if (data.accounts?.length > 0) {
        setSelectedAccount(data.accounts[0]._id)
        setMasterForm(prev => ({ ...prev, tradingAccountId: data.accounts[0]._id }))
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchMyMasterProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/copy/master/my-profile/${user._id}`)
      const data = await res.json()
      if (data.master) {
        setMyMasterProfile(data.master)
      }
    } catch (error) {
      // User is not a master - that's okay
      console.log('No master profile found')
    }
  }

  // Fetch master detailed stats, trades, and ratings
  const fetchMasterDetails = async (masterId) => {
    setLoadingMasterDetail(true)
    try {
      const [statsRes, tradesRes, ratingsRes] = await Promise.all([
        fetch(`${API_URL}/copy/master/${masterId}/detailed-stats`),
        fetch(`${API_URL}/copy/master/${masterId}/trades?limit=20`),
        fetch(`${API_URL}/copy/master/${masterId}/ratings?limit=10`)
      ])
      
      const statsData = await statsRes.json()
      const tradesData = await tradesRes.json()
      const ratingsData = await ratingsRes.json()
      
      setMasterDetailStats(statsData)
      setMasterTrades(tradesData.trades || [])
      setMasterRatings(ratingsData.ratings || [])
      
      // Check if current user has already rated
      const existingRating = ratingsData.ratings?.find(r => r.userId?._id === user._id)
      if (existingRating) {
        setUserRating(existingRating.rating)
        setUserReview(existingRating.review || '')
      } else {
        setUserRating(0)
        setUserReview('')
      }
    } catch (error) {
      console.error('Error fetching master details:', error)
      toast.error('Failed to load master details')
    }
    setLoadingMasterDetail(false)
  }

  const handleViewMasterDetail = (master) => {
    setSelectedMasterDetail(master)
    setShowMasterDetailModal(true)
    fetchMasterDetails(master._id)
  }

  const handleSubmitRating = async () => {
    if (!selectedMasterDetail || userRating === 0) {
      toast.error('Please select a rating')
      return
    }
    
    setSubmittingRating(true)
    try {
      const res = await fetch(`${API_URL}/copy/master/${selectedMasterDetail._id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          rating: userRating,
          review: userReview
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Rating submitted!')
        fetchMasterDetails(selectedMasterDetail._id)
        fetchMasters() // Refresh masters list
      } else {
        toast.error(data.message || 'Failed to submit rating')
      }
    } catch (error) {
      toast.error('Error submitting rating')
    }
    setSubmittingRating(false)
  }

  // Open edit master modal with current values
  const openEditMasterModal = () => {
    if (myMasterProfile) {
      setEditMasterForm({
        displayName: myMasterProfile.displayName || '',
        description: myMasterProfile.description || '',
        commissionPercentage: myMasterProfile.approvedCommissionPercentage || myMasterProfile.requestedCommissionPercentage || 10
      })
      setShowEditMasterModal(true)
    }
  }

  // Save master profile changes
  const handleSaveMasterProfile = async () => {
    if (!editMasterForm.displayName.trim()) {
      toast.error('Display name is required')
      return
    }
    
    setSavingMasterProfile(true)
    try {
      const res = await fetch(`${API_URL}/copy/master/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterId: myMasterProfile._id,
          displayName: editMasterForm.displayName,
          description: editMasterForm.description,
          requestedCommissionPercentage: editMasterForm.commissionPercentage
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Profile updated successfully!')
        setShowEditMasterModal(false)
        fetchMyMasterProfile() // Refresh master profile
      } else {
        toast.error(data.message || 'Failed to update profile')
      }
    } catch (error) {
      toast.error('Error updating profile')
    }
    setSavingMasterProfile(false)
  }

  const handleApplyMaster = async () => {
    const accountId = masterForm.tradingAccountId || (accounts.length > 0 ? accounts[0]._id : '')
    
    if (!masterForm.displayName.trim()) {
      toast.error('Please enter a display name')
      return
    }
    if (!accountId) {
      toast.error('Please select a trading account')
      return
    }
    
    // Update form with selected account if not set
    const formData = {
      ...masterForm,
      tradingAccountId: accountId
    }

    setApplyingMaster(true)
    try {
      // If user has a suspended/rejected profile, delete it first before reapplying
      if (myMasterProfile && (myMasterProfile.status === 'SUSPENDED' || myMasterProfile.status === 'REJECTED')) {
        const deleteRes = await fetch(`${API_URL}/copy/master/reapply/${user._id}`, {
          method: 'DELETE'
        })
        if (!deleteRes.ok) {
          const deleteData = await deleteRes.json()
          toast.error(deleteData.message || 'Failed to process reapply')
          setApplyingMaster(false)
          return
        }
        setMyMasterProfile(null)
      }

      const res = await fetch(`${API_URL}/copy/master/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          ...formData
        })
      })

      const data = await res.json()
      if (data.master) {
        toast.success('Application submitted successfully! Please wait for admin approval.')
        setShowMasterModal(false)
        fetchMyMasterProfile()
      } else {
        toast.error(data.message || 'Failed to submit application')
      }
    } catch (error) {
      console.error('Error applying as master:', error)
      toast.error('Failed to submit application')
    }
    setApplyingMaster(false)
  }

  const handleWithdrawToWallet = async () => {
    if (!myMasterProfile || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return
    
    setWithdrawing(true)
    try {
      const res = await fetch(`${API_URL}/copy/master/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterId: myMasterProfile._id,
          amount: parseFloat(withdrawAmount)
        })
      })
      const data = await res.json()
      if (data.newWalletBalance !== undefined) {
        toast.success(`Successfully transferred $${parseFloat(withdrawAmount).toFixed(2)} to your wallet!`)
        setShowWithdrawModal(false)
        setWithdrawAmount('')
        fetchMyMasterProfile()
      } else {
        toast.error(data.message || 'Failed to withdraw')
      }
    } catch (error) {
      console.error('Error withdrawing:', error)
      toast.error('Failed to withdraw earnings')
    }
    setWithdrawing(false)
  }

  const handleReapply = () => {
    // Just open the form modal - the old record will be deleted when new application is submitted
    setShowMasterModal(true)
  }

  const handleFollow = async () => {
    if (!selectedMaster || !selectedAccount) return

    try {
      const res = await fetch(`${API_URL}/copy/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerUserId: user._id,
          masterId: selectedMaster._id,
          followerAccountId: selectedAccount,
          copyMode,
          copyValue: parseFloat(copyValue)
        })
      })

      const data = await res.json()
      if (data.follower) {
        toast.success('Successfully following master!')
        setShowFollowModal(false)
        fetchMySubscriptions()
      } else {
        toast.error(data.message || 'Failed to follow')
      }
    } catch (error) {
      console.error('Error following master:', error)
      toast.error('Failed to follow master')
    }
  }

  const handlePauseResume = async (subscriptionId, currentStatus) => {
    const action = currentStatus === 'ACTIVE' ? 'pause' : 'resume'
    try {
      const res = await fetch(`${API_URL}/copy/follow/${subscriptionId}/${action}`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (data.follower) {
        fetchMySubscriptions()
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
    }
  }

  const handleStop = async (subscriptionId) => {
    if (!confirm('Are you sure you want to stop following this master?')) return

    try {
      const res = await fetch(`${API_URL}/copy/follow/${subscriptionId}/stop`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (data.follower) {
        fetchMySubscriptions()
      }
    } catch (error) {
      console.error('Error stopping subscription:', error)
    }
  }

  const handleEditSubscription = (sub) => {
    setEditingSubscription(sub)
    setEditAccount(sub.followerAccountId?._id || sub.followerAccountId || '')
    setEditCopyMode(sub.copyMode || 'FIXED_LOT')
    setEditCopyValue(sub.copyValue?.toString() || '0.01')
    setShowEditModal(true)
  }

  const handleSaveSubscription = async () => {
    if (!editingSubscription) return

    try {
      const res = await fetch(`${API_URL}/copy/follow/${editingSubscription._id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerAccountId: editAccount,
          copyMode: editCopyMode,
          copyValue: parseFloat(editCopyValue)
        })
      })
      const data = await res.json()
      if (data.success || data.follower) {
        toast.success('Subscription updated successfully!')
        setShowEditModal(false)
        setEditingSubscription(null)
        fetchMySubscriptions()
      } else {
        toast.error(data.message || 'Failed to update subscription')
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast.error('Failed to update subscription')
    }
  }

  const handleUnfollow = async (subscriptionId) => {
    if (!confirm('Are you sure you want to unfollow this master? This will stop all future copy trades.')) return

    try {
      const res = await fetch(`${API_URL}/copy/follow/${subscriptionId}/unfollow`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Successfully unfollowed master')
        fetchMySubscriptions()
      } else {
        toast.error(data.message || 'Failed to unfollow')
      }
    } catch (error) {
      console.error('Error unfollowing:', error)
      toast.error('Failed to unfollow master')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/user/login')
  }

  const filteredMasters = masters.filter(m => 
    m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    // Exclude user's own master account to prevent self-following (causes duplicate trades)
    m._id !== myMasterProfile?._id
  )

  return (
    <div className={`flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-dark-900' : 'bg-gray-100'}`}>
      {/* Mobile Header */}
      {isMobile && (
        <header className={`fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center gap-4 ${isDarkMode ? 'bg-dark-800 border-b border-gray-800' : 'bg-white border-b border-gray-200'}`}>
          <button onClick={() => navigate('/mobile')} className={`p-2 -ml-2 rounded-lg ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft size={22} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
          </button>
          <h1 className={`font-semibold text-lg flex-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Copy Trading</h1>
          <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${isDarkMode ? 'text-yellow-400 hover:bg-dark-700' : 'text-blue-500 hover:bg-gray-100'}`}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => navigate('/mobile')} className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}>
            <Home size={20} className="text-gray-400" />
          </button>
        </header>
      )}

      {/* Full Width Header - Desktop Only */}
      {!isMobile && (
        <div className="w-full shrink-0 relative border-b bg-gradient-to-r from-dark-800 via-dark-900 to-dark-800 border-gray-800">
          <div className="flex items-center justify-between px-6 py-3">
            <img src={logoImage} alt="BlueStone" className="h-8 w-auto object-contain" />
            <UserHeader />
          </div>
        </div>
      )}

      {/* Main Layout - Sidebar + Content */}
      <div className={`flex-1 flex min-h-0 overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
        {/* Sidebar - Hidden on Mobile */}
        {!isMobile && (
          <aside 
            className={`${sidebarExpanded ? 'w-48' : 'w-16'} ${isDarkMode ? 'bg-dark-900 border-gray-800' : 'bg-white border-gray-200'} border-r flex flex-col shrink-0 min-h-0 overflow-hidden transition-all duration-300`}
            onMouseEnter={() => setSidebarExpanded(true)}
            onMouseLeave={() => setSidebarExpanded(false)}
          >
            <nav className="hide-scrollbar flex-1 min-h-0 overflow-y-auto px-2 pt-4">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                    item.name === 'Copytrade' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {sidebarExpanded && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              ))}
            </nav>
            <div className={`p-2 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                <LogOut size={18} />
                {sidebarExpanded && <span className="text-sm">{t('nav.logout')}</span>}
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`hide-scrollbar flex-1 min-h-0 overflow-y-auto ${isMobile ? 'pt-14' : ''}`}>
          <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
          {/* Become a Master Banner */}
          {!myMasterProfile && (
            <div className={`bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl ${isMobile ? 'p-4' : 'p-5'} border border-blue-500/30 mb-4`}>
              <div className={`${isMobile ? 'flex flex-col gap-3' : 'flex items-center justify-between'}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-blue-500/20 rounded-full flex items-center justify-center`}>
                    <Crown size={isMobile ? 20 : 24} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className={`text-white font-semibold ${isMobile ? 'text-sm' : ''}`}>{t('copytrade.becomeMaster')}</h3>
                    <p className="text-gray-400 text-xs">{t('copytrade.becomeMasterDesc')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMasterModal(true)}
                  className={`bg-gradient-to-r from-blue-500 to-cyan-500 text-white ${isMobile ? 'px-4 py-2 text-sm w-full' : 'px-6 py-2'} rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2`}
                >
                  <Crown size={16} />
                  {t('copytrade.applyNow')}
                </button>
              </div>
            </div>
          )}

          {/* Master Status Banner */}
          {myMasterProfile && (
            <div className={`rounded-xl ${isMobile ? 'p-4' : 'p-5'} border mb-4 ${
              myMasterProfile.status === 'ACTIVE' ? 'bg-green-500/10 border-green-500/30' :
              myMasterProfile.status === 'PENDING' ? 'bg-yellow-500/10 border-yellow-500/30' :
              myMasterProfile.status === 'REJECTED' ? 'bg-red-500/10 border-red-500/30' :
              myMasterProfile.status === 'SUSPENDED' ? 'bg-orange-500/10 border-orange-500/30' :
              'bg-gray-500/10 border-gray-500/30'
            }`}>
              <div className={`${isMobile ? 'flex flex-col gap-3' : 'flex items-center justify-between'}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center ${
                    myMasterProfile.status === 'ACTIVE' ? 'bg-green-500/20' :
                    myMasterProfile.status === 'PENDING' ? 'bg-yellow-500/20' :
                    myMasterProfile.status === 'SUSPENDED' ? 'bg-orange-500/20' : 'bg-red-500/20'
                  }`}>
                    <Crown size={isMobile ? 20 : 24} className={
                      myMasterProfile.status === 'ACTIVE' ? 'text-green-500' :
                      myMasterProfile.status === 'PENDING' ? 'text-yellow-500' :
                      myMasterProfile.status === 'SUSPENDED' ? 'text-orange-500' : 'text-red-500'
                    } />
                  </div>
                  <div>
                    <h3 className={`text-white font-semibold ${isMobile ? 'text-sm' : ''}`}>{myMasterProfile.displayName}</h3>
                    <p className="text-gray-400 text-xs">
                      <span className={
                        myMasterProfile.status === 'ACTIVE' ? 'text-green-500' :
                        myMasterProfile.status === 'PENDING' ? 'text-yellow-500' :
                        myMasterProfile.status === 'SUSPENDED' ? 'text-orange-500' : 'text-red-500'
                      }>{myMasterProfile.status}</span>
                      {myMasterProfile.status === 'ACTIVE' && ` • ${myMasterProfile.stats?.activeFollowers || 0} followers`}
                    </p>
                  </div>
                </div>
                {myMasterProfile.status === 'ACTIVE' && (
                  <div className={`flex items-center gap-3 ${isMobile ? '' : 'text-right'}`}>
                    <p className="text-gray-400 text-xs">Commission: <span className="text-white font-semibold">{myMasterProfile.approvedCommissionPercentage}%</span></p>
                  </div>
                )}
                {(myMasterProfile.status === 'SUSPENDED' || myMasterProfile.status === 'REJECTED') && (
                  <button
                    onClick={handleReapply}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    Reapply
                  </button>
                )}
              </div>
              
              {/* Earnings Report Section */}
              {myMasterProfile.status === 'ACTIVE' && (
                <div className={`mt-4 pt-4 border-t border-green-500/20 ${isMobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-4 gap-4'}`}>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Available Balance</p>
                    <p className="text-green-400 font-bold text-lg">${(myMasterProfile.pendingCommission || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Total Earned</p>
                    <p className="text-white font-bold text-lg">${(myMasterProfile.totalCommissionEarned || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Withdrawn</p>
                    <p className="text-purple-400 font-bold text-lg">${(myMasterProfile.totalCommissionWithdrawn || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3 flex items-center justify-center">
                    <button
                      onClick={() => setShowWithdrawModal(true)}
                      disabled={!myMasterProfile.pendingCommission || myMasterProfile.pendingCommission <= 0}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        myMasterProfile.pendingCommission > 0 
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:bg-accent-green/90' 
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Wallet size={16} />
                      Withdraw to Wallet
                    </button>
                  </div>
                </div>
              )}
              
              {myMasterProfile.status === 'REJECTED' && myMasterProfile.rejectionReason && (
                <p className="text-red-400 text-xs mt-2">Reason: {myMasterProfile.rejectionReason}</p>
              )}
              {myMasterProfile.status === 'SUSPENDED' && (
                <p className="text-orange-400 text-xs mt-2">Your master trader account has been suspended by admin. Click Reapply to submit a new application.</p>
              )}
            </div>
          )}

          {/* Tabs - Scrollable on mobile */}
          <div className={`flex ${isMobile ? 'gap-2 overflow-x-auto pb-2' : 'gap-4'} mb-4`}>
            {['discover', 'subscriptions', 'trades', ...(myMasterProfile?.status === 'ACTIVE' ? ['my-followers'] : [])].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${isMobile ? 'px-3 py-1.5 text-xs whitespace-nowrap' : 'px-4 py-2'} rounded-lg font-medium transition-colors ${
                  activeTab === tab ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : isDarkMode ? 'bg-dark-800 text-gray-400 hover:text-white' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                }`}
              >
                {tab === 'discover' ? t('copytrade.discover') : 
                 tab === 'subscriptions' ? t('copytrade.subscriptions') : 
                 tab === 'trades' ? t('copytrade.trades') : t('copytrade.followers')}
              </button>
            ))}
          </div>

          {/* Discover Masters */}
          {activeTab === 'discover' && (
            <div>
              <div className={`flex ${isMobile ? 'gap-2' : 'gap-4'} mb-4`}>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="text"
                    placeholder={t('copytrade.searchMasters')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full rounded-lg pl-9 pr-3 ${isMobile ? 'py-2 text-sm' : 'py-2'} ${isDarkMode ? 'bg-dark-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border`}
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading masters...</div>
              ) : filteredMasters.length === 0 ? (
                <div className="text-center py-12">
                  <Copy size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-500">{t('copytrade.noMasters')}</p>
                  <p className="text-gray-600 text-sm mt-2">{t('copytrade.noMastersDesc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMasters.map(master => {
                    const isFollowing = mySubscriptions.some(sub => sub.masterId?._id === master._id || sub.masterId === master._id)
                    return (
                      <div key={master._id} className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-5 border hover:border-blue-500/50 transition-all cursor-pointer`} onClick={() => handleViewMasterDetail(master)}>
                        {/* Header with Profile Photo, Name, Rating */}
                        <div className="flex items-center gap-3 mb-3">
                          {master.profileImage ? (
                            <img src={master.profileImage} alt={master.displayName} className="w-14 h-14 rounded-full object-cover border-2 border-blue-500/30" />
                          ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-xl">{master.displayName?.charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{master.displayName}</h3>
                              {isFollowing && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-full font-medium">
                                  Following
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center">
                                {[1,2,3,4,5].map(star => (
                                  <Star key={star} size={12} className={star <= Math.round(master.rating?.average || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-500'} />
                                ))}
                              </div>
                              <span className="text-gray-500 text-xs">({master.rating?.totalRatings || 0})</span>
                            </div>
                          </div>
                        </div>

                        {/* Description/Bio */}
                        {master.description && (
                          <p className="text-gray-500 text-xs mb-3 line-clamp-2">{master.description}</p>
                        )}

                        {/* Stats Grid - Row 1 */}
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Win Rate</p>
                            <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{master.stats?.winRate?.toFixed(0) || 0}%</p>
                          </div>
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Trades</p>
                            <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{master.stats?.totalTrades || 0}</p>
                          </div>
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Followers</p>
                            <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{master.stats?.activeFollowers || 0}</p>
                          </div>
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Copiers</p>
                            <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{master.stats?.currentCopiers || 0}</p>
                          </div>
                        </div>

                        {/* Stats Grid - Row 2 */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Profit</p>
                            <p className="text-green-500 font-semibold text-sm">+${(master.stats?.totalProfitGenerated || 0).toFixed(0)}</p>
                          </div>
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Performance</p>
                            <p className={`font-semibold text-sm ${(master.stats?.overallPerformance || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {(master.stats?.overallPerformance || 0) >= 0 ? '+' : ''}{(master.stats?.overallPerformance || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-2 text-center`}>
                            <p className="text-gray-500 text-[10px]">Commission</p>
                            <p className="text-purple-400 font-semibold text-sm">{master.approvedCommissionPercentage || 0}%</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewMasterDetail(master) }}
                            className={`flex-1 py-2 rounded-lg font-medium text-sm ${isDarkMode ? 'bg-dark-700 text-gray-300 hover:bg-dark-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            View Details
                          </button>
                          {isFollowing ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab('subscriptions') }}
                              className="flex-1 bg-green-500/20 text-green-500 py-2 rounded-lg font-medium text-sm border border-green-500/50"
                            >
                              ✓ Following
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedMaster(master); setShowFollowModal(true) }}
                              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 rounded-lg font-medium text-sm"
                            >
                              Follow
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* My Subscriptions */}
          {activeTab === 'subscriptions' && (
            <div>
              {mySubscriptions.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-500">{t('copytrade.noSubscriptions')}</p>
                  <button onClick={() => setActiveTab('discover')} className="mt-4 text-accent-green hover:underline">
                    {t('copytrade.discoverMasters')} →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {mySubscriptions.map(sub => (
                    <div key={sub._id} className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-5 border`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-accent-green/20 rounded-full flex items-center justify-center">
                            <span className="text-accent-green font-bold">{sub.masterId?.displayName?.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{sub.masterId?.displayName}</h3>
                            <p className="text-gray-500 text-sm">
                              {sub.copyMode === 'FIXED_LOT' && `Fixed: ${sub.copyValue} lots`}
                              {sub.copyMode === 'BALANCE_BASED' && 'Balance Based'}
                              {sub.copyMode === 'EQUITY_BASED' && 'Equity Based'}
                              {sub.copyMode === 'MULTIPLIER' && `Multiplier: ${sub.copyValue}x`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            sub.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : 
                            sub.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                          }`}>
                            {sub.status}
                          </span>
                          <button
                            onClick={() => handleEditSubscription(sub)}
                            className="p-2 bg-dark-700 rounded-lg hover:bg-blue-500/20"
                            title="Edit Settings"
                          >
                            <Star size={16} className="text-blue-500" />
                          </button>
                          <button
                            onClick={() => handlePauseResume(sub._id, sub.status)}
                            className="p-2 bg-dark-700 rounded-lg hover:bg-dark-600"
                            title={sub.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                          >
                            {sub.status === 'ACTIVE' ? <Pause size={16} className="text-yellow-500" /> : <Play size={16} className="text-green-500" />}
                          </button>
                          <button
                            onClick={() => handleUnfollow(sub._id)}
                            className="p-2 bg-dark-700 rounded-lg hover:bg-red-500/20"
                            title="Unfollow"
                          >
                            <X size={16} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className={`grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div>
                          <p className="text-gray-500 text-xs">Total Trades</p>
                          <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{sub.stats?.totalCopiedTrades || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Open / Closed</p>
                          <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            <span className="text-blue-400">{sub.stats?.openTrades || 0}</span>
                            {' / '}
                            <span className="text-gray-400">{sub.stats?.closedTrades || 0}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Total Profit</p>
                          <p className="text-green-500 font-semibold">+${(sub.stats?.totalProfit || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Total Loss</p>
                          <p className="text-red-500 font-semibold">-${(sub.stats?.totalLoss || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Net P&L</p>
                          <p className={`font-semibold ${(sub.stats?.netPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {(sub.stats?.netPnl || 0) >= 0 ? '+' : ''}${(sub.stats?.netPnl || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Copy Trades History */}
          {activeTab === 'trades' && (
            <div>
              {myCopyTrades.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-500">No copy trades yet</p>
                </div>
              ) : (
                <div className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl border overflow-hidden`}>
                  <table className="w-full">
                    <thead className={isDarkMode ? 'bg-dark-700' : 'bg-gray-50'}>
                      <tr>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Master</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Symbol</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Side</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Lots</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Open Price</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Close Price</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>P/L</th>
                        <th className={`text-left text-xs font-medium px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myCopyTrades.map(trade => (
                        <tr key={trade._id} className={`border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                          <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{trade.masterId?.displayName || '-'}</td>
                          <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{trade.symbol}</td>
                          <td className={`px-4 py-3 text-sm ${trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>{trade.side}</td>
                          <td className="px-4 py-3 text-white text-sm">{trade.followerLotSize}</td>
                          <td className="px-4 py-3 text-white text-sm">{trade.followerOpenPrice?.toFixed(5)}</td>
                          <td className="px-4 py-3 text-white text-sm">{trade.followerClosePrice?.toFixed(5) || '-'}</td>
                          <td className={`px-4 py-3 text-sm font-medium ${trade.followerPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${trade.followerPnl?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              trade.status === 'OPEN' ? 'bg-blue-500/20 text-blue-500' :
                              trade.status === 'CLOSED' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                            }`}>
                              {trade.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* My Followers (for Master Traders) */}
          {activeTab === 'my-followers' && myMasterProfile?.status === 'ACTIVE' && (
            <div>
              {myFollowers.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-500">No followers yet</p>
                  <p className="text-gray-600 text-sm mt-2">Share your profile to attract followers</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myFollowers.map(follower => (
                    <div key={follower._id} className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-5 border`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-500 font-bold">{follower.followerId?.firstName?.charAt(0) || 'U'}</span>
                          </div>
                          <div>
                            <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{follower.followerId?.firstName} {follower.followerId?.lastName}</h3>
                            <p className="text-gray-500 text-sm">{follower.followerId?.email}</p>
                            <p className="text-gray-600 text-xs mt-1">
                              {follower.copyMode === 'FIXED_LOT' && `Fixed: ${follower.copyValue} lots`}
                              {follower.copyMode === 'BALANCE_BASED' && 'Balance Based'}
                              {follower.copyMode === 'EQUITY_BASED' && 'Equity Based'}
                              {follower.copyMode === 'MULTIPLIER' && `Multiplier: ${follower.copyValue}x`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            follower.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : 
                            follower.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                          }`}>
                            {follower.status}
                          </span>
                          <p className="text-gray-500 text-xs mt-2">Account: {follower.followerAccountId?.accountId}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                        <div>
                          <p className="text-gray-500 text-xs">Copied Trades</p>
                          <p className="text-white font-semibold">{follower.stats?.totalCopiedTrades || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Their Profit</p>
                          <p className="text-accent-green font-semibold">${follower.stats?.totalProfit?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Their Loss</p>
                          <p className="text-red-500 font-semibold">${follower.stats?.totalLoss?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Commission Earned</p>
                          <p className="text-purple-400 font-semibold">${follower.stats?.totalCommissionPaid?.toFixed(2) || '0.00'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Follow Modal */}
      {showFollowModal && selectedMaster && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">Follow {selectedMaster.displayName}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Trading Account</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>{acc.accountId} - ${acc.balance?.toFixed(2)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Copy Mode</label>
                <select
                  value={copyMode}
                  onChange={(e) => {
                    setCopyMode(e.target.value)
                    // Set appropriate default value based on mode
                    if (e.target.value === 'FIXED_LOT') setCopyValue('0.01')
                    else if (e.target.value === 'MULTIPLIER') setCopyValue('1')
                    else setCopyValue('10') // Max lot size for balance/equity based
                  }}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="FIXED_LOT">Fixed Lot Size</option>
                  <option value="BALANCE_BASED">Balance Based (Proportional)</option>
                  <option value="EQUITY_BASED">Equity Based (Proportional)</option>
                  <option value="MULTIPLIER">Multiplier</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  {copyMode === 'FIXED_LOT' && 'Use a fixed lot size for every copied trade'}
                  {copyMode === 'BALANCE_BASED' && 'Lot = Master Lot × (Your Balance / Master Balance)'}
                  {copyMode === 'EQUITY_BASED' && 'Lot = Master Lot × (Your Equity / Master Equity)'}
                  {copyMode === 'MULTIPLIER' && 'Lot = Master Lot × Your Multiplier'}
                </p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">
                  {copyMode === 'FIXED_LOT' ? 'Lot Size' : 
                   copyMode === 'MULTIPLIER' ? 'Multiplier Value' : 'Max Lot Size'}
                </label>
                <input
                  type="number"
                  value={copyValue}
                  onChange={(e) => setCopyValue(e.target.value)}
                  min={copyMode === 'MULTIPLIER' ? '0.1' : '0.01'}
                  step={copyMode === 'MULTIPLIER' ? '0.1' : '0.01'}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
                <p className="text-gray-500 text-xs mt-1">
                  {copyMode === 'FIXED_LOT' && 'Each copied trade will use this fixed lot size'}
                  {copyMode === 'BALANCE_BASED' && 'Maximum lot size limit (e.g., Master $1000 trades 1 lot, you have $500 → you get 0.5 lot)'}
                  {copyMode === 'EQUITY_BASED' && 'Maximum lot size limit (e.g., Master $1000 equity trades 1 lot, you have $1500 → you get 1.5 lot)'}
                  {copyMode === 'MULTIPLIER' && 'Multiply master lot by this value (e.g., 2 = double the lot size)'}
                </p>
              </div>

              <div className="bg-dark-700 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Commission: <span className="text-white">{selectedMaster.approvedCommissionPercentage}%</span> of daily profit</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowFollowModal(false)}
                className="flex-1 bg-dark-700 text-white py-2 rounded-lg hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={handleFollow}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 rounded-lg font-medium hover:bg-accent-green/90"
              >
                Start Following
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Application Modal */}
      {showMasterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowMasterModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Crown size={20} className="text-yellow-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{t('copytrade.becomeMaster')}</h2>
                <p className="text-gray-500 text-sm">{t('copytrade.becomeMasterDesc')}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Display Name *</label>
                <input
                  type="text"
                  value={masterForm.displayName}
                  onChange={(e) => setMasterForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Your trading name"
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Description</label>
                <textarea
                  value={masterForm.description}
                  onChange={(e) => setMasterForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell followers about your trading strategy..."
                  rows={3}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Trading Account *</label>
                <select
                  value={masterForm.tradingAccountId || (accounts.length > 0 ? accounts[0]._id : '')}
                  onChange={(e) => setMasterForm(prev => ({ ...prev, tradingAccountId: e.target.value }))}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  {accounts.length === 0 && <option value="">No accounts available</option>}
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>{acc.accountId} - ${acc.balance?.toFixed(2)}</option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Trades from this account will be copied to followers</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Requested Commission (%)</label>
                <input
                  type="number"
                  value={masterForm.requestedCommissionPercentage}
                  onChange={(e) => setMasterForm(prev => ({ ...prev, requestedCommissionPercentage: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  max="50"
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
                <p className="text-gray-500 text-xs mt-1">Commission you'll earn from followers' daily profits (0-50%)</p>
              </div>

              <div className="bg-dark-700 rounded-lg p-4 space-y-2">
                <p className="text-white text-sm font-medium">Requirements:</p>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Minimum account balance may be required</li>
                  <li>• Trading history will be reviewed</li>
                  <li>• Admin approval is required</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMasterModal(false)}
                className="flex-1 bg-dark-700 text-white py-2 rounded-lg hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyMaster}
                disabled={applyingMaster}
                className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50"
              >
                {applyingMaster ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {showEditModal && editingSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Edit Subscription</h2>
            <p className="text-gray-400 text-sm mb-4">Following: {editingSubscription.masterId?.displayName}</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Trading Account</label>
                <select
                  value={editAccount}
                  onChange={(e) => setEditAccount(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>{acc.accountId} - ${acc.balance?.toFixed(2)}</option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Change the account where trades will be copied</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Copy Mode</label>
                <select
                  value={editCopyMode}
                  onChange={(e) => {
                    setEditCopyMode(e.target.value)
                    if (e.target.value === 'FIXED_LOT') setEditCopyValue('0.01')
                    else if (e.target.value === 'MULTIPLIER') setEditCopyValue('1')
                    else setEditCopyValue('10')
                  }}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="FIXED_LOT">Fixed Lot Size</option>
                  <option value="BALANCE_BASED">Balance Based (Proportional)</option>
                  <option value="EQUITY_BASED">Equity Based (Proportional)</option>
                  <option value="MULTIPLIER">Multiplier</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  {editCopyMode === 'FIXED_LOT' && 'Use a fixed lot size for every copied trade'}
                  {editCopyMode === 'BALANCE_BASED' && 'Lot = Master Lot × (Your Balance / Master Balance)'}
                  {editCopyMode === 'EQUITY_BASED' && 'Lot = Master Lot × (Your Equity / Master Equity)'}
                  {editCopyMode === 'MULTIPLIER' && 'Lot = Master Lot × Your Multiplier'}
                </p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">
                  {editCopyMode === 'FIXED_LOT' ? 'Lot Size' : 
                   editCopyMode === 'MULTIPLIER' ? 'Multiplier Value' : 'Max Lot Size'}
                </label>
                <input
                  type="number"
                  value={editCopyValue}
                  onChange={(e) => setEditCopyValue(e.target.value)}
                  min={editCopyMode === 'MULTIPLIER' ? '0.1' : '0.01'}
                  step={editCopyMode === 'MULTIPLIER' ? '0.1' : '0.01'}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
                <p className="text-gray-500 text-xs mt-1">
                  {editCopyMode === 'FIXED_LOT' && 'Each copied trade will use this fixed lot size'}
                  {editCopyMode === 'BALANCE_BASED' && 'Maximum lot size limit for proportional calculation'}
                  {editCopyMode === 'EQUITY_BASED' && 'Maximum lot size limit for proportional calculation'}
                  {editCopyMode === 'MULTIPLIER' && 'Multiply master lot by this value'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowEditModal(false); setEditingSubscription(null); }}
                className="flex-1 bg-dark-700 text-white py-2 rounded-lg hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubscription}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Detail Modal */}
      {showMasterDetailModal && selectedMasterDetail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${isDarkMode ? 'bg-dark-800' : 'bg-white'} rounded-2xl w-full max-w-3xl border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} max-h-[90vh] overflow-y-auto`}>
            {/* Header */}
            <div className={`sticky top-0 ${isDarkMode ? 'bg-dark-800' : 'bg-white'} p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} z-10`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedMasterDetail.profileImage ? (
                    <img src={selectedMasterDetail.profileImage} alt={selectedMasterDetail.displayName} className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">{selectedMasterDetail.displayName?.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedMasterDetail.displayName}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center">
                        {[1,2,3,4,5].map(star => (
                          <Star key={star} size={16} className={star <= Math.round(masterDetailStats?.rating?.average || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-500'} />
                        ))}
                      </div>
                      <span className="text-gray-500 text-sm">{masterDetailStats?.rating?.average || 0} ({masterDetailStats?.rating?.totalRatings || 0} ratings)</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowMasterDetailModal(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              {selectedMasterDetail.description && (
                <p className="text-gray-500 text-sm mt-3">{selectedMasterDetail.description}</p>
              )}
            </div>

            {loadingMasterDetail ? (
              <div className="p-12 text-center text-gray-500">Loading details...</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Stats Overview */}
                <div>
                  <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Performance Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Win Rate</p>
                      <p className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{masterDetailStats?.stats?.winRate || 0}%</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Total Trades</p>
                      <p className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{masterDetailStats?.stats?.totalTrades || 0}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Profitable</p>
                      <p className="font-bold text-lg text-green-500">{masterDetailStats?.stats?.profitableTrades || 0}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Losing</p>
                      <p className="font-bold text-lg text-red-500">{masterDetailStats?.stats?.losingTrades || 0}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Max Profit</p>
                      <p className="font-bold text-lg text-green-500">+${masterDetailStats?.stats?.maxProfit || '0.00'}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Max Loss</p>
                      <p className="font-bold text-lg text-red-500">-${masterDetailStats?.stats?.maxLoss || '0.00'}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Net Profit</p>
                      <p className={`font-bold text-lg ${parseFloat(masterDetailStats?.stats?.netProfit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ${masterDetailStats?.stats?.netProfit || '0.00'}
                      </p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Performance</p>
                      <p className={`font-bold text-lg ${parseFloat(masterDetailStats?.stats?.overallPerformance || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {parseFloat(masterDetailStats?.stats?.overallPerformance || 0) >= 0 ? '+' : ''}{masterDetailStats?.stats?.overallPerformance || 0}%
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Followers</p>
                      <p className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{masterDetailStats?.stats?.totalFollowers || 0}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Active Copiers</p>
                      <p className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{masterDetailStats?.stats?.currentCopiers || 0}</p>
                    </div>
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-gray-500 text-xs">Commission</p>
                      <p className="font-bold text-lg text-purple-400">{selectedMasterDetail.approvedCommissionPercentage || 0}%</p>
                    </div>
                  </div>
                </div>

                {/* Trade History */}
                <div>
                  <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Trade History</h3>
                  {masterTrades.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No trades yet</p>
                  ) : (
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg overflow-hidden`}>
                      <table className="w-full text-sm">
                        <thead className={isDarkMode ? 'bg-dark-600' : 'bg-gray-100'}>
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">Symbol</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">Side</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium">Lots</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium">P/L</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterTrades.slice(0, 10).map((trade, idx) => (
                            <tr key={trade._id || idx} className={`border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                              <td className={`px-3 py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{trade.symbol}</td>
                              <td className={`px-3 py-2 ${trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>{trade.side}</td>
                              <td className={`px-3 py-2 text-right ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{trade.quantity}</td>
                              <td className={`px-3 py-2 text-right font-medium ${(trade.realizedPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {(trade.realizedPnl || 0) >= 0 ? '+' : ''}${(trade.realizedPnl || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  trade.status === 'OPEN' ? 'bg-blue-500/20 text-blue-500' :
                                  trade.status === 'CLOSED' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                                }`}>
                                  {trade.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Rating Section */}
                <div>
                  <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rate This Master</h3>
                  {mySubscriptions.some(sub => sub.masterId?._id === selectedMasterDetail._id || sub.masterId === selectedMasterDetail._id) ? (
                    <div className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-gray-500 text-sm">Your Rating:</span>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <button
                              key={star}
                              onClick={() => setUserRating(star)}
                              className="focus:outline-none"
                            >
                              <Star size={24} className={star <= userRating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-500 hover:text-yellow-400'} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={userReview}
                        onChange={(e) => setUserReview(e.target.value)}
                        placeholder="Write a review (optional)"
                        className={`w-full ${isDarkMode ? 'bg-dark-600 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 text-sm`}
                        rows={2}
                      />
                      <button
                        onClick={handleSubmitRating}
                        disabled={submittingRating || userRating === 0}
                        className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium ${
                          submittingRating || userRating === 0
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {submittingRating ? 'Submitting...' : 'Submit Rating'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Follow this master to rate them</p>
                  )}

                  {/* Existing Ratings */}
                  {masterRatings.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <h4 className="text-gray-500 text-sm">Recent Reviews</h4>
                      {masterRatings.slice(0, 5).map((rating, idx) => (
                        <div key={rating._id || idx} className={`${isDarkMode ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-3`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {rating.userId?.firstName || 'User'}
                            </span>
                            <div className="flex items-center">
                              {[1,2,3,4,5].map(star => (
                                <Star key={star} size={12} className={star <= rating.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-500'} />
                              ))}
                            </div>
                          </div>
                          {rating.review && <p className="text-gray-500 text-xs">{rating.review}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowMasterDetailModal(false)}
                    className={`flex-1 py-3 rounded-lg font-medium ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Close
                  </button>
                  {!mySubscriptions.some(sub => sub.masterId?._id === selectedMasterDetail._id || sub.masterId === selectedMasterDetail._id) && (
                    <button
                      onClick={() => { setShowMasterDetailModal(false); setSelectedMaster(selectedMasterDetail); setShowFollowModal(true) }}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-medium"
                    >
                      Follow This Master
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdraw to Wallet Modal */}
      {showWithdrawModal && myMasterProfile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Withdraw to Wallet</h2>
              <button onClick={() => setShowWithdrawModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-dark-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Available Balance</p>
                <p className="text-green-400 font-bold text-2xl">${(myMasterProfile.pendingCommission || 0).toFixed(2)}</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Amount to Withdraw</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    max={myMasterProfile.pendingCommission || 0}
                    step="0.01"
                    className="w-full bg-dark-700 border border-gray-600 rounded-lg pl-8 pr-3 py-3 text-white text-lg"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <button
                    onClick={() => setWithdrawAmount((myMasterProfile.pendingCommission || 0).toFixed(2))}
                    className="text-accent-green text-xs hover:underline"
                  >
                    Withdraw Max
                  </button>
                  <p className="text-gray-500 text-xs">Min: $1.00</p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  <DollarSign size={14} className="inline mr-1" />
                  Funds will be transferred to your main wallet instantly.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawToWallet}
                disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > (myMasterProfile.pendingCommission || 0)}
                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > (myMasterProfile.pendingCommission || 0)
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:bg-accent-green/90'
                }`}
              >
                {withdrawing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Wallet size={18} />
                    Withdraw
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Master Profile Modal */}
      {showEditMasterModal && myMasterProfile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-dark-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Edit Master Settings</h2>
              <button onClick={() => setShowEditMasterModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-sm mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Display Name</label>
                <input
                  type="text"
                  value={editMasterForm.displayName}
                  onChange={(e) => setEditMasterForm(prev => ({ ...prev, displayName: e.target.value }))}
                  className={`w-full ${isDarkMode ? 'bg-dark-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2`}
                  placeholder="Your trading name"
                />
              </div>

              <div>
                <label className={`text-sm mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Strategy Description</label>
                <textarea
                  value={editMasterForm.description}
                  onChange={(e) => setEditMasterForm(prev => ({ ...prev, description: e.target.value }))}
                  className={`w-full ${isDarkMode ? 'bg-dark-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2`}
                  rows={3}
                  placeholder="Describe your trading strategy..."
                />
              </div>

              <div>
                <label className={`text-sm mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Commission Percentage</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editMasterForm.commissionPercentage}
                    onChange={(e) => setEditMasterForm(prev => ({ ...prev, commissionPercentage: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="50"
                    step="1"
                    className={`w-full ${isDarkMode ? 'bg-dark-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 pr-10`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>%</span>
                </div>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  This is the percentage of profit you earn from followers. Range: 0-50%
                </p>
              </div>

              <div className={`${isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
                <p className={`text-sm ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  <DollarSign size={14} className="inline mr-1" />
                  Current commission: <strong>{myMasterProfile.approvedCommissionPercentage}%</strong>
                  {editMasterForm.commissionPercentage !== myMasterProfile.approvedCommissionPercentage && (
                    <span className="ml-2">→ New: <strong>{editMasterForm.commissionPercentage}%</strong></span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditMasterModal(false)}
                className={`flex-1 py-3 rounded-lg ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMasterProfile}
                disabled={savingMasterProfile}
                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  savingMasterProfile
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                }`}
              >
                {savingMasterProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CopyTradePage
