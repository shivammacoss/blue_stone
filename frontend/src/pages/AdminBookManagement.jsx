import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  BookOpen, Users, TrendingUp, TrendingDown, DollarSign, 
  Search, Filter, RefreshCw, ChevronRight, AlertTriangle,
  Settings, History, ArrowUpRight, ArrowDownRight, Check, X,
  UserCheck, UserX, Percent, Activity
} from 'lucide-react'
import { API_URL } from '../config/api'
import toast from 'react-hot-toast'

const AdminBookManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState(null)
  const [history, setHistory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBookType, setFilterBookType] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningUser, setAssigningUser] = useState(null)
  const [assignBookType, setAssignBookType] = useState('B_BOOK')
  const [assignReason, setAssignReason] = useState('')
  const [saving, setSaving] = useState(false)

  const admin = JSON.parse(localStorage.getItem('admin') || '{}')

  useEffect(() => {
    fetchDashboard()
    fetchUsers()
    fetchSettings()
    fetchHistory()
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [searchTerm, filterBookType])

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/book/dashboard`)
      const data = await res.json()
      if (data.success) {
        setDashboard(data.stats)
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    }
    setLoading(false)
  }

  const fetchUsers = async () => {
    try {
      let url = `${API_URL}/book/users?`
      if (searchTerm) url += `search=${searchTerm}&`
      if (filterBookType) url += `bookType=${filterBookType}&`
      
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/book/settings`)
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/book/history?limit=100`)
      const data = await res.json()
      if (data.success) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  const handleAssignUser = (user) => {
    setAssigningUser(user)
    setAssignBookType(user.bookType === 'A_BOOK' ? 'B_BOOK' : 'A_BOOK')
    setAssignReason('')
    setShowAssignModal(true)
  }

  const handleSaveAssignment = async () => {
    if (!assigningUser) return
    
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/book/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: assigningUser._id,
          bookType: assignBookType,
          reason: assignReason,
          adminId: admin._id
        })
      })
      
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setShowAssignModal(false)
        fetchUsers()
        fetchDashboard()
        fetchHistory()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Error assigning user')
    }
    setSaving(false)
  }

  const handleBulkAssign = async (bookType) => {
    if (selectedUsers.length === 0) {
      toast.error('Select users first')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/book/bulk-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUsers,
          bookType,
          reason: 'Bulk assignment',
          adminId: admin._id
        })
      })
      
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setSelectedUsers([])
        fetchUsers()
        fetchDashboard()
        fetchHistory()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Error bulk assigning users')
    }
    setSaving(false)
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/book/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      const data = await res.json()
      if (data.success) {
        toast.success('Settings saved')
        setSettings(data.settings)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Error saving settings')
    }
    setSaving(false)
  }

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(users.map(u => u._id))
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="text-blue-500" />
              A-Book / B-Book Management
            </h1>
            <p className="text-gray-400 text-sm mt-1">Manage user risk allocation between A-Book and B-Book</p>
          </div>
          <button
            onClick={() => { fetchDashboard(); fetchUsers(); fetchHistory(); }}
            className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'history', label: 'History', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700 hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm">A-Book Users</p>
                    <p className="text-3xl font-bold text-white mt-1">{dashboard.aBookUsers}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                    <UserCheck className="text-green-500" size={24} />
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-2">STP/ECN - Direct to Market</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-400 text-sm">B-Book Users</p>
                    <p className="text-3xl font-bold text-white mt-1">{dashboard.bBookUsers}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <UserX className="text-orange-500" size={24} />
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-2">Market Maker - Internal</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-sm">A-Book Exposure</p>
                    <p className="text-2xl font-bold text-white mt-1">{formatCurrency(dashboard.aBookExposure)}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <ArrowUpRight className="text-blue-500" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-400 text-sm">B-Book Exposure</p>
                    <p className="text-2xl font-bold text-white mt-1">{formatCurrency(dashboard.bBookExposure)}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <ArrowDownRight className="text-purple-500" size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution Chart */}
            <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-4">Book Distribution</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-8 bg-dark-700 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 flex items-center justify-center text-xs font-medium text-white"
                      style={{ width: `${dashboard.aBookPercentage}%` }}
                    >
                      {dashboard.aBookPercentage > 10 && `${dashboard.aBookPercentage}%`}
                    </div>
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center text-xs font-medium text-white"
                      style={{ width: `${100 - dashboard.aBookPercentage}%` }}
                    >
                      {(100 - dashboard.aBookPercentage) > 10 && `${100 - dashboard.aBookPercentage}%`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-400">A-Book ({dashboard.aBookUsers} users)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-400">B-Book ({dashboard.bBookUsers} users)</span>
                </div>
              </div>
            </div>

            {/* Risk Alert */}
            {dashboard.bBookExposure > 500000 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
                <AlertTriangle className="text-red-500" size={24} />
                <div>
                  <p className="text-red-400 font-medium">High B-Book Exposure Alert</p>
                  <p className="text-gray-400 text-sm">B-Book exposure is above $500,000. Consider moving some users to A-Book.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white"
                />
              </div>
              <select
                value={filterBookType}
                onChange={(e) => setFilterBookType(e.target.value)}
                className="bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="">All Books</option>
                <option value="A_BOOK">A-Book Only</option>
                <option value="B_BOOK">B-Book Only</option>
              </select>
              
              {selectedUsers.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAssign('A_BOOK')}
                    disabled={saving}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    Move to A-Book ({selectedUsers.length})
                  </button>
                  <button
                    onClick={() => handleBulkAssign('B_BOOK')}
                    disabled={saving}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                  >
                    Move to B-Book ({selectedUsers.length})
                  </button>
                </div>
              )}
            </div>

            {/* Users Table */}
            <div className="bg-dark-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={selectAllUsers}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Book Type</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Balance</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Trades</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Win Rate</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">P/L</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id} className="border-t border-gray-700 hover:bg-dark-700/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={() => toggleUserSelection(user._id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-gray-400 text-xs">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.bookType === 'A_BOOK' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {user.bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">{formatCurrency(user.totalBalance)}</td>
                      <td className="px-4 py-3 text-gray-300">{user.stats?.totalTrades || 0}</td>
                      <td className="px-4 py-3">
                        <span className={user.stats?.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                          {user.stats?.winRate || 0}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={user.stats?.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {user.stats?.totalPnl >= 0 ? '+' : ''}{formatCurrency(user.stats?.totalPnl || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleAssignUser(user)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            user.bookType === 'A_BOOK'
                              ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          }`}
                        >
                          Move to {user.bookType === 'A_BOOK' ? 'B-Book' : 'A-Book'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No users found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-4">Default Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Default Book Type</label>
                  <select
                    value={settings.defaultBookType}
                    onChange={(e) => setSettings({...settings, defaultBookType: e.target.value})}
                    className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="B_BOOK">B-Book (Market Maker)</option>
                    <option value="A_BOOK">A-Book (STP/ECN)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.autoAssignEnabled}
                    onChange={(e) => setSettings({...settings, autoAssignEnabled: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <label className="text-white">Enable Auto-Assignment Rules</label>
                </div>
              </div>
            </div>

            <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-4">Auto-Assignment Rules</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.autoAssignRules?.moveToABookOnProfit?.enabled}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoAssignRules: {
                          ...settings.autoAssignRules,
                          moveToABookOnProfit: {
                            ...settings.autoAssignRules?.moveToABookOnProfit,
                            enabled: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-white">Move to A-Book when profit exceeds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      value={settings.autoAssignRules?.moveToABookOnProfit?.profitThreshold || 5000}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoAssignRules: {
                          ...settings.autoAssignRules,
                          moveToABookOnProfit: {
                            ...settings.autoAssignRules?.moveToABookOnProfit,
                            profitThreshold: parseFloat(e.target.value)
                          }
                        }
                      })}
                      className="w-24 bg-dark-600 border border-gray-600 rounded px-2 py-1 text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.autoAssignRules?.moveToABookOnWinRate?.enabled}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoAssignRules: {
                          ...settings.autoAssignRules,
                          moveToABookOnWinRate: {
                            ...settings.autoAssignRules?.moveToABookOnWinRate,
                            enabled: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-white">Move to A-Book when win rate exceeds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.autoAssignRules?.moveToABookOnWinRate?.winRateThreshold || 60}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoAssignRules: {
                          ...settings.autoAssignRules,
                          moveToABookOnWinRate: {
                            ...settings.autoAssignRules?.moveToABookOnWinRate,
                            winRateThreshold: parseFloat(e.target.value)
                          }
                        }
                      })}
                      className="w-16 bg-dark-600 border border-gray-600 rounded px-2 py-1 text-white"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-4">A-Book Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Liquidity Provider</label>
                  <input
                    type="text"
                    value={settings.aBookSettings?.liquidityProvider || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      aBookSettings: { ...settings.aBookSettings, liquidityProvider: e.target.value }
                    })}
                    className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    placeholder="e.g., LMAX, Currenex"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Markup (Pips)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.aBookSettings?.markupPips || 0}
                    onChange={(e) => setSettings({
                      ...settings,
                      aBookSettings: { ...settings.aBookSettings, markupPips: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Commission per Lot ($)</label>
                  <input
                    type="number"
                    value={settings.aBookSettings?.commissionPerLot || 7}
                    onChange={(e) => setSettings({
                      ...settings,
                      aBookSettings: { ...settings.aBookSettings, commissionPerLot: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-dark-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">User</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Book Type</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Assigned By</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item._id} className="border-t border-gray-700">
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{item.userId?.firstName} {item.userId?.lastName}</p>
                      <p className="text-gray-400 text-xs">{item.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.bookType === 'A_BOOK' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {item.bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {item.assignedBy?.name || item.assignedBy?.email || 'System'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {item.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {history.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No assignment history
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && assigningUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold">Assign User to Book</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-dark-700 rounded-lg p-3">
                <p className="text-white font-medium">{assigningUser.firstName} {assigningUser.lastName}</p>
                <p className="text-gray-400 text-sm">{assigningUser.email}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Current: {assigningUser.bookType === 'A_BOOK' ? 'A-Book' : 'B-Book'}
                </p>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm block mb-1">Assign To</label>
                <select
                  value={assignBookType}
                  onChange={(e) => setAssignBookType(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="A_BOOK">A-Book (STP/ECN)</option>
                  <option value="B_BOOK">B-Book (Market Maker)</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm block mb-1">Reason (Optional)</label>
                <textarea
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  rows={2}
                  placeholder="Reason for assignment..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminBookManagement
