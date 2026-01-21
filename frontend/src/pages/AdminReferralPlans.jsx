import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  Users, 
  DollarSign, 
  Settings, 
  Save, 
  RefreshCw,
  TrendingUp,
  Layers,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

const API_URL = 'http://localhost:5001/api'

const AdminReferralPlans = () => {
  const [activeTab, setActiveTab] = useState('referral-income')
  const [referralPlan, setReferralPlan] = useState(null)
  const [joiningPlan, setJoiningPlan] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchPlans()
    fetchStats()
  }, [])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const [refRes, joinRes] = await Promise.all([
        fetch(`${API_URL}/referral/admin/referral-income-plan`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/referral/admin/direct-joining-plan`, { headers: getAuthHeaders() })
      ])
      
      const refData = await refRes.json()
      const joinData = await joinRes.json()
      
      if (refData.success) setReferralPlan(refData.plan)
      if (joinData.success) setJoiningPlan(joinData.plan)
    } catch (error) {
      console.error('Error fetching plans:', error)
      setMessage({ type: 'error', text: 'Failed to load plans' })
    }
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/referral/admin/stats`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) setStats(data.stats)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const saveReferralPlan = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/referral/admin/referral-income-plan`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          maxLevels: referralPlan.maxLevels,
          levels: referralPlan.levels,
          commissionType: referralPlan.commissionType
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Referral Income Plan saved successfully!' })
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          maxLevels: joiningPlan.maxLevels,
          levels: joiningPlan.levels,
          totalDistribution: joiningPlan.totalDistribution,
          commissionType: joiningPlan.commissionType
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Direct Joining Plan saved successfully!' })
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
      setReferralPlan({
        ...referralPlan,
        maxLevels: newLevels.length,
        levels: newLevels
      })
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
      setJoiningPlan({
        ...joiningPlan,
        maxLevels: newLevels.length,
        levels: newLevels
      })
    }
  }

  const renderReferralIncomePlan = () => (
    <div className="space-y-6">
      <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Referral Income Plan</h2>
            <p className="text-gray-400 text-sm mt-1">
              Commission earned from copy trading network (per lot traded)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={addReferralLevel}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Level
            </button>
            <button
              onClick={removeReferralLevel}
              disabled={referralPlan?.levels?.length <= 1}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              <Minus className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>

        {referralPlan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {referralPlan.levels.map((level, index) => (
                <div key={level.level} className="bg-dark-700 rounded-lg p-4 border border-gray-700">
                  <label className="block text-gray-400 text-sm mb-2">
                    Level {level.level}
                  </label>
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
                <span className="font-medium text-white">{referralPlan.levels.length}</span> levels configured
              </div>
              <button
                onClick={saveReferralPlan}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent-green text-black font-medium rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-medium text-white mb-4">Commission Preview</h3>
        <p className="text-gray-400 text-sm mb-4">
          Example: When a referred user trades 1 lot, the upline chain receives:
        </p>
        <div className="flex flex-wrap gap-2">
          {referralPlan?.levels.map((level) => (
            <div key={level.level} className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <span className="text-blue-400 font-medium">L{level.level}:</span>
              <span className="text-white ml-2">${level.amount}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-4">
          Total per lot: ${referralPlan?.levels.reduce((sum, l) => sum + l.amount, 0).toFixed(2)}
        </p>
      </div>
    </div>
  )

  const renderDirectJoiningPlan = () => (
    <div className="space-y-6">
      <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Direct Joining Income Plan</h2>
            <p className="text-gray-400 text-sm mt-1">
              Commission earned when new users join through referral link (% of deposit)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={addJoiningLevel}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Level
            </button>
            <button
              onClick={removeJoiningLevel}
              disabled={joiningPlan?.levels?.length <= 1}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              <Minus className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>

        {joiningPlan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {joiningPlan.levels.map((level, index) => (
                <div key={level.level} className="bg-dark-700 rounded-lg p-4 border border-gray-700">
                  <label className="block text-gray-400 text-sm mb-2">
                    Level {level.level}
                  </label>
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
                <span className="font-medium text-white ml-2">
                  {joiningPlan.levels.reduce((sum, l) => sum + l.percentage, 0).toFixed(1)}%
                </span> total distribution
              </div>
              <button
                onClick={saveJoiningPlan}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent-green text-black font-medium rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-medium text-white mb-4">Commission Preview</h3>
        <p className="text-gray-400 text-sm mb-4">
          Example: When a new user deposits $100, the upline chain receives:
        </p>
        <div className="flex flex-wrap gap-2">
          {joiningPlan?.levels.map((level) => (
            <div key={level.level} className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <span className="text-purple-400 font-medium">L{level.level}:</span>
              <span className="text-white ml-2">${(100 * level.percentage / 100).toFixed(2)}</span>
              <span className="text-gray-500 ml-1">({level.percentage}%)</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-4">
          Total from $100 deposit: ${joiningPlan?.levels.reduce((sum, l) => sum + (100 * l.percentage / 100), 0).toFixed(2)}
        </p>
      </div>
    </div>
  )

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 animate-spin text-accent-green" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Layers className="w-7 h-7 text-accent-green" />
            Referral Commission Plans
          </h1>
          <p className="text-gray-400 mt-1">Configure referral income and direct joining commission structures</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Referral Income Paid</p>
                  <p className="text-xl font-bold text-white">${(stats.referralIncome?.total || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Joining Income Paid</p>
                  <p className="text-xl font-bold text-white">${(stats.joiningIncome?.total || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Referrers</p>
                  <p className="text-xl font-bold text-white">{stats.totalReferrers || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Referred</p>
                  <p className="text-xl font-bold text-white">{stats.totalReferred || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('referral-income')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'referral-income' ? 'text-accent-green' : 'text-gray-400 hover:text-white'
            }`}
          >
            Referral Income (11 Levels)
            {activeTab === 'referral-income' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green" />}
          </button>
          <button
            onClick={() => setActiveTab('direct-joining')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'direct-joining' ? 'text-accent-green' : 'text-gray-400 hover:text-white'
            }`}
          >
            Direct Joining Income (18 Levels)
            {activeTab === 'direct-joining' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green" />}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'referral-income' ? renderReferralIncomePlan() : renderDirectJoiningPlan()}
      </div>
    </AdminLayout>
  )
}

export default AdminReferralPlans
