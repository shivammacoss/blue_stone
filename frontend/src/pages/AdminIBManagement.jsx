import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  UserCog,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Users,
  DollarSign,
  Check,
  X,
  RefreshCw,
  Settings,
  ArrowRightLeft,
  Award,
  Save,
  Minus,
  TrendingUp,
  Layers
} from 'lucide-react'

const API_URL = 'http://localhost:5001/api'

const AdminIBManagement = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('ibs')
  const [ibs, setIbs] = useState([])
  const [applications, setApplications] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Referral Plans states
  const [referralPlan, setReferralPlan] = useState(null)
  const [joiningPlan, setJoiningPlan] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // Referral Transfer states
  const [allUsers, setAllUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [targetIB, setTargetIB] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')

  useEffect(() => {
    fetchDashboard()
    fetchIBs()
    fetchApplications()
    fetchAllUsers()
    fetchReferralPlans()
  }, [])

  const fetchReferralPlans = async () => {
    try {
      const [refRes, joinRes] = await Promise.all([
        fetch(`${API_URL}/referral/admin/referral-income-plan`),
        fetch(`${API_URL}/referral/admin/direct-joining-plan`)
      ])
      
      const refData = await refRes.json()
      const joinData = await joinRes.json()
      
      if (refData.success) setReferralPlan(refData.plan)
      if (joinData.success) setJoiningPlan(joinData.plan)
    } catch (error) {
      console.error('Error fetching referral plans:', error)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`)
      const data = await res.json()
      setAllUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/dashboard`)
      const data = await res.json()
      if (data.stats) {
        setDashboard({
          ibs: { total: data.stats.totalIBs, active: data.stats.activeIBs, pending: data.stats.pendingIBs },
          referrals: { total: 0 },
          commissions: { 
            total: { totalCommission: data.stats.totalCommissionPaid || 0 },
            today: { totalCommission: 0 }
          }
        })
      } else if (data.dashboard) {
        setDashboard(data.dashboard)
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    }
  }

  const fetchIBs = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/all`)
      const data = await res.json()
      setIbs(data.ibs || [])
    } catch (error) {
      console.error('Error fetching IBs:', error)
    }
    setLoading(false)
  }

  const fetchApplications = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/pending`)
      const data = await res.json()
      setApplications(data.pending || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
    }
  }

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/approve/${userId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        fetchApplications()
        fetchIBs()
        fetchDashboard()
      }
    } catch (error) {
      console.error('Error approving IB:', error)
    }
  }

  const handleReject = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/reject/${userId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        fetchApplications()
      }
    } catch (error) {
      console.error('Error rejecting IB:', error)
    }
  }

  const handleBlock = async (userId) => {
    if (!confirm('Are you sure you want to block this IB?')) return
    try {
      const res = await fetch(`${API_URL}/ib/admin/block/${userId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        fetchIBs()
      }
    } catch (error) {
      console.error('Error blocking IB:', error)
    }
  }

  const handleTransferReferrals = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user to transfer')
      return
    }
    if (!targetIB) {
      alert('Please select a target IB')
      return
    }

    setTransferLoading(true)
    try {
      const res = await fetch(`${API_URL}/ib/admin/transfer-referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUsers,
          targetIBId: targetIB
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Successfully transferred ${data.transferredCount} users`)
        setSelectedUsers([])
        setTargetIB('')
        fetchAllUsers()
        fetchIBs()
      } else {
        alert(data.message || 'Failed to transfer referrals')
      }
    } catch (error) {
      console.error('Error transferring referrals:', error)
      alert('Failed to transfer referrals')
    }
    setTransferLoading(false)
  }

  // Referral Plan functions
  const saveReferralPlan = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/referral/admin/referral-income-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxLevels: referralPlan.maxLevels,
          levels: referralPlan.levels,
          commissionType: referralPlan.commissionType
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Referral Income Plan saved!' })
        setReferralPlan(data.plan)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving plan' })
    }
    setSaving(false)
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const saveJoiningPlan = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/referral/admin/direct-joining-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxLevels: joiningPlan.maxLevels,
          levels: joiningPlan.levels,
          totalDistribution: joiningPlan.totalDistribution,
          commissionType: joiningPlan.commissionType
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Direct Joining Plan saved!' })
        setJoiningPlan(data.plan)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving plan' })
    }
    setSaving(false)
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const updateReferralLevel = (index, amount) => {
    const newLevels = [...referralPlan.levels]
    newLevels[index] = { ...newLevels[index], amount: parseFloat(amount) || 0 }
    setReferralPlan({ ...referralPlan, levels: newLevels })
  }

  const updateJoiningLevel = (index, percentage) => {
    const newLevels = [...joiningPlan.levels]
    newLevels[index] = { ...newLevels[index], percentage: parseFloat(percentage) || 0 }
    setJoiningPlan({ ...joiningPlan, levels: newLevels })
  }

  const addReferralLevel = () => {
    const newLevel = referralPlan.levels.length + 1
    setReferralPlan({
      ...referralPlan,
      maxLevels: newLevel,
      levels: [...referralPlan.levels, { level: newLevel, amount: 0 }]
    })
  }

  const removeReferralLevel = () => {
    if (referralPlan.levels.length > 1) {
      const newLevels = referralPlan.levels.slice(0, -1)
      setReferralPlan({ ...referralPlan, maxLevels: newLevels.length, levels: newLevels })
    }
  }

  const addJoiningLevel = () => {
    const newLevel = joiningPlan.levels.length + 1
    setJoiningPlan({
      ...joiningPlan,
      maxLevels: newLevel,
      levels: [...joiningPlan.levels, { level: newLevel, percentage: 0 }]
    })
  }

  const removeJoiningLevel = () => {
    if (joiningPlan.levels.length > 1) {
      const newLevels = joiningPlan.levels.slice(0, -1)
      setJoiningPlan({ ...joiningPlan, maxLevels: newLevels.length, levels: newLevels })
    }
  }

  const filteredIBs = ibs.filter(ib => 
    ib.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ib.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ib.referralCode?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredUsers = allUsers.filter(user => 
    user.firstName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
  )

  return (
    <AdminLayout title="IB Management" subtitle="Manage Introducing Brokers and Referral Plans">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <UserCog size={18} className="text-blue-500" />
            <p className="text-gray-500 text-sm">Total IBs</p>
          </div>
          <p className="text-white text-2xl font-bold">{dashboard?.ibs?.total || 0}</p>
          <p className="text-yellow-500 text-xs mt-1">{dashboard?.ibs?.pending || 0} pending</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-green-500" />
            <p className="text-gray-500 text-sm">Total Referrals</p>
          </div>
          <p className="text-white text-2xl font-bold">{dashboard?.referrals?.total || 0}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-purple-500" />
            <p className="text-gray-500 text-sm">Total Commissions</p>
          </div>
          <p className="text-white text-2xl font-bold">${(dashboard?.commissions?.total?.totalCommission || 0).toFixed(2)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-orange-500" />
            <p className="text-gray-500 text-sm">Active IBs</p>
          </div>
          <p className="text-white text-2xl font-bold">{dashboard?.ibs?.active || 0}</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'ibs', label: 'Active IBs', count: dashboard?.ibs?.active },
          { id: 'applications', label: 'Applications', count: applications.length },
          { id: 'referral-income', label: 'Referral Income Plan', icon: Layers },
          { id: 'joining-income', label: 'Direct Joining Plan', icon: DollarSign },
          { id: 'transfer', label: 'Referral Transfer', icon: ArrowRightLeft }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'bg-accent-green text-black' 
                : 'bg-dark-800 text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon && <tab.icon size={16} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-black/20' : 'bg-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active IBs Tab */}
      {activeTab === 'ibs' && (
        <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">Active IBs</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search IBs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-500" />
            </div>
          ) : filteredIBs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No IBs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IB</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Referral Code</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Referrals</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Earnings</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredIBs.map((ib) => (
                    <tr key={ib._id} className="hover:bg-dark-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-400 font-medium text-sm">{ib.firstName?.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{ib.firstName} {ib.lastName}</p>
                            <p className="text-gray-500 text-xs">{ib.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-accent-green/20 text-accent-green rounded text-sm font-mono">
                          {ib.referralCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-white">{ib.referralCount || 0}</td>
                      <td className="px-4 py-3 text-right text-green-400">${(ib.totalEarnings || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ib.ibStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          ib.ibStatus === 'BLOCKED' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {ib.ibStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-white">
                            <Eye size={16} />
                          </button>
                          {ib.ibStatus === 'ACTIVE' && (
                            <button 
                              onClick={() => handleBlock(ib._id)}
                              className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-red-400"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Pending Applications</h2>
          </div>

          {applications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No pending applications</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {applications.map((app) => (
                <div key={app._id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <span className="text-yellow-500 font-medium">{app.firstName?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{app.firstName} {app.lastName}</p>
                      <p className="text-gray-500 text-sm">{app.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(app._id)}
                      className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(app._id)}
                      className="flex items-center gap-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Referral Income Plan Tab */}
      {activeTab === 'referral-income' && referralPlan && (
        <div className="space-y-6">
          <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Referral Income Plan (Per Lot)</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Commission distributed to upline chain when referred users trade
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={addReferralLevel}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                >
                  <Plus size={16} /> Add Level
                </button>
                <button
                  onClick={removeReferralLevel}
                  disabled={referralPlan.levels.length <= 1}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                >
                  <Minus size={16} /> Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              {referralPlan.levels.map((level, index) => (
                <div key={level.level} className="bg-dark-700 rounded-lg p-4 border border-gray-700">
                  <label className="block text-gray-400 text-sm mb-2">Level {level.level}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={level.amount}
                      onChange={(e) => updateReferralLevel(index, e.target.value)}
                      className="w-full px-3 py-2 bg-dark-600 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-accent-green"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">per lot</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="text-gray-400">
                <span className="font-medium text-white">{referralPlan.levels.length}</span> levels |
                Total per lot: <span className="font-medium text-accent-green">${referralPlan.levels.reduce((sum, l) => sum + l.amount, 0).toFixed(2)}</span>
              </div>
              <button
                onClick={saveReferralPlan}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent-green text-black font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Save Plan
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-medium text-white mb-4">Commission Preview (1 lot trade)</h3>
            <div className="flex flex-wrap gap-2">
              {referralPlan.levels.map((level) => (
                <div key={level.level} className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <span className="text-blue-400 font-medium">L{level.level}:</span>
                  <span className="text-white ml-2">${level.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Direct Joining Plan Tab */}
      {activeTab === 'joining-income' && joiningPlan && (
        <div className="space-y-6">
          <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Direct Joining Income Plan (%)</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Commission distributed to upline chain when new users deposit
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={addJoiningLevel}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                >
                  <Plus size={16} /> Add Level
                </button>
                <button
                  onClick={removeJoiningLevel}
                  disabled={joiningPlan.levels.length <= 1}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                >
                  <Minus size={16} /> Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              {joiningPlan.levels.map((level, index) => (
                <div key={level.level} className="bg-dark-700 rounded-lg p-4 border border-gray-700">
                  <label className="block text-gray-400 text-sm mb-2">Level {level.level}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={level.percentage}
                      onChange={(e) => updateJoiningLevel(index, e.target.value)}
                      className="w-full px-3 py-2 bg-dark-600 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-accent-green"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="text-gray-400">
                <span className="font-medium text-white">{joiningPlan.levels.length}</span> levels |
                Total: <span className="font-medium text-purple-400">{joiningPlan.levels.reduce((sum, l) => sum + l.percentage, 0).toFixed(1)}%</span>
              </div>
              <button
                onClick={saveJoiningPlan}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent-green text-black font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Save Plan
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-medium text-white mb-4">Commission Preview ($100 deposit)</h3>
            <div className="flex flex-wrap gap-2">
              {joiningPlan.levels.map((level) => (
                <div key={level.level} className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <span className="text-purple-400 font-medium">L{level.level}:</span>
                  <span className="text-white ml-2">${(100 * level.percentage / 100).toFixed(2)}</span>
                  <span className="text-gray-500 ml-1">({level.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Referral Transfer Tab */}
      {activeTab === 'transfer' && (
        <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Transfer Referrals</h2>
            <p className="text-gray-500 text-sm">Move users from one IB to another</p>
          </div>

          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Select Users</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedUsers(filteredUsers.map(u => u._id))} className="text-xs text-blue-400 hover:underline">Select All</button>
                  <button onClick={() => setSelectedUsers([])} className="text-xs text-gray-400 hover:underline">Clear</button>
                </div>
              </div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm focus:outline-none"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredUsers.slice(0, 50).map(user => (
                  <label key={user._id} className="flex items-center gap-3 p-2 hover:bg-dark-700 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => {
                        setSelectedUsers(prev => 
                          prev.includes(user._id) 
                            ? prev.filter(id => id !== user._id)
                            : [...prev, user._id]
                        )
                      }}
                      className="rounded border-gray-600"
                    />
                    <div>
                      <p className="text-white text-sm">{user.firstName} {user.lastName}</p>
                      <p className="text-gray-500 text-xs">{user.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-2">{selectedUsers.length} users selected</p>
            </div>

            {/* Target IB Selection */}
            <div>
              <h3 className="text-white font-medium mb-3">Select Target IB</h3>
              <select
                value={targetIB}
                onChange={(e) => setTargetIB(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white focus:outline-none mb-4"
              >
                <option value="">Select an IB...</option>
                {ibs.filter(ib => ib.ibStatus === 'ACTIVE').map(ib => (
                  <option key={ib._id} value={ib._id}>
                    {ib.firstName} {ib.lastName} ({ib.referralCode})
                  </option>
                ))}
              </select>

              <button
                onClick={handleTransferReferrals}
                disabled={transferLoading || selectedUsers.length === 0 || !targetIB}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-green text-black font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50"
              >
                {transferLoading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                Transfer {selectedUsers.length} Users
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminIBManagement
