import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw,
  Search,
  User,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

const API_URL = 'http://localhost:5001/api'

const AdminForexCharges = () => {
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCharge, setEditingCharge] = useState(null)
  const [users, setUsers] = useState([])
  const [accountTypes, setAccountTypes] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedAccountType, setSelectedAccountType] = useState(null)
  const [showSpreadHelp, setShowSpreadHelp] = useState(false)
  const [form, setForm] = useState({
    level: 'SEGMENT',
    segment: 'Forex',
    instrumentSymbol: '',
    userId: '',
    accountTypeId: '',
    spreadType: 'FIXED',
    spreadValue: 0,
    commissionType: 'PER_LOT',
    commissionValue: 0,
    commissionOnBuy: true,
    commissionOnSell: true,
    commissionOnClose: false,
    swapLong: 0,
    swapShort: 0
  })

  useEffect(() => {
    fetchCharges()
    fetchUsers()
    fetchAccountTypes()
  }, [])

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/account-types`)
      const data = await res.json()
      if (data.success) {
        setAccountTypes(data.accountTypes || [])
      }
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchCharges = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/charges?segment=Forex`)
      const data = await res.json()
      if (data.success) {
        setCharges(data.charges || [])
      }
    } catch (error) {
      console.error('Error fetching charges:', error)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      const url = editingCharge 
        ? `${API_URL}/charges/${editingCharge._id}`
        : `${API_URL}/charges`
      const method = editingCharge ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) {
        alert(editingCharge ? 'Charge updated!' : 'Charge created!')
        setShowAddModal(false)
        setEditingCharge(null)
        resetForm()
        fetchCharges()
      } else {
        alert(data.message || 'Error saving charge')
      }
    } catch (error) {
      alert('Error saving charge')
    }
  }

  const handleDelete = async (chargeId) => {
    if (!confirm('Are you sure you want to delete this charge?')) return
    try {
      const res = await fetch(`${API_URL}/charges/${chargeId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        alert('Charge deleted!')
        fetchCharges()
      } else {
        alert(data.message || 'Error deleting charge')
      }
    } catch (error) {
      alert('Error deleting charge')
    }
  }

  const openEditModal = (charge) => {
    setEditingCharge(charge)
    setForm({
      level: charge.level || 'SEGMENT',
      segment: charge.segment || 'Forex',
      instrumentSymbol: charge.instrumentSymbol || '',
      userId: charge.userId?._id || charge.userId || '',
      accountTypeId: charge.accountTypeId?._id || charge.accountTypeId || '',
      spreadType: charge.spreadType || 'FIXED',
      spreadValue: charge.spreadValue || 0,
      commissionType: charge.commissionType || 'PER_LOT',
      commissionValue: charge.commissionValue || 0,
      commissionOnBuy: charge.commissionOnBuy !== false,
      commissionOnSell: charge.commissionOnSell !== false,
      commissionOnClose: charge.commissionOnClose || false,
      swapLong: charge.swapLong || 0,
      swapShort: charge.swapShort || 0
    })
    // Set selected user if editing a USER level charge
    if (charge.level === 'USER' && charge.userId) {
      const user = users.find(u => u._id === (charge.userId?._id || charge.userId))
      setSelectedUser(user || null)
    } else {
      setSelectedUser(null)
    }
    // Set selected account type if editing an ACCOUNT_TYPE level charge
    if (charge.level === 'ACCOUNT_TYPE' && charge.accountTypeId) {
      const accType = accountTypes.find(a => a._id === (charge.accountTypeId?._id || charge.accountTypeId))
      setSelectedAccountType(accType || null)
    } else {
      setSelectedAccountType(null)
    }
    setShowAddModal(true)
  }

  const resetForm = () => {
    setForm({
      level: 'SEGMENT',
      segment: 'Forex',
      instrumentSymbol: '',
      userId: '',
      accountTypeId: '',
      spreadType: 'FIXED',
      spreadValue: 0,
      commissionType: 'PER_LOT',
      commissionValue: 0,
      commissionOnBuy: true,
      commissionOnSell: true,
      commissionOnClose: false,
      swapLong: 0,
      swapShort: 0
    })
    setSelectedUser(null)
    setSelectedAccountType(null)
    setUserSearch('')
  }

  const selectUser = (user) => {
    setSelectedUser(user)
    setForm({ ...form, userId: user._id })
    setShowUserDropdown(false)
    setUserSearch('')
  }

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
    const searchLower = userSearch.toLowerCase()
    return fullName.includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(userSearch) ||
      user._id?.includes(userSearch)
  })

  const getLevelLabel = (charge) => {
    if (charge.level === 'USER') {
      const userName = charge.userId?.firstName 
        ? `${charge.userId.firstName} ${charge.userId.lastName || ''}`.trim()
        : charge.userId?.email || 'Unknown User'
      return `${userName} - ${charge.instrumentSymbol || 'All Instruments'}`
    }
    if (charge.level === 'INSTRUMENT') return charge.instrumentSymbol
    if (charge.level === 'SEGMENT') return charge.segment
    if (charge.level === 'GLOBAL') return 'Global'
    return charge.level
  }

  return (
    <AdminLayout title="Forex Charges" subtitle="Manage trading fees and spreads">
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-green-500" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Forex Trading Charges</h2>
              <p className="text-gray-500 text-sm">Configure spreads, commissions, and fees</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchCharges}
              className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-gray-400"
            >
              <RefreshCw size={18} />
            </button>
            <button 
              onClick={() => { resetForm(); setEditingCharge(null); setShowAddModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Charge</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading charges...</div>
        ) : charges.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No charges configured for Forex.</p>
            <p className="text-sm mt-2">Click "Add Charge" to create one.</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {charges.map((charge) => (
              <div key={charge._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-dark-700 rounded-xl border border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 text-xs rounded-full">
                      {charge.level}
                    </span>
                    <p className="text-white font-medium">{getLevelLabel(charge)}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Spread:</span>
                      <span className="text-white ml-1">{charge.spreadValue} ({charge.spreadType})</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Commission:</span>
                      <span className="text-white ml-1">${charge.commissionValue} ({charge.commissionType})</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Swap Long:</span>
                      <span className="text-white ml-1">{charge.swapLong}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Swap Short:</span>
                      <span className="text-white ml-1">{charge.swapShort}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openEditModal(charge)}
                    className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-white"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(charge._id)}
                    className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingCharge ? 'Edit Charge' : 'Add Forex Charge'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Hierarchy Explanation */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-sm font-medium mb-1">📊 Priority Hierarchy (Higher overrides Lower)</p>
                <p className="text-gray-400 text-xs">
                  <span className="text-white">USER</span> → <span className="text-white">INSTRUMENT</span> → <span className="text-white">SEGMENT</span> → <span className="text-white">ACCOUNT TYPE</span> → <span className="text-white">GLOBAL</span>
                </p>
                <p className="text-gray-500 text-xs mt-1">Example: User-specific settings override all others for that user.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => {
                      const newLevel = e.target.value
                      setForm({ ...form, level: newLevel })
                      if (newLevel !== 'USER') {
                        setSelectedUser(null)
                        setForm(prev => ({ ...prev, userId: '' }))
                      }
                      if (newLevel !== 'ACCOUNT_TYPE') {
                        setSelectedAccountType(null)
                        setForm(prev => ({ ...prev, accountTypeId: '' }))
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="GLOBAL">Global (Lowest Priority)</option>
                    <option value="ACCOUNT_TYPE">Account Type</option>
                    <option value="SEGMENT">Segment</option>
                    <option value="INSTRUMENT">Instrument</option>
                    <option value="USER">User-Specific (Highest Priority)</option>
                  </select>
                </div>
                {form.level === 'SEGMENT' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Segment</label>
                    <select
                      value={form.segment}
                      onChange={(e) => setForm({ ...form, segment: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="Forex">Forex</option>
                      <option value="Metals">Metals</option>
                      <option value="Crypto">Crypto</option>
                      <option value="Indices">Indices</option>
                    </select>
                  </div>
                )}
                {form.level === 'ACCOUNT_TYPE' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Account Type</label>
                    <select
                      value={form.accountTypeId}
                      onChange={(e) => {
                        const accType = accountTypes.find(a => a._id === e.target.value)
                        setSelectedAccountType(accType || null)
                        setForm({ ...form, accountTypeId: e.target.value })
                      }}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="">Select Account Type</option>
                      {accountTypes.map(acc => (
                        <option key={acc._id} value={acc._id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(form.level === 'INSTRUMENT' || form.level === 'USER') && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Symbol</label>
                    <select
                      value={form.instrumentSymbol}
                      onChange={(e) => setForm({ ...form, instrumentSymbol: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="">All Instruments</option>
                      <optgroup label="Forex">
                        <option value="EURUSD">EURUSD</option>
                        <option value="GBPUSD">GBPUSD</option>
                        <option value="USDJPY">USDJPY</option>
                        <option value="USDCHF">USDCHF</option>
                        <option value="AUDUSD">AUDUSD</option>
                        <option value="NZDUSD">NZDUSD</option>
                        <option value="USDCAD">USDCAD</option>
                      </optgroup>
                      <optgroup label="Metals">
                        <option value="XAUUSD">XAUUSD (Gold)</option>
                        <option value="XAGUSD">XAGUSD (Silver)</option>
                      </optgroup>
                      <optgroup label="Crypto">
                        <option value="BTCUSD">BTCUSD</option>
                        <option value="ETHUSD">ETHUSD</option>
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>

              {/* User Selection for USER level */}
              {form.level === 'USER' && (
                <div className="relative">
                  <label className="block text-gray-400 text-sm mb-1">Select User</label>
                  {selectedUser ? (
                    <div className="flex items-center justify-between p-3 bg-dark-700 border border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <User size={16} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{selectedUser.firstName} {selectedUser.lastName}</p>
                          <p className="text-gray-500 text-xs">{selectedUser.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedUser(null); setForm({ ...form, userId: '' }) }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search by name, email, or phone..."
                          value={userSearch}
                          onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true) }}
                          onFocus={() => setShowUserDropdown(true)}
                          className="w-full pl-10 pr-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                        />
                      </div>
                      {showUserDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-dark-700 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {filteredUsers.length === 0 ? (
                            <div className="p-3 text-gray-500 text-sm text-center">No users found</div>
                          ) : (
                            filteredUsers.slice(0, 15).map(user => (
                              <button
                                key={user._id}
                                onClick={() => selectUser(user)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-dark-600 text-left"
                              >
                                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                                  <User size={14} className="text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SPREAD SETTINGS */}
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">📈 Spread Settings</h3>
                  <button
                    type="button"
                    onClick={() => setShowSpreadHelp(!showSpreadHelp)}
                    className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                  >
                    <Info size={14} /> {showSpreadHelp ? 'Hide' : 'Show'} Examples
                  </button>
                </div>
                
                {showSpreadHelp && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3 text-xs">
                    <p className="text-yellow-400 font-medium mb-2">💡 Spread Value Examples (FIXED type):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-300">
                      <div>
                        <p className="text-white font-medium">Forex (in PIPS):</p>
                        <p>• <code className="bg-dark-600 px-1 rounded">1.5</code> = 1.5 pips</p>
                        <p>• EURUSD: 1.5 pips = <code className="bg-dark-600 px-1 rounded">0.00015</code> added</p>
                        <p>• USDJPY: 1.5 pips = <code className="bg-dark-600 px-1 rounded">0.015</code> added</p>
                      </div>
                      <div>
                        <p className="text-white font-medium">Metals (in cents):</p>
                        <p>• <code className="bg-dark-600 px-1 rounded">50</code> = $0.50 spread</p>
                        <p>• XAUUSD at 2650: Ask = 2650.50</p>
                      </div>
                      <div>
                        <p className="text-white font-medium">Crypto (in USD):</p>
                        <p>• <code className="bg-dark-600 px-1 rounded">10</code> = $10 spread</p>
                        <p>• BTCUSD at 45000: Ask = 45010</p>
                      </div>
                      <div>
                        <p className="text-white font-medium">Percentage:</p>
                        <p>• <code className="bg-dark-600 px-1 rounded">0.1</code> = 0.1% of price</p>
                        <p>• EURUSD at 1.1000: Spread = 0.0011</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Spread Type</label>
                    <select
                      value={form.spreadType}
                      onChange={(e) => setForm({ ...form, spreadType: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="FIXED">Fixed (Pips/Cents/USD)</option>
                      <option value="PERCENTAGE">Percentage of Price</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Spread Value {form.spreadType === 'PERCENTAGE' ? '(%)' : '(Pips/Cents)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.spreadValue}
                      onChange={(e) => setForm({ ...form, spreadValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                      placeholder={form.spreadType === 'PERCENTAGE' ? 'e.g., 0.1' : 'e.g., 1.5'}
                    />
                  </div>
                </div>
              </div>

              {/* COMMISSION SETTINGS */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-white font-medium mb-3">💰 Commission Settings (Per Lot)</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Commission Type</label>
                    <select
                      value={form.commissionType}
                      onChange={(e) => setForm({ ...form, commissionType: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="PER_LOT">Per Lot ($X per lot)</option>
                      <option value="PER_TRADE">Per Trade (flat fee)</option>
                      <option value="PERCENTAGE">Percentage of trade value</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Commission Value {form.commissionType === 'PERCENTAGE' ? '(%)' : '($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.commissionValue}
                      onChange={(e) => setForm({ ...form, commissionValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                      placeholder={form.commissionType === 'PER_LOT' ? 'e.g., 7 (=$7/lot)' : 'e.g., 0.1'}
                    />
                  </div>
                </div>

                {/* Commission Execution Options */}
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-2">Charge commission on:</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.commissionOnBuy}
                        onChange={(e) => setForm({ ...form, commissionOnBuy: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-green-500 focus:ring-green-500"
                      />
                      <span className="text-white text-sm">Buy Orders</span>
                      <span className="text-green-500 text-xs">(Open Long)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.commissionOnSell}
                        onChange={(e) => setForm({ ...form, commissionOnSell: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-red-500 focus:ring-red-500"
                      />
                      <span className="text-white text-sm">Sell Orders</span>
                      <span className="text-red-500 text-xs">(Open Short)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.commissionOnClose}
                        onChange={(e) => setForm({ ...form, commissionOnClose: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-white text-sm">Close Trade</span>
                      <span className="text-blue-500 text-xs">(Exit Position)</span>
                    </label>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    Example: $7/lot with Buy+Sell = $14 total for 1 lot round trip
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Swap Long (points)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.swapLong}
                    onChange={(e) => setForm({ ...form, swapLong: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Swap Short (points)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.swapShort}
                    onChange={(e) => setForm({ ...form, swapShort: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  {editingCharge ? 'Update Charge' : 'Create Charge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminForexCharges
