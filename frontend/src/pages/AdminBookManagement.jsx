import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  Users,
  Search,
  RefreshCw,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity
} from 'lucide-react'
import priceStreamService from '../services/priceStream'

const API_URL = 'http://localhost:5001/api'

const AdminBookManagement = () => {
  const [activeTab, setActiveTab] = useState('book-management')
  const [aBookSubTab, setABookSubTab] = useState('positions')
  const [users, setUsers] = useState([])
  const [positions, setPositions] = useState([])
  const [history, setHistory] = useState([])
  const [positionsSummary, setPositionsSummary] = useState({ totalVolume: 0, totalExposure: 0, count: 0 })
  const [historySummary, setHistorySummary] = useState({ totalPnl: 0, totalVolume: 0, count: 0, winCount: 0, lossCount: 0 })
  const [stats, setStats] = useState({
    aBook: { users: 0, openTrades: 0, volume: 0 },
    bBook: { users: 0, openTrades: 0, volume: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [bookFilter, setBookFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [selectedUsers, setSelectedUsers] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [positionsPagination, setPositionsPagination] = useState({ total: 0, pages: 1 })
  const [historyPagination, setHistoryPagination] = useState({ total: 0, pages: 1 })
  const [positionsPage, setPositionsPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  useEffect(() => {
    fetchStats()
    if (activeTab === 'book-management') {
      fetchUsers()
    } else if (activeTab === 'a-book') {
      if (aBookSubTab === 'positions') {
        fetchPositions()
      } else {
        fetchHistory()
      }
    }
  }, [activeTab, aBookSubTab, currentPage, bookFilter, searchTerm, positionsPage, historyPage])

  useEffect(() => {
    const unsubscribe = priceStreamService.subscribe('adminBookManagement', (prices) => {
      if (prices && Object.keys(prices).length > 0) {
        setLivePrices(prev => ({ ...prev, ...prices }))
      }
    })
    return () => unsubscribe()
  }, [])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/book-management/stats`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(bookFilter && { bookType: bookFilter })
      })
      
      const res = await fetch(`${API_URL}/book-management/users?${params}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
    setLoading(false)
  }

  const fetchPositions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: positionsPage,
        limit: 100
      })
      
      const res = await fetch(`${API_URL}/book-management/a-book/positions?${params}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setPositions(data.positions)
        setPositionsSummary(data.summary)
        setPositionsPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
    }
    setLoading(false)
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: historyPage,
        limit: 100
      })
      
      const res = await fetch(`${API_URL}/book-management/a-book/history?${params}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setHistory(data.history)
        setHistorySummary(data.summary)
        setHistoryPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    }
    setLoading(false)
  }

  const fetchABookTrades = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: positionsPage,
        limit: 50,
        status: 'OPEN'
      })
      
      const res = await fetch(`${API_URL}/book-management/a-book/trades?${params}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setABookTrades(data.trades)
        setTradePagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching A-Book trades:', error)
    }
    setLoading(false)
  }

  const toggleUserBookType = async (userId, currentBookType) => {
    const newBookType = currentBookType === 'A' ? 'B' : 'A'
    try {
      const res = await fetch(`${API_URL}/book-management/users/${userId}/book-type`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bookType: newBookType })
      })
      const data = await res.json()
      if (data.success) {
        fetchUsers()
        fetchStats()
      }
    } catch (error) {
      console.error('Error toggling book type:', error)
    }
  }

  const bulkUpdateBookType = async (bookType) => {
    if (selectedUsers.length === 0) return
    try {
      const res = await fetch(`${API_URL}/book-management/users/bulk-book-type`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userIds: selectedUsers, bookType })
      })
      const data = await res.json()
      if (data.success) {
        setSelectedUsers([])
        fetchUsers()
        fetchStats()
      }
    } catch (error) {
      console.error('Error bulk updating book type:', error)
    }
  }

  const toggleSelectUser = (userId) => {
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

  const calculatePnl = (trade) => {
    const prices = livePrices[trade.symbol]
    if (!prices || trade.status !== 'OPEN') return trade.realizedPnl || 0
    
    const currentPrice = trade.side === 'BUY' ? prices.bid : prices.ask
    const pnl = trade.side === 'BUY'
      ? (currentPrice - trade.openPrice) * trade.quantity * trade.contractSize
      : (trade.openPrice - currentPrice) * trade.quantity * trade.contractSize
    return pnl - (trade.commission || 0) - (trade.swap || 0)
  }

  const renderBookManagement = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">A-Book Users</p>
              <p className="text-xl font-bold text-white">{stats.aBook?.users || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">B-Book Users</p>
              <p className="text-xl font-bold text-white">{stats.bBook?.users || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">A-Book Open Trades</p>
              <p className="text-xl font-bold text-white">{stats.aBook?.openTrades || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">B-Book Open Trades</p>
              <p className="text-xl font-bold text-white">{stats.bBook?.openTrades || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-green"
          />
        </div>
        <select
          value={bookFilter}
          onChange={(e) => { setBookFilter(e.target.value); setCurrentPage(1) }}
          className="px-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent-green"
        >
          <option value="">All Books</option>
          <option value="A">A-Book Only</option>
          <option value="B">B-Book Only</option>
        </select>
        <button
          onClick={() => { fetchUsers(); fetchStats() }}
          className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-accent-green transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-dark-700 rounded-lg border border-gray-700">
          <span className="text-gray-400">{selectedUsers.length} users selected</span>
          <button
            onClick={() => bulkUpdateBookType('A')}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Move to A-Book
          </button>
          <button
            onClick={() => bulkUpdateBookType('B')}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Move to B-Book
          </button>
          <button
            onClick={() => setSelectedUsers([])}
            className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={selectAllUsers}
                    className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-accent-green focus:ring-accent-green"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Accounts</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Total Trades</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Open Trades</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Book Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => toggleSelectUser(user._id)}
                        className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-accent-green focus:ring-accent-green"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-green to-blue-500 flex items-center justify-center text-white font-medium text-sm">
                          {user.firstName?.charAt(0) || 'U'}
                        </div>
                        <span className="text-white font-medium">{user.firstName || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{user.email}</td>
                    <td className="px-4 py-3 text-center text-white">{user.accountCount || 0}</td>
                    <td className="px-4 py-3 text-center text-white">{user.totalTrades || 0}</td>
                    <td className="px-4 py-3 text-center text-white">{user.openTrades || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.bookType === 'A' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {user.bookType || 'B'}-Book
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleUserBookType(user._id, user.bookType || 'B')}
                        className={`p-2 rounded-lg transition-colors ${
                          user.bookType === 'A'
                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                        title={`Switch to ${user.bookType === 'A' ? 'B' : 'A'}-Book`}
                      >
                        {user.bookType === 'A' ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-400">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, pagination.total)} of {pagination.total} users
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-white">Page {currentPage} of {pagination.pages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
                className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderABook = () => (
    <div className="space-y-6">
      {/* Sub-tabs for Positions and History */}
      <div className="flex gap-4 border-b border-gray-800">
        <button
          onClick={() => setABookSubTab('positions')}
          className={`pb-3 px-1 font-medium transition-colors relative ${
            aBookSubTab === 'positions' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          Positions ({positionsSummary.count || 0})
          {aBookSubTab === 'positions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
        </button>
        <button
          onClick={() => setABookSubTab('history')}
          className={`pb-3 px-1 font-medium transition-colors relative ${
            aBookSubTab === 'history' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          History ({historySummary.count || 0})
          {aBookSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
        </button>
      </div>

      {aBookSubTab === 'positions' ? renderPositions() : renderHistory()}
    </div>
  )

  const renderPositions = () => (
    <div className="space-y-4">
      {/* Positions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Open Positions</p>
              <p className="text-xl font-bold text-white">{positionsSummary.count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Volume</p>
              <p className="text-xl font-bold text-white">{(positionsSummary.totalVolume || 0).toFixed(2)} lots</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Exposure</p>
              <p className="text-xl font-bold text-white">${(positionsSummary.totalExposure || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">A-Book Users</p>
              <p className="text-xl font-bold text-white">{stats.aBook?.users || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchPositions}
          className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-accent-green transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Positions Table */}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Symbol</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Side</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Volume</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Open</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Current</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">PnL</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">SL/TP</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading positions...
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                    No open A-Book positions
                  </td>
                </tr>
              ) : (
                positions.map((pos) => {
                  const pnl = calculatePnl(pos)
                  const currentPrice = livePrices[pos.symbol]
                    ? (pos.side === 'BUY' ? livePrices[pos.symbol].bid : livePrices[pos.symbol].ask)
                    : pos.openPrice
                  
                  return (
                    <tr key={pos._id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="px-3 py-2 text-white font-mono text-xs">{pos.tradeId}</td>
                      <td className="px-3 py-2">
                        <p className="text-white text-sm">{pos.userId?.firstName || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{pos.userId?.email}</p>
                      </td>
                      <td className="px-3 py-2 text-white font-medium">{pos.symbol}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          pos.side === 'BUY' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {pos.side}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-white">{pos.quantity}</td>
                      <td className="px-3 py-2 text-right text-white">{pos.openPrice?.toFixed(5)}</td>
                      <td className="px-3 py-2 text-right text-white">{currentPrice?.toFixed(5)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${pnl >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <span className="text-red-400">{pos.stopLoss || '-'}</span>
                        <span className="text-gray-500"> / </span>
                        <span className="text-green-400">{pos.takeProfit || '-'}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {new Date(pos.openedAt).toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {positionsPagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-400">
              Page {positionsPage} of {positionsPagination.pages} ({positionsPagination.total} positions)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPositionsPage(p => Math.max(1, p - 1))}
                disabled={positionsPage === 1}
                className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPositionsPage(p => Math.min(positionsPagination.pages, p + 1))}
                disabled={positionsPage === positionsPagination.pages}
                className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderHistory = () => (
    <div className="space-y-4">
      {/* History Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Trades</p>
              <p className="text-xl font-bold text-white">{historySummary.count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${(historySummary.totalPnl || 0) >= 0 ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
              <DollarSign className={`w-5 h-5 ${(historySummary.totalPnl || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total PnL</p>
              <p className={`text-xl font-bold ${(historySummary.totalPnl || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {(historySummary.totalPnl || 0) >= 0 ? '+' : ''}${(historySummary.totalPnl || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Volume</p>
              <p className="text-xl font-bold text-white">{(historySummary.totalVolume || 0).toFixed(2)} lots</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Wins</p>
              <p className="text-xl font-bold text-green-400">{historySummary.winCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Losses</p>
              <p className="text-xl font-bold text-red-400">{historySummary.lossCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-accent-green transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* History Table */}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Symbol</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Side</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Volume</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Open</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Close</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">PnL</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Closed By</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Closed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                    No A-Book trade history
                  </td>
                </tr>
              ) : (
                history.map((trade) => (
                  <tr key={trade._id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="px-3 py-2 text-white font-mono text-xs">{trade.tradeId}</td>
                    <td className="px-3 py-2">
                      <p className="text-white text-sm">{trade.userId?.firstName || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{trade.userId?.email}</p>
                    </td>
                    <td className="px-3 py-2 text-white font-medium">{trade.symbol}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        trade.side === 'BUY' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-white">{trade.quantity}</td>
                    <td className="px-3 py-2 text-right text-white">{trade.openPrice?.toFixed(5)}</td>
                    <td className="px-3 py-2 text-right text-white">{trade.closePrice?.toFixed(5)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(trade.realizedPnl || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {(trade.realizedPnl || 0) >= 0 ? '+' : ''}${(trade.realizedPnl || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        trade.closedBy === 'SL' ? 'bg-red-500/20 text-red-400' :
                        trade.closedBy === 'TP' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {trade.closedBy || 'USER'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {new Date(trade.closedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {historyPagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-400">
              Page {historyPage} of {historyPagination.pages} ({historyPagination.total} trades)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setHistoryPage(p => Math.min(historyPagination.pages, p + 1))}
                disabled={historyPage === historyPagination.pages}
                className="p-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-accent-green" />
            Book Management
          </h1>
          <p className="text-gray-400 mt-1">Manage A-Book and B-Book user assignments and view trades</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('book-management')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'book-management'
                ? 'text-accent-green'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Book Management
            {activeTab === 'book-management' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('a-book')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'a-book'
                ? 'text-accent-green'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            A-Book Trades
            {activeTab === 'a-book' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green" />
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'book-management' ? renderBookManagement() : renderABook()}
      </div>
    </AdminLayout>
  )
}

export default AdminBookManagement
