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
  Percent,
  Check,
  X,
  RefreshCw,
  Settings,
  ChevronDown,
  ArrowRightLeft,
  UserPlus
} from 'lucide-react'

const API_URL = 'http://localhost:5001/api'

const AdminIBManagement = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('ibs') // ibs, applications, plans, settings, transfer
  const [ibs, setIbs] = useState([])
  const [applications, setApplications] = useState([])
  const [plans, setPlans] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedIB, setSelectedIB] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  
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
    fetchPlans()
    fetchSettings()
    fetchAllUsers()
  }, [])

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`)
      const data = await res.json()
      setAllUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
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
        alert(`Successfully transferred ${data.transferredCount} users to the selected IB`)
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

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllUsers = () => {
    const filteredUserIds = filteredUsers.map(u => u._id)
    setSelectedUsers(filteredUserIds)
  }

  const deselectAllUsers = () => {
    setSelectedUsers([])
  }

  const filteredUsers = allUsers.filter(user => 
    user.firstName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user._id?.includes(userSearchTerm)
  )

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/dashboard`)
      const data = await res.json()
      if (data.dashboard) setDashboard(data.dashboard)
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

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/plans`)
      const data = await res.json()
      setPlans(data.plans || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/settings`)
      const data = await res.json()
      if (data.settings) setSettings(data.settings)
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleApprove = async (userId, planId = null) => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/approve/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planId })
      })
      const data = await res.json()
      if (data.success) {
        alert('IB approved successfully!')
        fetchApplications()
        fetchIBs()
        fetchDashboard()
      } else {
        alert(data.message || 'Failed to approve')
      }
    } catch (error) {
      console.error('Error approving:', error)
      alert('Failed to approve IB')
    }
  }

  const handleBlock = async (userId) => {
    const reason = prompt('Enter block reason:')
    if (!reason) return

    try {
      const res = await fetch(`${API_URL}/ib/admin/block/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await res.json()
      if (data.success) {
        alert('IB blocked')
        fetchIBs()
        fetchDashboard()
      }
    } catch (error) {
      console.error('Error blocking:', error)
    }
  }

  const handleSuspend = async (ibId) => {
    if (!confirm('Are you sure you want to suspend this IB?')) return

    try {
      const res = await fetch(`${API_URL}/ib/admin/suspend/${ibId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: 'admin' })
      })
      const data = await res.json()
      if (data.ibUser) {
        alert('IB suspended')
        fetchIBs()
      }
    } catch (error) {
      console.error('Error suspending:', error)
    }
  }

  const handleSavePlan = async (planData) => {
    try {
      const url = editingPlan 
        ? `${API_URL}/ib/admin/plans/${editingPlan._id}`
        : `${API_URL}/ib/admin/plans`
      const method = editingPlan ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData)
      })
      const data = await res.json()
      if (data.success || data.plan) {
        alert(editingPlan ? 'Plan updated!' : 'Plan created!')
        setShowPlanModal(false)
        setEditingPlan(null)
        fetchPlans()
      } else {
        alert(data.message || 'Failed to save plan')
      }
    } catch (error) {
      console.error('Error saving plan:', error)
      alert('Failed to save plan')
    }
  }

  const handleUpdateSettings = async (newSettings) => {
    try {
      const res = await fetch(`${API_URL}/ib/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      const data = await res.json()
      if (data.settings) {
        setSettings(data.settings)
        alert('Settings updated!')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
    }
  }

  const filteredIBs = ibs.filter(ib => 
    ib.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ib.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ib.referralCode?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <AdminLayout title="IB Management" subtitle="Manage Introducing Brokers and partners">
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
          <p className="text-green-500 text-xs mt-1">Today: ${(dashboard?.commissions?.today?.totalCommission || 0).toFixed(2)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-orange-500" />
            <p className="text-gray-500 text-sm">Pending Withdrawals</p>
          </div>
          <p className="text-white text-2xl font-bold">${(dashboard?.withdrawals?.pending?.totalPending || 0).toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">{dashboard?.withdrawals?.pending?.count || 0} requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'ibs', label: 'Active IBs', count: dashboard?.ibs?.active },
          { id: 'applications', label: 'Applications', count: applications.length },
          { id: 'plans', label: 'Commission Plans', count: plans.length },
          { id: 'transfer', label: 'Referral Transfer', icon: ArrowRightLeft },
          { id: 'settings', label: 'Settings' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'bg-blue-500 text-white' 
                : 'bg-dark-800 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-700'
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border-b border-gray-800">
            <h2 className="text-white font-semibold text-lg">Active IB Partners</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search IBs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
                />
              </div>
              <button 
                onClick={() => { fetchIBs(); fetchDashboard(); }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredIBs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No IBs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">IB Partner</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Referral Code</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Plan</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Referrals</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Earnings</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Status</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIBs.map((ib) => (
                    <tr key={ib._id} className="border-b border-gray-800 hover:bg-dark-700/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-500 font-medium">{ib.firstName?.charAt(0) || '?'}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{ib.firstName} {ib.lastName}</p>
                            <p className="text-gray-500 text-sm">{ib.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-white font-mono">{ib.referralCode || '-'}</td>
                      <td className="py-4 px-4 text-white">{ib.ibPlanId?.name || 'Default'}</td>
                      <td className="py-4 px-4 text-white">{ib.ibLevel || 0}</td>
                      <td className="py-4 px-4 text-green-500 font-medium">-</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          ib.ibStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : 
                          ib.ibStatus === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                          ib.ibStatus === 'BLOCKED' ? 'bg-red-500/20 text-red-500' :
                          'bg-gray-500/20 text-gray-500'
                        }`}>
                          {ib.ibStatus || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <button className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-white">
                            <Eye size={16} />
                          </button>
                          {ib.ibStatus === 'ACTIVE' && (
                            <button 
                              onClick={() => handleBlock(ib._id)}
                              className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-red-500"
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
          <div className="p-4 sm:p-5 border-b border-gray-800">
            <h2 className="text-white font-semibold text-lg">Pending Applications</h2>
          </div>

          {applications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No pending applications</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {applications.map((app) => (
                <div key={app._id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <span className="text-yellow-500 font-medium">{app.firstName?.charAt(0) || '?'}</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{app.firstName} {app.lastName}</p>
                      <p className="text-gray-500 text-sm">{app.email}</p>
                      <p className="text-gray-600 text-xs">Applied: {new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      className="bg-dark-700 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      onChange={(e) => {
                        if (e.target.value) handleApprove(app._id, e.target.value === 'default' ? null : e.target.value)
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select Plan & Approve</option>
                      {plans.map(plan => (
                        <option key={plan._id} value={plan._id}>{plan.name}</option>
                      ))}
                      <option value="default">Default Plan</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800">
            <h2 className="text-white font-semibold text-lg">Commission Plans</h2>
            <button
              onClick={() => { setEditingPlan(null); setShowPlanModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Plus size={16} /> Add Plan
            </button>
          </div>

          <div className="divide-y divide-gray-800">
            {plans.map((plan) => (
              <div key={plan._id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-medium flex items-center gap-2">
                      {plan.name}
                      {plan.isDefault && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 text-xs rounded">Default</span>}
                    </p>
                    <p className="text-gray-500 text-sm">{plan.description}</p>
                  </div>
                  <button
                    onClick={() => { setEditingPlan(plan); setShowPlanModal(true); }}
                    className="p-2 hover:bg-dark-600 rounded-lg text-gray-400 hover:text-white"
                  >
                    <Edit size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div className="bg-dark-700 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Level 1</p>
                    <p className="text-white font-medium">{plan.commissionType === 'PER_LOT' ? '$' : ''}{plan.levelCommissions?.level1 || 0}{plan.commissionType === 'PERCENTAGE' ? '%' : '/lot'}</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Level 2</p>
                    <p className="text-white font-medium">{plan.commissionType === 'PER_LOT' ? '$' : ''}{plan.levelCommissions?.level2 || 0}{plan.commissionType === 'PERCENTAGE' ? '%' : '/lot'}</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Level 3</p>
                    <p className="text-white font-medium">{plan.commissionType === 'PER_LOT' ? '$' : ''}{plan.levelCommissions?.level3 || 0}{plan.commissionType === 'PERCENTAGE' ? '%' : '/lot'}</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Level 4</p>
                    <p className="text-white font-medium">{plan.commissionType === 'PER_LOT' ? '$' : ''}{plan.levelCommissions?.level4 || 0}{plan.commissionType === 'PERCENTAGE' ? '%' : '/lot'}</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Level 5</p>
                    <p className="text-white font-medium">{plan.commissionType === 'PER_LOT' ? '$' : ''}{plan.levelCommissions?.level5 || 0}{plan.commissionType === 'PERCENTAGE' ? '%' : '/lot'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="bg-dark-800 rounded-xl border border-gray-800 p-6">
          <h2 className="text-white font-semibold text-lg mb-6">IB System Settings</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">IB System Enabled</p>
                <p className="text-gray-500 text-sm">Enable or disable the entire IB system</p>
              </div>
              <button
                onClick={() => handleUpdateSettings({ isEnabled: !settings.isEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.isEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.isEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Allow New Applications</p>
                <p className="text-gray-500 text-sm">Allow users to apply as IBs</p>
              </div>
              <button
                onClick={() => handleUpdateSettings({ allowNewApplications: !settings.allowNewApplications })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.allowNewApplications ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.allowNewApplications ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Auto-Approve Applications</p>
                <p className="text-gray-500 text-sm">Automatically approve new IB applications</p>
              </div>
              <button
                onClick={() => handleUpdateSettings({ autoApprove: !settings.autoApprove })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.autoApprove ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.autoApprove ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">KYC Required</p>
                <p className="text-gray-500 text-sm">Require KYC approval to become an IB</p>
              </div>
              <button
                onClick={() => handleUpdateSettings({ ibRequirements: { ...settings.ibRequirements, kycRequired: !settings.ibRequirements?.kycRequired } })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.ibRequirements?.kycRequired ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.ibRequirements?.kycRequired ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Withdrawal Approval Required</p>
                <p className="text-gray-500 text-sm">Require admin approval for IB withdrawals</p>
              </div>
              <button
                onClick={() => handleUpdateSettings({ commissionSettings: { ...settings.commissionSettings, withdrawalApprovalRequired: !settings.commissionSettings?.withdrawalApprovalRequired } })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.commissionSettings?.withdrawalApprovalRequired ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.commissionSettings?.withdrawalApprovalRequired ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <p className="text-white font-medium mb-2">Minimum Withdrawal Amount</p>
              <input
                type="number"
                value={settings.commissionSettings?.minWithdrawalAmount || 50}
                onChange={(e) => handleUpdateSettings({ commissionSettings: { ...settings.commissionSettings, minWithdrawalAmount: parseFloat(e.target.value) } })}
                className="bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white w-32"
              />
            </div>
          </div>
        </div>
      )}

      {/* Referral Transfer Tab */}
      {activeTab === 'transfer' && (
        <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft size={20} className="text-purple-500" />
              <h2 className="text-white font-semibold text-lg">Referral Transfer</h2>
            </div>
            <p className="text-gray-500 text-sm">Transfer users to any IB partner. Select users and choose the target IB.</p>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Target IB Selection */}
            <div className="bg-dark-700 rounded-lg p-4">
              <label className="text-gray-400 text-sm block mb-2">Select Target IB</label>
              <select
                value={targetIB}
                onChange={(e) => setTargetIB(e.target.value)}
                className="w-full bg-dark-600 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Select an IB --</option>
                {ibs.filter(ib => ib.ibStatus === 'ACTIVE').map(ib => (
                  <option key={ib._id} value={ib._id}>
                    {ib.firstName} {ib.lastName} ({ib.email}) - Code: {ib.referralCode || 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            {/* User Search and Selection */}
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Select Users to Transfer</label>
                  <p className="text-gray-500 text-xs">{selectedUsers.length} users selected</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllUsers}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-500 rounded-lg text-sm hover:bg-blue-500/30"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllUsers}
                    className="px-3 py-1.5 bg-gray-600 text-gray-300 rounded-lg text-sm hover:bg-gray-500"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="relative mb-3">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users by name, email or ID..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full bg-dark-600 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No users found</p>
                ) : (
                  filteredUsers.map(user => (
                    <div
                      key={user._id}
                      onClick={() => toggleUserSelection(user._id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedUsers.includes(user._id)
                          ? 'bg-purple-500/20 border border-purple-500/50'
                          : 'bg-dark-600 border border-transparent hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedUsers.includes(user._id)
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-500'
                        }`}>
                          {selectedUsers.includes(user._id) && <Check size={12} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{user.firstName} {user.lastName || ''}</p>
                          <p className="text-gray-500 text-xs">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs font-mono">{user._id?.slice(-8)}</p>
                        {user.referredBy && (
                          <p className="text-yellow-500 text-xs">Current IB: {user.referredBy?.slice(-6)}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Transfer Button */}
            <div className="flex justify-end">
              <button
                onClick={handleTransferReferrals}
                disabled={transferLoading || selectedUsers.length === 0 || !targetIB}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
                  transferLoading || selectedUsers.length === 0 || !targetIB
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {transferLoading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={18} />
                    Transfer {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {showPlanModal && (
        <PlanModal
          plan={editingPlan}
          onSave={handleSavePlan}
          onClose={() => { setShowPlanModal(false); setEditingPlan(null); }}
        />
      )}
    </AdminLayout>
  )
}

// Plan Modal Component
const PlanModal = ({ plan, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    maxLevels: plan?.maxLevels || 3,
    commissionType: plan?.commissionType || 'PER_LOT',
    levelCommissions: plan?.levelCommissions || { level1: 5, level2: 3, level3: 2, level4: 1, level5: 0.5 },
    isDefault: plan?.isDefault || false
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold text-lg">{plan ? 'Edit Plan' : 'Create Plan'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Plan Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">Commission Type</label>
              <select
                value={formData.commissionType}
                onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
                className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="PER_LOT">Per Lot ($)</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Max Levels</label>
              <select
                value={formData.maxLevels}
                onChange={(e) => setFormData({ ...formData, maxLevels: parseInt(e.target.value) })}
                className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-2">Level Commissions</label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(level => (
                <div key={level}>
                  <label className="text-gray-500 text-xs">L{level}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.levelCommissions[`level${level}`] || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      levelCommissions: { ...formData.levelCommissions, [`level${level}`]: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-dark-700 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm"
                    disabled={level > formData.maxLevels}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4"
            />
            <label className="text-gray-400 text-sm">Set as default plan</label>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {plan ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminIBManagement
