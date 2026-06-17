import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  Plus,
  Minus,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  X,
  Check,
  TrendingUp,
  ArrowRight,
  MoreHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  Trophy,
  ArrowLeft,
  Home,
  Sun,
  Moon,
  Globe,
  Settings
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { API_URL, API_BASE_URL } from '../config/api'
import logoImage from '../assets/logo.png'
import LanguageDropdown from '../components/LanguageDropdown'
import UserHeader from '../components/UserHeader'
import BannerSlider from '../components/BannerSlider'
import { useLockDocumentScroll } from '../hooks/useLockDocumentScroll'

const Account = () => {
  useLockDocumentScroll()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { t } = useTranslation()
  const [showFailModal, setShowFailModal] = useState(false)
  const [failReason, setFailReason] = useState('')
  const [activeMenu, setActiveMenu] = useState('Account')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('real')
  const [accountTypes, setAccountTypes] = useState([])
  const [userAccounts, setUserAccounts] = useState([])
  const [challengeAccounts, setChallengeAccounts] = useState([])
  const [challengeModeEnabled, setChallengeModeEnabled] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showAccountTransferModal, setShowAccountTransferModal] = useState(false)
  const [targetAccount, setTargetAccount] = useState(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [selectedChallengeAccount, setSelectedChallengeAccount] = useState(null)
  const [showAccountMenu, setShowAccountMenu] = useState(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(null)
  // Close the account "..." dropdown on outside click or Escape.
  useEffect(() => {
    if (!showAccountMenu) return
    const handlePointer = (e) => {
      if (!e.target.closest('[data-account-menu]')) setShowAccountMenu(null)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setShowAccountMenu(null)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showAccountMenu])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showAccountInfoModal, setShowAccountInfoModal] = useState(null)
  const [pinSecurityEnabled, setPinSecurityEnabled] = useState(() => {
    const saved = localStorage.getItem('pinSecurityEnabled')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [selectedType, setSelectedType] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [pin, setPin] = useState(['', '', '', ''])
  const [newPin, setNewPin] = useState(['', '', '', ''])
  const [currentPin, setCurrentPin] = useState(['', '', '', ''])
  const [transferAmount, setTransferAmount] = useState('')
  const [transferPin, setTransferPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [createAccountTab, setCreateAccountTab] = useState('live')
  // KYC gate state. We only allow opening the trading terminal when KYC is
  // approved (regulatory + risk requirement). null = not yet fetched, the
  // gate stays open optimistically until we have a definitive answer so we
  // don't block users who already passed KYC due to a slow API.
  const [kycStatus, setKycStatus] = useState(null)
  const [showKycGate, setShowKycGate] = useState(false)
  // Demo accounts skip KYC (consistent with broker-wide practice — demos are
  // funded with paper money so there's no compliance exposure). We track the
  // pending click so the user doesn't have to re-press Trade after KYC.
  const [pendingTradeAccount, setPendingTradeAccount] = useState(null)
  // Popup shown when the user tries to trade on a still-locked Algo account.
  const [algoLockPopup, setAlgoLockPopup] = useState(null) // { daysRemaining }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch KYC status once on mount. Same endpoint shape as ProfilePage/UserHeader.
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    if (!u._id) return
    fetch(`${API_URL}/kyc/status/${u._id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.hasKYC && data?.kyc) setKycStatus(data.kyc.status)
        else setKycStatus('none')
      })
      .catch(() => setKycStatus('none'))
  }, [])

  // Gatekeeper invoked by every Trade button. Demo accounts always pass.
  // Real / Challenge accounts require an APPROVED kyc — pending / rejected /
  // none all open the gate modal.
  // Days remaining until an Algo account's balance unlocks.
  // Returns null for non-algo accounts, 0 once the lock has expired.
  const getAlgoDaysRemaining = (account) => {
    const isAlgo = account?.isAlgo || account?.accountTypeId?.isAlgo
    if (!isAlgo || !account?.algoLockUntil) return null
    const ms = new Date(account.algoLockUntil) - Date.now()
    if (ms <= 0) return 0
    return Math.ceil(ms / (24 * 60 * 60 * 1000))
  }

  // If the account is a still-locked Algo account, show the lock popup and
  // return true so the caller can abort (trade/deposit/withdraw blocked).
  const blockIfAlgoLocked = (account) => {
    const days = getAlgoDaysRemaining(account)
    if (days > 0) {
      setAlgoLockPopup({ daysRemaining: days })
      return true
    }
    return false
  }

  const handleTradeClick = (account) => {
    // Locked Algo account: trading is blocked until the lock period ends.
    if (blockIfAlgoLocked(account)) return
    const isDemo = account?.isDemo || account?.accountTypeId?.isDemo
    if (isDemo || kycStatus === 'approved') {
      if (isMobile) navigate(`/mobile?account=${account._id}`)
      else navigate(`/trade/${account._id}`)
      return
    }
    setPendingTradeAccount(account)
    setShowKycGate(true)
  }

  const tabKeys = challengeModeEnabled ? ['real', 'demo', 'challenge', 'archived'] : ['real', 'demo', 'archived']
  const tabs = tabKeys.map(key => ({ key, label: t(`account.${key}`) }))
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
    // Check if redirected from failed challenge
    const failed = searchParams.get('failed')
    const reason = searchParams.get('reason')
    if (failed === 'true' && reason) {
      setFailReason(decodeURIComponent(reason))
      setShowFailModal(true)
      setActiveTab('Challenge')
      // Clear URL params
      navigate('/account', { replace: true })
    }
    
    fetchAccountTypes()
    fetchChallengeStatus()
        if (user._id) {
      fetchUserAccounts()
      fetchWalletBalance()
      fetchChallengeAccounts()
    } else {
      setLoading(false)
    }
  }, [user._id])

  
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

  const fetchChallengeAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/prop/my-accounts/${user._id}`)
      const data = await res.json()
      if (data.success) {
        setChallengeAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error fetching challenge accounts:', error)
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

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/account-types`)
      const data = await res.json()
      setAccountTypes(data.accountTypes || [])
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
  }

  const fetchUserAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/trading-accounts/user/${user._id}`)
      const data = await res.json()
      setUserAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
    setLoading(false)
  }

  const handlePinChange = (index, value, pinArray, setPinArray, prefix = 'pin') => {
    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1)
    }
    if (value && !/^\d$/.test(value)) return
    
    const newPinArray = [...pinArray]
    newPinArray[index] = value
    setPinArray(newPinArray)

    // Auto focus next input when digit entered
    if (value && index < 3) {
      const nextInput = document.getElementById(`${prefix}-${index + 1}`)
      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }
    }
  }

  const handlePinKeyDown = (e, index, pinArray, setPinArray, prefix = 'pin') => {
    // Handle backspace - move to previous input
    if (e.key === 'Backspace') {
      if (!pinArray[index] && index > 0) {
        // If current input is empty, move to previous and clear it
        const prevInput = document.getElementById(`${prefix}-${index - 1}`)
        if (prevInput) {
          const newPinArray = [...pinArray]
          newPinArray[index - 1] = ''
          setPinArray(newPinArray)
          prevInput.focus()
        }
      }
    }
    // Handle left arrow
    else if (e.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.getElementById(`${prefix}-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
    // Handle right arrow
    else if (e.key === 'ArrowRight' && index < 3) {
      const nextInput = document.getElementById(`${prefix}-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
    // Handle Enter - submit if all filled
    else if (e.key === 'Enter') {
      const allFilled = pinArray.every(d => d !== '')
      if (allFilled) {
        // Trigger the appropriate action based on which modal is open
        if (showCreateModal) handleCreateAccount()
        else if (showTransferModal) handleTransferFunds()
        else if (showWithdrawModal) handleWithdrawFromAccount()
        else if (showPinModal) handleChangePin()
      }
    }
  }

  const handlePinFocus = (e) => {
    e.target.select()
  }

  const handleCreateAccount = async () => {
    if (!selectedType) {
      setError('Please select an account type')
      return
    }

    if (!user._id) {
      setError('Please login to create an account')
      return
    }

    try {
      const res = await fetch(`${API_URL}/trading-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          accountTypeId: selectedType._id,
          pin: '0000' // Default PIN - not used anymore
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        setSuccess('Account created successfully!')
        setShowCreateModal(false)
        setPin(['', '', '', ''])
        setSelectedType(null)
        fetchUserAccounts()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to create account')
      }
    } catch (error) {
      console.error('Account creation error:', error)
      setError('Error creating account. Please try again.')
    }
  }

  const handleChangePin = async () => {
    const currentPinValue = currentPin.join('')
    const newPinValue = newPin.join('')
    
    if (currentPinValue.length !== 4 || newPinValue.length !== 4) {
      setError('Please enter valid 4-digit PINs')
      return
    }

    try {
      const res = await fetch(`${API_URL}/trading-accounts/${selectedAccount._id}/change-pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: currentPinValue,
          newPin: newPinValue
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        setSuccess('PIN changed successfully!')
        setShowPinModal(false)
        setCurrentPin(['', '', '', ''])
        setNewPin(['', '', '', ''])
        setSelectedAccount(null)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Error changing PIN')
    }
  }

  const togglePinSecurity = () => {
    const newValue = !pinSecurityEnabled
    setPinSecurityEnabled(newValue)
    localStorage.setItem('pinSecurityEnabled', JSON.stringify(newValue))
    setSuccess(newValue ? 'PIN security enabled' : 'PIN security disabled')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleArchiveAccount = async (accountId) => {
    try {
      const res = await fetch(`${API_URL}/trading-accounts/${accountId}/archive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      
      if (data.success) {
        setSuccess('Account archived successfully!')
        setShowArchiveConfirm(null)
        fetchUserAccounts()
        setTimeout(() => setSuccess(''), 3000)
      } else if (data.requiresWithdrawal) {
        // Account has balance - prompt user to withdraw first
        setShowArchiveConfirm(null)
        const account = userAccounts.find(acc => acc._id === accountId)
        if (account) {
          setSelectedAccount(account)
          setShowWithdrawModal(true)
          setError(`Please withdraw $${data.balance.toFixed(2)} before archiving this account.`)
          setTimeout(() => setError(''), 5000)
        }
      } else {
        setError(data.message || 'Failed to archive account')
      }
    } catch (error) {
      console.error('Archive error:', error)
      setError('Error archiving account')
    }
  }

  const handleUnarchiveAccount = async (accountId) => {
    try {
      const res = await fetch(`${API_URL}/trading-accounts/${accountId}/unarchive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      
      if (data.success) {
        setSuccess('Account restored successfully!')
        fetchUserAccounts()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to restore account')
      }
    } catch (error) {
      console.error('Unarchive error:', error)
      setError('Error restoring account')
    }
  }

  const handleDeleteAccount = async (accountId) => {
    try {
      const res = await fetch(`${API_URL}/trading-accounts/${accountId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      
      if (data.success) {
        setSuccess('Account deleted permanently!')
        setShowDeleteConfirm(null)
        fetchUserAccounts()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to delete account')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setError('Error deleting account')
    }
  }

  const handleResetDemo = async (accountId) => {
    if (!confirm('Are you sure you want to reset this demo account? All open trades will be closed and balance will be reset.')) {
      return
    }

    try {
      const res = await fetch(`${API_URL}/trading-accounts/${accountId}/reset-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      
      if (data.success) {
        setSuccess(data.message || 'Demo account reset successfully!')
        fetchUserAccounts()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to reset demo account')
      }
    } catch (error) {
      console.error('Demo reset error:', error)
      setError('Error resetting demo account')
    }
  }

  const handleTransferFunds = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (parseFloat(transferAmount) > walletBalance) {
      setError('Insufficient wallet balance')
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
        setSuccess('Funds transferred successfully!')
        setShowTransferModal(false)
        setTransferAmount('')
        setTransferPin(['', '', '', ''])
        setSelectedAccount(null)
        fetchUserAccounts()
        fetchWalletBalance()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Transfer failed')
      }
    } catch (error) {
      console.error('Transfer error:', error)
      setError('Error transferring funds')
    }
  }

  const handleWithdrawFromAccount = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (parseFloat(transferAmount) > selectedAccount.balance) {
      setError('Insufficient account balance')
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
        setSuccess('Funds withdrawn to main wallet!')
        setShowWithdrawModal(false)
        setTransferAmount('')
        setTransferPin(['', '', '', ''])
        setSelectedAccount(null)
        fetchUserAccounts()
        fetchWalletBalance()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Withdrawal failed')
      }
    } catch (error) {
      console.error('Withdraw error:', error)
      setError('Error withdrawing funds')
    }
  }

  const handleAccountToAccountTransfer = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (!targetAccount) {
      setError('Please select a target account')
      return
    }
    if (parseFloat(transferAmount) > selectedAccount.balance) {
      setError('Insufficient account balance')
      return
    }

    try {
      const res = await fetch(`${API_URL}/trading-accounts/account-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          fromAccountId: selectedAccount._id,
          toAccountId: targetAccount._id,
          amount: parseFloat(transferAmount),
          skipPinVerification: true
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        setSuccess(`$${transferAmount} transferred from ${selectedAccount.accountId} to ${targetAccount.accountId}!`)
        setShowAccountTransferModal(false)
        setTransferAmount('')
        setTransferPin(['', '', '', ''])
        setSelectedAccount(null)
        setTargetAccount(null)
        fetchUserAccounts()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Transfer failed')
      }
    } catch (error) {
      console.error('Account transfer error:', error)
      setError('Error transferring funds')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Logged out successfully!')
    navigate('/user/login')
  }

  return (
    <div className={`flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-dark-900' : 'bg-gray-100'}`}>
      {/* Mobile Header */}
      {isMobile && (
        <header className={`fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center gap-4 ${isDarkMode ? 'bg-dark-800 border-b border-gray-800' : 'bg-white border-b border-gray-200'}`}>
          <button onClick={() => navigate('/mobile')} className={`p-2 -ml-2 rounded-lg ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft size={22} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
          </button>
          <h1 className={`font-semibold text-lg flex-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Account</h1>
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg ${isDarkMode ? 'text-yellow-400 hover:bg-dark-700' : 'text-blue-500 hover:bg-gray-100'}`}
          >
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
            className={`${sidebarExpanded ? 'w-48' : 'w-16'} ${isDarkMode ? 'bg-dark-900 border-gray-800' : 'bg-white border-gray-200'} border-r flex flex-col shrink-0 min-h-0 overflow-hidden transition-all duration-300 ease-in-out`}
            onMouseEnter={() => setSidebarExpanded(true)}
            onMouseLeave={() => setSidebarExpanded(false)}
          >
            <nav className="hide-scrollbar flex-1 min-h-0 overflow-y-auto px-2 pt-4">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  activeMenu === item.name 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                    : isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              title={!sidebarExpanded ? t('nav.logout') : ''}
            >
              <LogOut size={18} className="flex-shrink-0" />
              {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">{t('nav.logout')}</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content - Scrollable */}
      <main className={`hide-scrollbar flex-1 min-h-0 overflow-y-auto ${isMobile ? 'pt-14' : ''}`}>
        <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
          {/* Success/Error Messages */}
          {success && (
            <div className={`mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-500 flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
              <Check size={18} /> {success}
            </div>
          )}
          {error && (
            <div className={`mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 ${isMobile ? 'text-sm' : ''}`}>
              {error}
            </div>
          )}

          {/* Header with Title and Buttons */}
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'} mb-4`}>
            {!isMobile && <h1 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('account.title')}</h1>}
            <div className={`flex items-center ${isMobile ? 'justify-between' : 'gap-3'}`}>
              <button 
                onClick={fetchUserAccounts}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}
              >
                <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {activeTab === 'challenge' ? (
                <button
                  onClick={() => window.location.href = '/buy-challenge'}
                  className={`flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium ${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2.5'} rounded-lg hover:opacity-90 transition-colors`}
                >
                  <Plus size={isMobile ? 16 : 18} /> Buy Challenge
                </button>
              ) : (
                <button
                  onClick={() => { fetchAccountTypes(); setShowCreateModal(true); }}
                  className={`flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium ${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2.5'} rounded-lg hover:bg-accent-green/90 transition-colors`}
                >
                  <Plus size={isMobile ? 16 : 18} /> {t('account.createAccount')}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex items-center ${isMobile ? 'gap-1 overflow-x-auto pb-2' : 'gap-1'} mb-4`}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${isMobile ? 'px-3 py-1.5 text-xs whitespace-nowrap' : 'px-4 py-2 text-sm'} rounded-lg font-medium transition-colors ${
                  activeTab === tab.key
                    ? isDarkMode ? 'bg-dark-700 text-white border border-gray-600' : 'bg-white text-gray-900 border border-gray-300 shadow-sm'
                    : isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Accounts Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={24} className="text-gray-500 animate-spin" />
            </div>
          ) : activeTab === 'challenge' ? (
            /* Challenge Tab Content */
            <div>
              {/* Buy Challenge Button */}
              <div className="mb-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <Trophy size={28} className="text-yellow-500" />
                    </div>
                    <div>
                      <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('account.propTradingChallenge')}</h3>
                      <p className="text-gray-400 text-sm">{t('account.propTradingDesc')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/buy-challenge')}
                    className="flex items-center gap-2 bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-400 transition-colors"
                  >
                    <Trophy size={18} /> {t('account.buyChallenge')}
                  </button>
                </div>
              </div>

              {/* Challenge Accounts List */}
              {challengeAccounts.length === 0 ? (
                <div className={`border border-dashed rounded-xl ${isMobile ? 'p-8' : 'p-16'} text-center ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                  <div className={`${isMobile ? 'w-12 h-12' : 'w-14 h-14'} rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                    <Trophy size={isMobile ? 20 : 24} className="text-gray-500" />
                  </div>
                  <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'} mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('account.noChallengeAccounts')}</h3>
                  <p className="text-gray-500 text-sm mb-4">{t('account.buyChallengeDesc')}</p>
                  <button
                    onClick={() => navigate('/buy-challenge')}
                    className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400 font-medium transition-colors text-sm"
                  >
                    {t('account.buyFirstChallenge')} <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                  {challengeAccounts.map((account) => (
                    <div key={account._id} className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                      {/* Card Header */}
                      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              account.status === 'FUNDED' ? 'bg-purple-500/20' : 
                              account.status === 'PASSED' ? 'bg-green-500/20' : 
                              account.status === 'FAILED' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                            }`}>
                              <Trophy size={20} className={
                                account.status === 'FUNDED' ? 'text-purple-500' : 
                                account.status === 'PASSED' ? 'text-green-500' : 
                                account.status === 'FAILED' ? 'text-red-500' : 'text-yellow-500'
                              } />
                            </div>
                            <div>
                              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{account.accountId}</h3>
                              <p className="text-gray-500 text-xs uppercase">
                                {account.challengeId?.name || 'Challenge'} • Phase {account.currentPhase}/{account.totalPhases}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            account.status === 'FUNDED' ? 'bg-purple-500/20 text-purple-500' : 
                            account.status === 'PASSED' ? 'bg-green-500/20 text-green-500' : 
                            account.status === 'FAILED' ? 'bg-red-500/20 text-red-500' :
                            account.status === 'EXPIRED' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'
                          }`}>
                            {account.status}
                          </span>
                        </div>
                      </div>

                      {/* Card Body - Stats */}
                      <div className="p-4">
                        <div className="text-center mb-4">
                          <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${(account.currentBalance || 0).toLocaleString()}</p>
                          <p className="text-gray-500 text-sm">{t('account.balance')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                            <p className="text-gray-400 text-xs">Profit</p>
                            <p className={`font-medium ${account.currentProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {account.currentProfitPercent >= 0 ? '+' : ''}{(account.currentProfitPercent || 0).toFixed(2)}%
                            </p>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                            <p className="text-gray-400 text-xs">Daily DD</p>
                            <p className="text-red-500 font-medium">{(account.currentDailyDrawdownPercent || 0).toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer - Actions */}
                      <div className={`flex border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                        {account.status === 'ACTIVE' || account.status === 'FUNDED' ? (
                          <button
                            onClick={() => {
                              setSelectedChallengeAccount(account)
                              setShowRulesModal(true)
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-yellow-500 text-black font-medium hover:bg-yellow-400 transition-colors"
                          >
                            <ArrowRight size={16} /> Start Trading
                          </button>
                        ) : (
                          <div className={`flex-1 flex items-center justify-center gap-2 py-3 text-gray-500 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                            {account.status === 'PASSED' ? 'Awaiting Funded Account' : account.status}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : userAccounts.length === 0 ? (
            <div className={`border border-dashed rounded-xl p-16 text-center ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                <TrendingUp size={24} className="text-gray-500" />
              </div>
              <h3 className={`font-medium text-lg mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activeTab === 'real' ? t('account.noRealAccounts') : activeTab === 'demo' ? t('account.noDemoAccounts') : t('account.noArchivedAccounts')}</h3>
              <p className="text-gray-500 text-sm mb-6">{activeTab === 'real' ? t('account.createRealDesc') : activeTab === 'demo' ? t('account.createDemoDesc') : t('account.archivedDesc')}</p>
              <button
                onClick={() => { fetchAccountTypes(); setShowCreateModal(true); }}
                className="inline-flex items-center gap-2 text-accent-green hover:text-accent-green/80 font-medium transition-colors"
              >
                {t('account.createFirstAccount')} <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {userAccounts.filter(acc => {
                if (activeTab === 'real') return !acc.accountTypeId?.isDemo && !acc.isDemo && acc.status === 'Active'
                if (activeTab === 'demo') return (acc.accountTypeId?.isDemo || acc.isDemo) && acc.status === 'Active'
                if (activeTab === 'archived') return acc.status === 'Archived' || acc.status !== 'Active'
                return true
              }).map((account) => (
                <div key={account._id} className={`${isDarkMode ? 'bg-dark-800 border-gray-800' : 'bg-white border-gray-200 shadow-sm'} rounded-xl border`}>
                  {/* Exness-style Horizontal Card */}
                  <div className={`${isMobile ? 'p-3' : 'p-4 px-6'}`}>
                   <div className="flex items-center gap-4">
                    {/* Account type photo - left, vertically centered */}
                    {account.accountTypeId?.image && (
                      <img
                        src={account.accountTypeId.image.startsWith('http') ? account.accountTypeId.image : `${API_BASE_URL}${account.accountTypeId.image}`}
                        alt={account.accountTypeId?.name || 'Account'}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-600 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                    {/* Top Row - Account Info */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {account.accountTypeId?.isDemo || account.isDemo ? 'Demo' : 'Real'}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{account.accountTypeId?.name || 'Standard'}</span>
                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>#{account.accountId}</span>
                        {(() => {
                          const days = getAlgoDaysRemaining(account)
                          if (days === null) return null
                          return days > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-400" title="Principal is locked. Profit can be withdrawn; principal unlocks when the timer ends.">
                              <Lock size={10} /> Principal locked · {days}d left
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-500">
                              <Lock size={10} /> Unlocked
                            </span>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Bottom Row - Balance & Actions */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {account.balance.toLocaleString()}<span className="text-sm font-normal text-gray-500 ml-1">USD</span>
                        </p>
                      </div>
                      
                      {/* Action Buttons - Exness Style */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTradeClick(account)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-colors"
                        >
                          <TrendingUp size={16} /> Trade
                        </button>
                        {account.isDemo || account.accountTypeId?.isDemo ? (
                          <button
                            onClick={() => handleResetDemo(account._id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-dark-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                          >
                            <RefreshCw size={16} /> Reset
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => { if (blockIfAlgoLocked(account)) return; setSelectedAccount(account); setShowTransferModal(true); }}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-dark-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                            >
                              <Plus size={16} /> Deposit
                            </button>
                            <button
                              onClick={() => { if (blockIfAlgoLocked(account)) return; setSelectedAccount(account); setShowWithdrawModal(true); }}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-dark-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                            >
                              <Minus size={16} /> Withdraw
                            </button>
                            <div className="relative" data-account-menu>
                              <button
                                onClick={() => setShowAccountMenu(showAccountMenu === account._id ? null : account._id)}
                                className={`px-3 py-2 rounded-lg border ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-dark-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {showAccountMenu === account._id && (
                                <div 
                                  className={`absolute right-0 top-full mt-2 ${isDarkMode ? 'bg-dark-700 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-xl z-50 min-w-[180px]`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowAccountMenu(null)
                                      setShowAccountInfoModal(account)
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm ${isDarkMode ? 'text-gray-300 hover:bg-dark-600' : 'text-gray-700 hover:bg-gray-100'} rounded-t-lg flex items-center gap-2`}
                                  >
                                    <Eye size={14} /> Account Info
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowAccountMenu(null)
                                      setSelectedAccount(account)
                                      setShowAccountTransferModal(true)
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm ${isDarkMode ? 'text-gray-300 hover:bg-dark-600' : 'text-gray-700 hover:bg-gray-100'} flex items-center gap-2`}
                                  >
                                    <Copy size={14} /> Transfer
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowAccountMenu(null)
                                      setShowArchiveConfirm(account)
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm text-red-400 ${isDarkMode ? 'hover:bg-dark-600' : 'hover:bg-gray-100'} rounded-b-lg flex items-center gap-2`}
                                  >
                                    <X size={14} /> Archive Account
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    </div>
                   </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Banner Section - Slider */}
          <div className="mt-8">
            <BannerSlider isDarkMode={isDarkMode} bannerType="account" />
          </div>
        </div>
        </main>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 w-full max-w-2xl border max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Open New Account</h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false)
                  setPin(['', '', '', ''])
                  setSelectedType(null)
                  setError('')
                }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Account Type Category Selection */}
            <div className="mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateAccountTab('live')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    createAccountTab === 'live' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                      : isDarkMode ? 'bg-dark-700 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Live Account
                </button>
                <button
                  onClick={() => setCreateAccountTab('demo')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    createAccountTab === 'demo' 
                      ? 'bg-yellow-500 text-black' 
                      : isDarkMode ? 'bg-dark-700 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Demo Account
                </button>
              </div>
            </div>

            {/* Account Type Selection - 2 Column Grid Like Screenshot */}
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-4">
                {createAccountTab === 'demo' ? 'Select Demo Account Type' : 'Select Live Account Type'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {accountTypes.filter(t => createAccountTab === 'demo' ? t.isDemo : !t.isDemo).length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8 col-span-2">
                    No {createAccountTab === 'demo' ? 'demo' : 'live'} account types available
                  </p>
                ) : (
                  accountTypes.filter(t => createAccountTab === 'demo' ? t.isDemo : !t.isDemo).map((type) => {
                    const isSelected = selectedType?._id === type._id
                    const icons = {
                      'DEMO': '💳',
                      'STANDARD': '📊',
                      'PRO': '📈',
                      'PRO+': '⚡',
                      'ELITE': '👑',
                      'HNI': '💎',
                    }
                    const icon = icons[type.name?.toUpperCase()] || '📊'
                    
                    return (
                      <button
                        key={type._id}
                        onClick={() => setSelectedType(type)}
                        className={`relative bg-dark-700 rounded-xl p-5 text-left transition-all duration-200 border ${
                          isSelected
                            ? 'border-white ring-1 ring-white'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {/* Account type photo - centered at the top */}
                        {type.image && (
                          <div className="flex justify-center mb-3">
                            <img
                              src={type.image.startsWith('http') ? type.image : `${API_BASE_URL}${type.image}`}
                              alt={type.name}
                              className="w-20 h-20 rounded-full object-cover border-2 border-gray-600"
                            />
                          </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-3">
                          {!type.image && (
                            <span className="text-2xl">{icon}</span>
                          )}
                          <span className="text-white font-bold text-lg">{type.name}</span>
                          {type.isAlgo && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 flex items-center gap-0.5"><Lock size={9} /> ALGO</span>
                          )}
                          <div className={`w-4 h-4 rounded-full border-2 ml-auto ${isSelected ? 'border-white bg-white' : 'border-gray-500'}`}>
                            {isSelected && <div className="w-full h-full rounded-full bg-white" />}
                          </div>
                        </div>
                        
                        {/* Description */}
                        <p className="text-gray-400 text-sm mb-4">
                          {type.description || (type.isDemo ? 'Practice trading with virtual funds. No risk involved.' : 'Live trading account')}
                        </p>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">{type.isDemo ? 'Virtual Balance' : 'Min deposit'}</p>
                            <p className="text-white font-semibold">${type.isDemo ? '10,000' : type.minDeposit?.toLocaleString() || '100'} {!type.isDemo && 'USD'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Min spread</p>
                            <p className="text-white font-semibold">{type.minSpread || '0'} pips</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Max leverage</p>
                            <p className="text-white font-semibold">{type.leverage || '1:100'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Commission</p>
                            <p className="text-white font-semibold">{type.commission ? `$${type.commission}/lot` : 'NO COMM'}</p>
                          </div>
                        </div>

                        {/* Algo account lock details */}
                        {type.isAlgo && (
                          <div className="mt-4 pt-4 border-t border-cyan-500/20 space-y-2">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs">Capital Lock</p>
                                <p className="text-cyan-400 font-semibold">{type.algoLockDays || 90} days</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Monthly ROI Target</p>
                                <p className="text-cyan-400 font-semibold">{type.algoRoiMin ?? 2}% – {type.algoRoiMax ?? 5}%</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                              <Check size={13} className="text-green-500 mt-0.5 shrink-0" />
                              <span className="text-gray-400"><span className="text-gray-300">Profit withdrawal:</span> Allowed as per the withdrawal policy</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                              <Lock size={13} className="text-cyan-400 mt-0.5 shrink-0" />
                              <span className="text-gray-400"><span className="text-gray-300">Principal withdrawal:</span> After the {type.algoLockDays || 90}-day lock period</span>
                            </div>
                            <p className="text-gray-500 text-[11px] pt-1">⚠ Trading & withdrawals stay locked until the {type.algoLockDays || 90}-day period completes.</p>
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {selectedType && (
              <div className={`mb-4 p-4 rounded-xl ${selectedType.isDemo ? 'bg-yellow-500/10 border border-yellow-500/30' : selectedType.isAlgo ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-accent-green/10 border border-accent-green/30'}`}>
                <p className={`text-sm text-center ${selectedType.isDemo ? 'text-yellow-500' : selectedType.isAlgo ? 'text-cyan-400' : 'text-accent-green'}`}>
                  ✓ <strong>{selectedType.name}</strong> {selectedType.isDemo
                    ? `demo account will be created with $${selectedType.demoBalance?.toLocaleString() || '10,000'} virtual balance.`
                    : selectedType.isAlgo
                    ? `account will be created with $0 balance. Deposited capital stays locked for ${selectedType.algoLockDays || 90} days — trading & principal withdrawal unlock after that.`
                    : 'account will be created with $0 balance. Deposit funds after creation.'}
                </p>
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setPin(['', '', '', ''])
                  setSelectedType(null)
                  setError('')
                }}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              {selectedType && (
                <button
                  onClick={handleCreateAccount}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:bg-accent-green/90 transition-colors"
                >
                  {t('account.createAccount')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showPinModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Change PIN</h3>
              <button 
                onClick={() => {
                  setShowPinModal(false)
                  setCurrentPin(['', '', '', ''])
                  setNewPin(['', '', '', ''])
                  setError('')
                }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-3">Current PIN</label>
              <div className="flex gap-3 justify-center">
                {currentPin.map((digit, index) => (
                  <input
                    key={`current-${index}`}
                    id={`currentpin-${index}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, currentPin, setCurrentPin, 'currentpin')}
                    onKeyDown={(e) => handlePinKeyDown(e, index, currentPin, setCurrentPin, 'currentpin')}
                    onFocus={handlePinFocus}
                    autoFocus={index === 0}
                    className="w-12 h-12 bg-dark-700 border border-gray-700 rounded-lg text-center text-white text-xl focus:outline-none focus:border-accent-green"
                  />
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-3">New PIN</label>
              <div className="flex gap-3 justify-center">
                {newPin.map((digit, index) => (
                  <input
                    key={`new-${index}`}
                    id={`newpin-${index}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, newPin, setNewPin, 'newpin')}
                    onKeyDown={(e) => handlePinKeyDown(e, index, newPin, setNewPin, 'newpin')}
                    onFocus={handlePinFocus}
                    className="w-12 h-12 bg-dark-700 border border-gray-700 rounded-lg text-center text-white text-xl focus:outline-none focus:border-accent-green"
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false)
                  setCurrentPin(['', '', '', ''])
                  setNewPin(['', '', '', ''])
                  setError('')
                }}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePin}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:bg-accent-green/90 transition-colors"
              >
                Change PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal (Main Wallet → Account Wallet) */}
      {showTransferModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Transfer to Account</h3>
              <button 
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferAmount('')
                  setTransferPin(['', '', '', ''])
                  setError('')
                }}
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
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedAccount.accountId}</p>
                  <p className="text-gray-500 text-xs">{selectedAccount.accountTypeId?.name}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-gray-600">
                <span className="text-gray-400">Account Balance:</span>
                <span className="text-white font-medium">${selectedAccount.balance.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 bg-accent-green/10 border border-accent-green/30 rounded-lg mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Main Wallet Balance:</span>
                <span className="text-accent-green font-medium">${walletBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Transfer Amount</label>
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
                className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent-green"
              />
              <div className="flex justify-between mt-2">
                <button 
                  type="button"
                  onClick={() => setTransferAmount(walletBalance.toString())}
                  className="text-accent-green text-xs hover:underline"
                >
                  Max: ${walletBalance.toLocaleString()}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferAmount('')
                  setError('')
                }}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferFunds}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:bg-accent-green/90 transition-colors"
              >
                Transfer Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw from Account Modal (Account Wallet → Main Wallet) */}
      {showWithdrawModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Withdraw to Main Wallet</h3>
              <button 
                onClick={() => {
                  setShowWithdrawModal(false)
                  setTransferAmount('')
                  setTransferPin(['', '', '', ''])
                  setError('')
                }}
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
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedAccount.accountId}</p>
                  <p className="text-gray-500 text-xs">{selectedAccount.accountTypeId?.name}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-gray-600">
                <span className="text-gray-400">Available Balance:</span>
                <span className="text-white font-medium">${selectedAccount.balance.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Withdraw Amount</label>
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
                className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent-green"
              />
              <div className="flex justify-between mt-2">
                <button 
                  type="button"
                  onClick={() => setTransferAmount(selectedAccount.balance.toString())}
                  className="text-accent-green text-xs hover:underline"
                >
                  Max: ${selectedAccount.balance.toLocaleString()}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false)
                  setTransferAmount('')
                  setError('')
                }}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawFromAccount}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:bg-accent-green/90 transition-colors"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account to Account Transfer Modal */}
      {showAccountTransferModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Transfer Between Accounts</h3>
              <button 
                onClick={() => {
                  setShowAccountTransferModal(false)
                  setTransferAmount('')
                  setTransferPin(['', '', '', ''])
                  setTargetAccount(null)
                  setError('')
                }}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={20} />
              </button>
            </div>

            {/* From Account */}
            <div className={`p-3 rounded-lg mb-4 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
              <p className="text-gray-400 text-xs mb-1">From Account</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-500" />
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedAccount.accountId}</span>
                </div>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>${selectedAccount.balance.toLocaleString()}</span>
              </div>
            </div>

            {/* To Account Selection */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">To Account</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {userAccounts
                  .filter(acc => acc._id !== selectedAccount._id && acc.status === 'Active')
                  .map(acc => (
                    <button
                      key={acc._id}
                      onClick={() => setTargetAccount(acc)}
                      className={`w-full p-3 rounded-lg border flex items-center justify-between ${
                        targetAccount?._id === acc._id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-dark-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-gray-400" />
                        <span className="text-white text-sm">{acc.accountId}</span>
                        <span className="text-gray-500 text-xs">({acc.accountTypeId?.name})</span>
                      </div>
                      <span className="text-gray-400 text-sm">${acc.balance.toLocaleString()}</span>
                    </button>
                  ))}
                {userAccounts.filter(acc => acc._id !== selectedAccount._id && acc.status === 'Active').length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-2">No other accounts available</p>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Transfer Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={transferAmount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '')
                  setTransferAmount(value)
                }}
                placeholder="Enter amount"
                className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button 
                type="button"
                onClick={() => setTransferAmount(selectedAccount.balance.toString())}
                className="text-blue-400 text-xs hover:underline mt-2"
              >
                Max: ${selectedAccount.balance.toLocaleString()}
              </button>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAccountTransferModal(false)
                  setTransferAmount('')
                  setTargetAccount(null)
                  setError('')
                }}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAccountToAccountTransfer}
                disabled={!targetAccount}
                className="flex-1 bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Rules Modal */}
      {showRulesModal && selectedChallengeAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-dark-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Trophy size={20} className="text-yellow-500" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Challenge Rules</h2>
                  <p className="text-gray-500 text-sm">{selectedChallengeAccount.accountId}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRulesModal(false)} 
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Challenge Info */}
              <div className={`rounded-xl p-4 mb-6 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-gray-400 text-xs">Account Size</p>
                    <p className="text-white font-bold">${(selectedChallengeAccount.initialBalance || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Current Balance</p>
                    <p className="text-white font-bold">${(selectedChallengeAccount.currentBalance || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Phase</p>
                    <p className="text-white font-bold">{selectedChallengeAccount.currentPhase}/{selectedChallengeAccount.totalPhases}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Status</p>
                    <p className={`font-bold ${
                      selectedChallengeAccount.status === 'ACTIVE' ? 'text-blue-500' :
                      selectedChallengeAccount.status === 'FUNDED' ? 'text-purple-500' : 'text-gray-400'
                    }`}>{selectedChallengeAccount.status}</p>
                  </div>
                </div>
              </div>

              {/* Rules */}
              <h3 className="text-white font-semibold mb-4">Trading Rules You Must Follow</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                  <span className="text-gray-400">Daily Drawdown Limit</span>
                  <span className="text-red-500 font-bold">{selectedChallengeAccount.challengeId?.rules?.maxDailyDrawdownPercent || 5}%</span>
                </div>
                <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                  <span className="text-gray-400">Overall Drawdown Limit</span>
                  <span className="text-red-500 font-bold">{selectedChallengeAccount.challengeId?.rules?.maxOverallDrawdownPercent || 10}%</span>
                </div>
                <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                  <span className="text-gray-400">Profit Target</span>
                  <span className="text-green-500 font-bold">{selectedChallengeAccount.challengeId?.rules?.profitTargetPhase1Percent || 8}%</span>
                </div>
                <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                  <span className="text-gray-400">Min Lot Size</span>
                  <span className="text-white font-bold">{selectedChallengeAccount.challengeId?.rules?.minLotSize || 0.01}</span>
                </div>
                <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                  <span className="text-gray-400">Max Lot Size</span>
                  <span className="text-white font-bold">{selectedChallengeAccount.challengeId?.rules?.maxLotSize || 100}</span>
                </div>
                <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                  <span className="text-gray-400">Max Leverage</span>
                  <span className="text-white font-bold">1:{selectedChallengeAccount.challengeId?.rules?.maxLeverage || 100}</span>
                </div>
                {selectedChallengeAccount.challengeId?.rules?.stopLossMandatory && (
                  <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <Check size={18} className="text-yellow-500" />
                    <span className="text-yellow-500">Stop Loss is REQUIRED on all trades</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <p className="text-red-500 font-medium mb-2">⚠️ Important Warning</p>
                <p className="text-gray-400 text-sm">
                  Breaking any of the above rules will result in immediate account failure. 
                  Your challenge will be terminated and no refund will be provided.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 py-3 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowRulesModal(false)
                    if (kycStatus !== 'approved') {
                      setPendingTradeAccount({ ...selectedChallengeAccount, _isChallenge: true })
                      setShowKycGate(true)
                      return
                    }
                    if (isMobile) {
                      navigate(`/mobile?account=${selectedChallengeAccount._id}`)
                    } else {
                      navigate(`/trade/${selectedChallengeAccount._id}?type=challenge`)
                    }
                  }}
                  className="flex-1 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
                >
                  I Agree, Start Trading <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC Gate Modal — blocks trading until KYC is approved. Demo
          accounts bypass this in handleTradeClick. Real/challenge accounts
          land here when status is none / pending / rejected. */}
      {showKycGate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-yellow-500/30' : 'bg-white border-yellow-400'}`}>
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Lock size={22} className="text-yellow-500" />
                </div>
                <div>
                  <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>KYC Verification Required</h3>
                  <p className="text-xs text-gray-500">Complete verification to start trading</p>
                </div>
              </div>
              <button
                onClick={() => { setShowKycGate(false); setPendingTradeAccount(null) }}
                className={`p-1 rounded ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-dark-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {kycStatus === 'pending' ? (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-yellow-500 text-sm font-medium">Your KYC is under review.</p>
                  <p className="text-gray-400 text-xs mt-1">Trading will be enabled once your documents are approved (usually within 24 hours).</p>
                </div>
              ) : kycStatus === 'rejected' ? (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-500 text-sm font-medium">Your KYC was rejected.</p>
                  <p className="text-gray-400 text-xs mt-1">Please resubmit your documents to continue.</p>
                </div>
              ) : (
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  To comply with regulations, you need to verify your identity before placing live trades. It only takes a minute.
                </p>
              )}
              <ul className={`text-sm space-y-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <li className="flex items-start gap-2"><Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" /> Government-issued ID (Aadhaar / PAN / Passport)</li>
                <li className="flex items-start gap-2"><Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" /> Clear front (and back, if applicable) photos</li>
                <li className="flex items-start gap-2"><Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" /> Selfie holding your ID</li>
              </ul>
            </div>
            <div className={`p-6 border-t flex gap-3 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => { setShowKycGate(false); setPendingTradeAccount(null) }}
                className={`flex-1 py-3 rounded-lg transition-colors ${isDarkMode ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
              >
                Later
              </button>
              <button
                onClick={() => {
                  setShowKycGate(false)
                  // Hand off to ProfilePage with state so the KYC form pops
                  // open immediately — saves the user an extra click.
                  navigate('/profile', { state: { openKyc: true } })
                }}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-colors flex items-center justify-center gap-2"
              >
                {kycStatus === 'rejected' ? 'Resubmit KYC' : kycStatus === 'pending' ? 'View Status' : 'Complete KYC'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Failed Modal */}
      {showFailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md border border-red-500/30">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <X size={24} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-500">Challenge Failed</h2>
                  <p className="text-gray-500 text-sm">Your challenge account has been terminated</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <p className="text-red-400 font-medium mb-2">Reason for Failure:</p>
                <p className="text-white">{failReason}</p>
              </div>

              <div className={`rounded-xl p-4 mb-6 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                <p className="text-gray-400 text-sm mb-2">What happened?</p>
                <p className="text-gray-300 text-sm">
                  You violated the challenge rules multiple times. After 3 warnings for the same rule violation, 
                  your challenge account is automatically failed. No refund is available for failed challenges.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setShowFailModal(false)}
                  className="w-full py-3 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
                >
                  View My Accounts
                </button>
                <button
                  onClick={() => {
                    setShowFailModal(false)
                    navigate('/challenge')
                  }}
                  className="w-full py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  Try a New Challenge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-sm border border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={32} className="text-red-500" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Archive Account?</h3>
              <p className="text-gray-400 text-sm">
                Are you sure you want to archive <span className="text-white font-medium">{showArchiveConfirm.accountId}</span>? 
                The account will be moved to archived and you won't be able to trade on it.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveConfirm(null)}
                className="flex-1 py-3 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchiveAccount(showArchiveConfirm._id)}
                className="flex-1 py-3 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Info Modal */}
      {showAccountInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl w-full max-w-md border ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Account information</h3>
              <button 
                onClick={() => setShowAccountInfoModal(null)}
                className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Account ID */}
            <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Account: <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>#{showAccountInfoModal.accountId}</span></p>
            </div>
            
            {/* Info Rows */}
            <div className="p-4 space-y-4">
              {/* Type */}
              <div className={`flex items-center justify-between py-2 border-b border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Type</span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{showAccountInfoModal.accountTypeId?.name || 'Standard'}</span>
              </div>
              
              {/* Leverage */}
              <div className={`flex items-center justify-between py-2 border-b border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Leverage</span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{showAccountInfoModal.leverage}</span>
              </div>
              
              {/* Balance */}
              <div className={`flex items-center justify-between py-2 border-b border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Balance</span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${(showAccountInfoModal.balance || 0).toLocaleString()} USD</span>
              </div>
              
              {/* Credit */}
              <div className={`flex items-center justify-between py-2 border-b border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Credit</span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${(showAccountInfoModal.credit || 0).toLocaleString()} USD</span>
              </div>
              
              {/* Equity */}
              <div className={`flex items-center justify-between py-2 border-b border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Equity</span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${((showAccountInfoModal.balance || 0) + (showAccountInfoModal.credit || 0)).toLocaleString()} USD</span>
              </div>
              
              {/* Status */}
              <div className={`flex items-center justify-between py-2 border-b border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</span>
                <span className={`text-sm font-medium ${showAccountInfoModal.status === 'Active' ? 'text-green-500' : 'text-red-500'}`}>{showAccountInfoModal.status}</span>
              </div>
              
              {/* Account ID / Login */}
              <div className={`flex items-center justify-between py-2`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Account ID</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{showAccountInfoModal.accountId}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(showAccountInfoModal.accountId?.toString())
                      toast.success('Account ID copied!')
                    }}
                    className={`p-1 rounded ${isDarkMode ? 'hover:bg-dark-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-sm border border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={32} className="text-red-500" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Delete Permanently?</h3>
              <p className="text-gray-400 text-sm">
                Are you sure you want to permanently delete <span className="text-white font-medium">{showDeleteConfirm.accountId}</span>? 
                This action cannot be undone and all account data will be lost forever.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAccount(showDeleteConfirm._id)}
                className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Algo Account locked popup */}
      {algoLockPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-dark-800 rounded-2xl overflow-hidden border border-purple-500/30">
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/15 flex items-center justify-center">
                <Lock size={26} className="text-purple-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Algo Account Locked</h3>
              <p className="text-gray-400 text-sm">
                This is an Algo account. You cannot trade from this account — it is locked for the lock period.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 bg-purple-500/10 text-purple-300 px-4 py-2 rounded-lg">
                <span className="text-2xl font-bold">{algoLockPopup.daysRemaining}</span>
                <span className="text-sm">day{algoLockPopup.daysRemaining === 1 ? '' : 's'} until unlock</span>
              </div>
            </div>
            <div className="border-t border-gray-700/50 mt-4">
              <button
                onClick={() => setAlgoLockPopup(null)}
                className="w-full py-4 text-blue-500 font-medium text-lg hover:bg-dark-700 transition-colors"
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

export default Account
