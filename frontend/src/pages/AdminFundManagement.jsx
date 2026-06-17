import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Clock,
  Building2,
  Smartphone,
  Download
} from 'lucide-react'
import { API_URL, API_BASE_URL } from '../config/api'
import toast from 'react-hot-toast'

const AdminFundManagement = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterAccountType, setFilterAccountType] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState({ deposits: 0, withdrawals: 0, pending: 0, net: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedTxn, setSelectedTxn] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [filterType, filterAccountType, startDate, endDate])

  // Format a date as the LOCAL yyyy-mm-dd (same day the admin sees in the table),
  // so date-range filtering compares like-for-like with the <input type="date"> values.
  const toLocalYmd = (date) => {
    const d = new Date(date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/wallet/admin/transactions`)
      const data = await res.json()
      if (data.transactions) {
        let filtered = data.transactions
        if (filterType !== 'all') {
          filtered = filtered.filter(t => t.type?.toLowerCase() === filterType)
        }
        // Account type filter (forex vs challenge)
        if (filterAccountType === 'challenge') {
          filtered = filtered.filter(t => 
            t.type?.toLowerCase() === 'challenge_purchase' || 
            t.type?.toLowerCase().includes('challenge')
          )
        } else if (filterAccountType === 'forex') {
          filtered = filtered.filter(t => 
            t.type?.toLowerCase() !== 'challenge_purchase' && 
            !t.type?.toLowerCase().includes('challenge')
          )
        }
        // Date filter - compare the transaction's LOCAL date (yyyy-mm-dd) against the
        // picked dates as plain strings. This matches the date the admin sees in the
        // table and avoids timezone off-by-one issues from Date math.
        if (startDate || endDate) {
          filtered = filtered.filter(t => {
            if (!t.createdAt) return false
            const ymd = toLocalYmd(t.createdAt)
            if (startDate && ymd < startDate) return false
            if (endDate && ymd > endDate) return false
            return true
          })
        }
        setTransactions(filtered)
        
        // Calculate stats
        const deposits = data.transactions.filter(t => t.type?.toUpperCase() === 'DEPOSIT' && t.status?.toUpperCase() === 'APPROVED')
          .reduce((sum, t) => sum + (t.amount || 0), 0)
        const withdrawals = data.transactions.filter(t => t.type?.toUpperCase() === 'WITHDRAWAL' && t.status?.toUpperCase() === 'APPROVED')
          .reduce((sum, t) => sum + (t.amount || 0), 0)
        const pending = data.transactions.filter(t => t.status?.toUpperCase() === 'PENDING').length
        
        setStats({
          deposits,
          withdrawals,
          pending,
          net: deposits - withdrawals
        })
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
    setLoading(false)
  }

  const handleApprove = async (txnId) => {
    try {
      const res = await fetch(`${API_URL}/wallet/transaction/${txnId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminRemarks: '' })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Transaction approved successfully!')
        fetchTransactions()
      } else {
        toast.error(data.message || 'Error approving transaction')
      }
    } catch (error) {
      console.error('Error approving transaction:', error)
      toast.error('Error approving transaction')
    }
  }

  const handleReject = async (txnId) => {
    const remarks = prompt('Enter rejection reason (optional):')
    try {
      const res = await fetch(`${API_URL}/wallet/transaction/${txnId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminRemarks: remarks || '' })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Transaction rejected!')
        fetchTransactions()
      } else {
        toast.error(data.message || 'Error rejecting transaction')
      }
    } catch (error) {
      console.error('Error rejecting transaction:', error)
      toast.error('Error rejecting transaction')
    }
  }

  const filteredTransactions = transactions.filter(txn => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    const fullName = `${txn.userId?.firstName || ''} ${txn.userId?.lastName || ''}`.trim().toLowerCase()
    return (
      (txn.transactionRef || txn._id || '').toLowerCase().includes(q) ||
      txn.userId?.firstName?.toLowerCase().includes(q) ||
      txn.userId?.lastName?.toLowerCase().includes(q) ||
      fullName.includes(q) ||
      txn.userId?.email?.toLowerCase().includes(q)
    )
  })

  const exportToExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No transactions to export')
      return
    }
    
    const formatDateForExcel = (dateStr) => {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${year}-${month}-${day}`
    }
    
    const headers = ['Transaction ID', 'User', 'Type', 'Amount', 'Bonus', 'Total', 'Method', 'Status', 'Date']
    const rows = filteredTransactions.map(txn => [
      txn.transactionRef || txn._id || '',
      (txn.userId?.firstName || txn.userId?.email || 'N/A').replace(/,/g, ' '),
      txn.type || '',
      txn.amount || 0,
      txn.bonus || 0,
      (txn.amount || 0) + (txn.bonus || 0),
      txn.method || '',
      txn.status || '',
      formatDateForExcel(txn.createdAt)
    ])
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    toast.success('Transactions exported successfully')
  }

  const getStatusColor = (status) => {
    const s = status?.toLowerCase()
    if (s === 'approved') return 'bg-green-500/20 text-green-500'
    if (s === 'pending') return 'bg-yellow-500/20 text-yellow-500'
    if (s === 'rejected') return 'bg-red-500/20 text-red-500'
    return 'bg-gray-500/20 text-gray-400'
  }

  const isPending = (status) => status?.toLowerCase() === 'pending'

  const viewTransactionDetails = async (txn) => {
    setSelectedTxn(txn)
    setShowDetailsModal(true)
    
    // Fetch user details including bank info
    try {
      const res = await fetch(`${API_URL}/auth/user/${txn.userId?._id || txn.userId}`)
      const data = await res.json()
      if (data.user) {
        setUserDetails(data.user)
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedTxn(null)
    setUserDetails(null)
  }

  return (
    <AdminLayout title="Fund Management" subtitle="Manage deposits and withdrawals">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={18} className="text-green-500" />
            <p className="text-gray-500 text-sm">Total Deposits</p>
          </div>
          <p className="text-white text-2xl font-bold">${stats.deposits.toLocaleString()}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={18} className="text-red-500" />
            <p className="text-gray-500 text-sm">Total Withdrawals</p>
          </div>
          <p className="text-white text-2xl font-bold">${stats.withdrawals.toLocaleString()}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-yellow-500" />
            <p className="text-gray-500 text-sm">Pending Requests</p>
          </div>
          <p className="text-white text-2xl font-bold">{stats.pending}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className="text-purple-500" />
            <p className="text-gray-500 text-sm">Net Balance</p>
          </div>
          <p className="text-white text-2xl font-bold">${stats.net.toLocaleString()}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border-b border-gray-800 overflow-x-auto">
          <h2 className="text-white font-semibold text-lg whitespace-nowrap">All Transactions</h2>
          <div className="flex flex-row items-center gap-3 flex-nowrap min-w-max">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by user or transaction ID..."
                className="w-64 bg-dark-700 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-white focus:outline-none focus:border-gray-600"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gray-600"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
            </select>
            <select
              value={filterAccountType}
              onChange={(e) => setFilterAccountType(e.target.value)}
              className="bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gray-600"
            >
              <option value="all">All Accounts</option>
              <option value="forex">Forex</option>
              <option value="challenge">Challenge</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-dark-700 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                title="Start Date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-dark-700 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                title="End Date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => exportToExcel()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
              <Download size={18} /> Excel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading transactions...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-yellow-500 font-medium text-lg mb-2">⚠️ No Data Found</p>
              <p className="text-gray-400 text-sm">
                {(startDate || endDate) 
                  ? `No transactions found for the selected date range${startDate ? ` from ${new Date(startDate).toLocaleDateString('en-GB')}` : ''}${endDate ? ` to ${new Date(endDate).toLocaleDateString('en-GB')}` : ''}.`
                  : 'No transactions found matching your filters.'}
              </p>
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="mt-4 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 text-sm"
                >
                  Clear Date Filter
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden p-4 space-y-3">
              {filteredTransactions.map((txn) => (
                <div key={txn._id} className="bg-dark-700 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        txn.type?.toUpperCase() === 'DEPOSIT' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? (
                          <ArrowDownRight size={16} className="text-green-500" />
                        ) : (
                          <ArrowUpRight size={16} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{txn.userId?.firstName || txn.userId?.email}</p>
                        <p className="text-gray-500 text-xs">{txn.transactionRef || txn._id?.slice(-8)}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(txn.status)}`}>
                      {txn.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Amount</p>
                      <p className={txn.type?.toUpperCase() === 'DEPOSIT' ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? '+' : '-'}${(txn.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Bonus</p>
                      <p className="text-green-500 font-medium">
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? (
                          txn.bonusAmount && txn.bonusAmount > 0 ? `+$${txn.bonusAmount.toLocaleString()}` : '$0'
                        ) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="text-white font-medium">
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? `$${(txn.totalAmount || (txn.amount + (txn.bonusAmount || 0))).toLocaleString()}` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Method</p>
                      <p className="text-white">{txn.paymentMethod || '-'}</p>
                    </div>
                  </div>
                  {isPending(txn.status) && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-600">
                      <button onClick={() => handleApprove(txn._id)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-500/20 text-green-500 rounded-lg text-sm">
                        <Check size={14} /> Approve
                      </button>
                      <button onClick={() => handleReject(txn._id)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500/20 text-red-500 rounded-lg text-sm">
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Transaction ID</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">User</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Type</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Amount</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Bonus</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Total</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Method</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Status</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Date</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn._id} className="border-b border-gray-800 hover:bg-dark-700/50">
                      <td className="py-4 px-4 text-white font-mono text-sm">{txn.transactionRef || txn._id?.slice(-8)}</td>
                      <td className="py-4 px-4 text-white">{txn.userId?.firstName || txn.userId?.email}</td>
                      <td className="py-4 px-4">
                        <span className={`flex items-center gap-1 ${txn.type?.toUpperCase() === 'DEPOSIT' ? 'text-green-500' : 'text-red-500'}`}>
                          {txn.type?.toUpperCase() === 'DEPOSIT' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                          {txn.type}
                        </span>
                      </td>
                      <td className={`py-4 px-4 font-medium ${txn.type?.toUpperCase() === 'DEPOSIT' ? 'text-green-500' : 'text-red-500'}`}>
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? '+' : '-'}${(txn.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? (
                          txn.bonusAmount && txn.bonusAmount > 0 ? (
                            <span className="text-green-500 font-medium">+${txn.bonusAmount.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-500">$0</span>
                          )
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {txn.type?.toUpperCase() === 'DEPOSIT' ? (
                          <span className="text-white font-medium">
                            ${(txn.totalAmount || (txn.amount + (txn.bonusAmount || 0))).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-400">{txn.paymentMethod || '-'}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(txn.status)}`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-400">{new Date(txn.createdAt).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => viewTransactionDetails(txn)}
                            className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-white"
                          >
                            <Eye size={16} />
                          </button>
                          {isPending(txn.status) && (
                            <>
                              <button onClick={() => handleApprove(txn._id)} className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-green-500">
                                <Check size={16} />
                              </button>
                              <button onClick={() => handleReject(txn._id)} className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-red-500">
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Transaction Details Modal */}
      {showDetailsModal && selectedTxn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Transaction Details</h2>
              <button onClick={closeDetailsModal} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Transaction Info */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  {selectedTxn.type?.toLowerCase() === 'withdrawal' ? (
                    <ArrowUpRight size={18} className="text-red-500" />
                  ) : (
                    <ArrowDownRight size={18} className="text-green-500" />
                  )}
                  {selectedTxn.type} Request
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-gray-500">Transaction ID</p>
                    <p className="text-white font-mono text-xs break-all">{selectedTxn.transactionRef || selectedTxn._id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className={`text-lg font-bold ${selectedTxn.type?.toLowerCase() === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                      ${selectedTxn.amount?.toLocaleString()}
                    </p>
                  </div>
                  {selectedTxn.type?.toLowerCase() === 'deposit' && (
                    <div>
                      <p className="text-gray-500">Bonus</p>
                      <p className="text-green-500 font-bold">
                        {selectedTxn.bonusAmount && selectedTxn.bonusAmount > 0 
                          ? `+$${selectedTxn.bonusAmount.toLocaleString()}` 
                          : '$0'}
                      </p>
                    </div>
                  )}
                  {selectedTxn.type?.toLowerCase() === 'deposit' && (
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="text-white font-bold">
                        ${(selectedTxn.totalAmount || (selectedTxn.amount + (selectedTxn.bonusAmount || 0))).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedTxn.status)}`}>
                      {selectedTxn.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500">Payment Method</p>
                    <p className="text-white">{selectedTxn.paymentMethod || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="text-white">{new Date(selectedTxn.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedTxn.transactionRef && (
                    <div className="col-span-2">
                      <p className="text-gray-500">Transaction Reference</p>
                      <p className="text-white font-mono">{selectedTxn.transactionRef}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Screenshot */}
              {selectedTxn.screenshot && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-white font-semibold mb-3">Payment Screenshot</h3>
                  <div className="bg-dark-700 rounded-lg p-2">
                    <img 
                      src={selectedTxn.screenshot.startsWith('http') ? selectedTxn.screenshot : `${API_BASE_URL}${selectedTxn.screenshot}`} 
                      alt="Payment proof" 
                      className="w-full rounded-lg max-h-64 object-contain cursor-pointer"
                      onClick={() => window.open(selectedTxn.screenshot.startsWith('http') ? selectedTxn.screenshot : `${API_BASE_URL}${selectedTxn.screenshot}`, '_blank')}
                    />
                    <p className="text-gray-500 text-xs text-center mt-2">Click to view full image</p>
                  </div>
                </div>
              )}

              {/* User Info */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-white font-semibold mb-3">User Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="text-white">{userDetails?.firstName || selectedTxn.userId?.firstName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="text-white">{userDetails?.email || selectedTxn.userId?.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Bank/UPI Details (for withdrawals) */}
              {selectedTxn.type?.toLowerCase() === 'withdrawal' && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    {selectedTxn.bankAccountDetails?.type === 'UPI' ? (
                      <><Smartphone size={16} /> UPI Details</>
                    ) : (
                      <><Building2 size={16} /> Bank Details</>
                    )}
                  </h3>
                  
                  {/* Show bank details from transaction if available */}
                  {selectedTxn.bankAccountDetails?.type === 'Bank' ? (
                    <div className="bg-dark-700 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bank Name</span>
                        <span className="text-white">{selectedTxn.bankAccountDetails.bankName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Number</span>
                        <span className="text-white font-mono">{selectedTxn.bankAccountDetails.accountNumber || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">IFSC Code</span>
                        <span className="text-white font-mono">{selectedTxn.bankAccountDetails.ifscCode || '-'}</span>
                      </div>
                    </div>
                  ) : selectedTxn.bankAccountDetails?.type === 'UPI' ? (
                    <div className="bg-dark-700 rounded-lg p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">UPI ID</span>
                        <span className="text-purple-400 font-mono">{selectedTxn.bankAccountDetails.upiId}</span>
                      </div>
                    </div>
                  ) : userDetails?.bankDetails?.accountNumber ? (
                    <div className="bg-dark-700 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bank Name</span>
                        <span className="text-white">{userDetails.bankDetails.bankName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Number</span>
                        <span className="text-white font-mono">{userDetails.bankDetails.accountNumber || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">IFSC Code</span>
                        <span className="text-white font-mono">{userDetails.bankDetails.ifscCode || '-'}</span>
                      </div>
                    </div>
                  ) : userDetails?.upiId ? (
                    <div className="bg-dark-700 rounded-lg p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">UPI ID</span>
                        <span className="text-purple-400 font-mono">{userDetails.upiId}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <p className="text-yellow-400 text-sm">⚠️ No payment details available for this withdrawal</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {isPending(selectedTxn.status) && (
                <div className="flex gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => { handleReject(selectedTxn._id); closeDetailsModal(); }}
                    className="flex-1 py-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 flex items-center justify-center gap-2"
                  >
                    <X size={16} /> Reject
                  </button>
                  <button
                    onClick={() => { handleApprove(selectedTxn._id); closeDetailsModal(); }}
                    className="flex-1 py-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminFundManagement
