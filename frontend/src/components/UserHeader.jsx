import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
  Wallet,
  Sun,
  Moon,
  Settings,
  User,
  TrendingUp,
  LogOut,
  FileText,
  ShieldCheck,
  X,
  Upload,
  CheckCircle,
  Camera,
  ChevronDown
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { API_URL, API_BASE_URL } from '../config/api'
import LanguageDropdown from './LanguageDropdown'

// Build a full image URL from a stored path (handles absolute URLs and /uploads paths)
const avatarSrc = (img) => (img ? (img.startsWith('http') ? img : `${API_BASE_URL}${img}`) : '')

const UserHeader = () => {
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [walletBalance, setWalletBalance] = useState(0)
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [modalError, setModalError] = useState('')
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showKycModal, setShowKycModal] = useState(false)
  const [kycStatus, setKycStatus] = useState(null)
  const [kycDocuments, setKycDocuments] = useState({ frontImage: null, backImage: null, selfieImage: null })
  const [kycPreviews, setKycPreviews] = useState({ frontImage: null, backImage: null, selfieImage: null })
  const [kycDocType, setKycDocType] = useState('aadhaar')
  const [kycDocNumber, setKycDocNumber] = useState('')
  const [submittingKyc, setSubmittingKyc] = useState(false)
  const walletDropdownRef = useRef(null)
  const profileDropdownRef = useRef(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target)) {
        setShowWalletDropdown(false)
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Mask email for display
  const getMaskedEmail = () => {
    if (!user.email) return ''
    const [name, domain] = user.email.split('@')
    if (name.length <= 2) return user.email
    return `${name[0]}****${name[name.length-1]}@${domain}`
  }

  useEffect(() => {
    if (user._id) {
      fetchWalletBalance()
      fetchKycStatus()
    }
  }, [user._id])

  const fetchKycStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/kyc/status/${user._id}`)
      const data = await res.json()
      if (data.success) {
        // Status is inside kyc object when KYC exists, otherwise null
        if (data.hasKYC && data.kyc) {
          setKycStatus(data.kyc.status)
        } else {
          setKycStatus(null)
        }
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error)
    }
  }

  const handleKycFileChange = (type, e) => {
    const file = e.target.files[0]
    if (file) {
      setKycDocuments(prev => ({ ...prev, [type]: file }))
      const reader = new FileReader()
      reader.onloadend = () => {
        setKycPreviews(prev => ({ ...prev, [type]: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleKycSubmit = async () => {
    if (!kycDocuments.frontImage) {
      toast.error('Please upload ID front image')
      return
    }
    if (!kycDocNumber) {
      toast.error('Please enter document number')
      return
    }

    setSubmittingKyc(true)
    try {
      const formData = new FormData()
      formData.append('userId', user._id)
      formData.append('documentType', kycDocType)
      formData.append('documentNumber', kycDocNumber)
      formData.append('frontImage', kycDocuments.frontImage)
      if (kycDocuments.backImage) formData.append('backImage', kycDocuments.backImage)
      if (kycDocuments.selfieImage) formData.append('selfieImage', kycDocuments.selfieImage)

      const res = await fetch(`${API_URL}/kyc/submit-files`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.success) {
        toast.success('KYC documents submitted successfully!')
        setShowKycModal(false)
        setKycDocuments({ frontImage: null, backImage: null, selfieImage: null })
        setKycPreviews({ frontImage: null, backImage: null, selfieImage: null })
        setKycDocNumber('')
        fetchKycStatus()
      } else {
        toast.error(data.message || 'Failed to submit KYC')
      }
    } catch (error) {
      console.error('KYC submit error:', error)
      toast.error('Error submitting KYC documents')
    } finally {
      setSubmittingKyc(false)
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

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Wallet Dropdown */}
        <div className="relative" ref={walletDropdownRef}>
          <button
            onClick={() => {
              setShowWalletDropdown(!showWalletDropdown)
              if (!showWalletDropdown) {
                fetchUserAccounts()
                fetchWalletBalance()
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-dark-700 border-gray-700 hover:bg-dark-600"
          >
            <Wallet size={16} className="text-accent-green" />
            <span className="text-sm font-medium text-white">${walletBalance.toLocaleString()}</span>
          </button>
          
          {/* Dropdown Menu */}
          {showWalletDropdown && (
            <div className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl border z-50 ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="p-4">
                {/* Main Wallet */}
                <div className={`pb-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Main Wallet</p>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${walletBalance.toLocaleString()} USD</p>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => { setShowWalletDropdown(false); navigate('/wallet'); }}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-gray-600 hover:bg-gray-700 text-gray-300"
                    >
                      Transfer
                    </button>
                    <button 
                      onClick={() => { setShowWalletDropdown(false); navigate('/wallet'); }}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-gray-600 hover:bg-gray-700 text-gray-300"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
                
                {/* Trading Accounts */}
                <div className={`py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Trading Accounts ({userAccounts.length})</p>
                  {userAccounts.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userAccounts.map(account => (
                        <div key={account._id} className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{account.accountId}</p>
                              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{account.accountTypeId?.name || 'Standard'}</p>
                            </div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${account.balance?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button 
                              onClick={() => { 
                                setSelectedAccount(account)
                                setShowTransferModal(true)
                                setShowWalletDropdown(false)
                                setModalError('')
                              }}
                              className="flex-1 text-xs py-1 rounded border border-gray-600 hover:bg-gray-700 text-gray-300"
                            >
                              Transfer
                            </button>
                            <button 
                              onClick={() => { 
                                setSelectedAccount(account)
                                setShowWithdrawModal(true)
                                setShowWalletDropdown(false)
                                setModalError('')
                              }}
                              className="flex-1 text-xs py-1 rounded border border-gray-600 hover:bg-gray-700 text-gray-300"
                            >
                              Withdraw
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No trading accounts</p>
                  )}
                </div>
                
                {/* Go to Wallet */}
                <button 
                  onClick={() => { setShowWalletDropdown(false); navigate('/wallet'); }}
                  className={`w-full mt-3 text-sm py-2 rounded-lg ${isDarkMode ? 'bg-dark-700 hover:bg-dark-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                >
                  Go to Wallet
                </button>
              </div>
            </div>
          )}
        </div>
        
        <LanguageDropdown />
        
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg transition-colors hover:bg-dark-700 text-yellow-400"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        {/* Profile Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="rounded-full transition-colors border hover:bg-dark-700 text-gray-400 border-gray-600 overflow-hidden flex items-center justify-center w-10 h-10"
            title="Profile"
          >
            {user.profileImage ? (
              <img src={avatarSrc(user.profileImage)} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={20} />
            )}
          </button>
          
          {/* Profile Dropdown Menu */}
          {showProfileDropdown && (
            <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border z-50 ${isDarkMode ? 'bg-dark-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="p-4">
                {/* User Email */}
                <div className={`flex items-center gap-3 pb-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  {user.profileImage ? (
                    <img src={avatarSrc(user.profileImage)} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className={`p-2 rounded-full ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
                      <User size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                    </div>
                  )}
                  <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{getMaskedEmail()}</span>
                  {kycStatus === 'approved' ? (
                    <div className="ml-auto p-2" title="Account Verified">
                      <ShieldCheck size={22} className="text-green-500" />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setShowProfileDropdown(false); setShowKycModal(true); }}
                      className="ml-auto p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                      title="Verify Account"
                    >
                      <ShieldCheck size={22} className="text-red-500" />
                    </button>
                  )}
                </div>
                
                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={() => { setShowProfileDropdown(false); navigate('/profile'); }}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors ${isDarkMode ? 'hover:bg-dark-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                  >
                    <User size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                    <span className="text-sm">Settings</span>
                  </button>
                  
                  <button
                    onClick={() => { setShowProfileDropdown(false); navigate('/instructions'); }}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors ${isDarkMode ? 'hover:bg-dark-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                  >
                    <FileText size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                    <span className="text-sm">Trading conditions</span>
                  </button>
                </div>
                
                {/* Sign Out */}
                <div className={`pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors ${isDarkMode ? 'hover:bg-dark-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                  >
                    <LogOut size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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

      {/* KYC Verification Modal */}
      {showKycModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 w-full max-w-lg border max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-gray-800">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <FileText size={20} className="text-gray-400" />
              <h3 className="font-semibold text-lg text-white">KYC Verification</h3>
            </div>

            {/* KYC Status Info */}
            {kycStatus === 'pending' && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
                <p className="text-yellow-500 text-sm">Your KYC verification is pending review.</p>
              </div>
            )}
            {kycStatus === 'rejected' && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                <p className="text-red-500 text-sm">Your KYC was rejected. Please resubmit your documents.</p>
              </div>
            )}

            {/* Document Type */}
            <div className="mb-4">
              <label className="block text-sm mb-2 text-cyan-400">Document Type</label>
              <div className="relative">
                <select
                  value={kycDocType}
                  onChange={(e) => setKycDocType(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border bg-[#0d0d0d] border-gray-800 text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="passport">Passport</option>
                  <option value="pan_card">PAN Card</option>
                  <option value="driving_license">Driving License</option>
                  <option value="national_id">National ID</option>
                  <option value="voter_id">Voter ID</option>
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Document Number */}
            <div className="mb-5">
              <label className="block text-sm mb-2 text-cyan-400">Document Number</label>
              <input
                type="text"
                value={kycDocNumber}
                onChange={(e) => setKycDocNumber(e.target.value)}
                placeholder="Enter document number"
                className="w-full px-4 py-3 rounded-lg border bg-[#0d0d0d] border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Front Side of Document */}
            <div className="mb-4">
              <label className="block text-sm mb-2 text-cyan-400">
                Front Side of Document <span className="text-red-500">*</span>
              </label>
              <div 
                onClick={() => document.getElementById('kyc-id-front').click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  kycPreviews.frontImage 
                    ? 'border-green-500' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {kycPreviews.frontImage ? (
                  <img src={kycPreviews.frontImage} alt="ID Front" className="max-h-32 mx-auto rounded" />
                ) : (
                  <div className="py-2">
                    <Upload size={28} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-cyan-400 text-sm">Click to upload front side</p>
                    <p className="text-gray-600 text-xs mt-1">Max 5MB, JPG/PNG</p>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                id="kyc-id-front" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => handleKycFileChange('frontImage', e)} 
              />
            </div>

            {/* Back Side of Document */}
            <div className="mb-4">
              <label className="block text-sm mb-2 text-cyan-400">
                Back Side of Document <span className="text-gray-600">(Optional)</span>
              </label>
              <div 
                onClick={() => document.getElementById('kyc-id-back').click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  kycPreviews.backImage 
                    ? 'border-green-500' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {kycPreviews.backImage ? (
                  <img src={kycPreviews.backImage} alt="ID Back" className="max-h-32 mx-auto rounded" />
                ) : (
                  <div className="py-2">
                    <Upload size={28} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-cyan-400 text-sm">Click to upload back side</p>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                id="kyc-id-back" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => handleKycFileChange('backImage', e)} 
              />
            </div>

            {/* Selfie with Document */}
            <div className="mb-6">
              <label className="block text-sm mb-2 text-cyan-400">
                Selfie with Document <span className="text-gray-600">(Optional)</span>
              </label>
              <div 
                onClick={() => document.getElementById('kyc-selfie').click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  kycPreviews.selfieImage 
                    ? 'border-green-500' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {kycPreviews.selfieImage ? (
                  <img src={kycPreviews.selfieImage} alt="Selfie" className="max-h-32 mx-auto rounded" />
                ) : (
                  <div className="py-2">
                    <Camera size={28} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-cyan-400 text-sm">Click to upload selfie</p>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                id="kyc-selfie" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => handleKycFileChange('selfieImage', e)} 
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowKycModal(false)
                  setKycDocuments({ frontImage: null, backImage: null, selfieImage: null })
                  setKycPreviews({ frontImage: null, backImage: null, selfieImage: null })
                  setKycDocNumber('')
                }}
                className="flex-1 py-3 rounded-lg transition-colors bg-gray-800 text-white hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleKycSubmit}
                disabled={submittingKyc || !kycDocuments.frontImage || !kycDocNumber}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-medium py-3 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {submittingKyc ? 'Submitting...' : 'Submit KYC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default UserHeader
