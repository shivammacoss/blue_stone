import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import {
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  RefreshCw,
  CreditCard,
  Lock,
  Upload,
  Image as ImageIcon
} from 'lucide-react'
import { API_URL, API_BASE_URL } from '../config/api'

// Build a full image URL from a stored path (handles absolute URLs and relative /uploads paths)
const imageSrc = (img) => (img ? (img.startsWith('http') ? img : `${API_BASE_URL}${img}`) : '')

const AdminAccountTypes = () => {
  const [accountTypes, setAccountTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    minDeposit: '',
    leverage: '1:100',
    exposureLimit: '',
    minSpread: '0',
    commission: '0',
    isActive: true,
    isDemo: false,
    demoBalance: '10000',
    isAlgo: false,
    algoLockDays: '90',
    algoRoiMin: '2',
    algoRoiMax: '5'
  })

  useEffect(() => {
    fetchAccountTypes()
  }, [])

  const fetchAccountTypes = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/account-types/all`)
      const data = await res.json()
      setAccountTypes(data.accountTypes || [])
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
    setLoading(false)
  }

  const handleImageUpload = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    setError('')
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch(`${API_URL}/upload/account-type-image`, {
        method: 'POST',
        body: fd
      })
      const data = await res.json()
      if (data.success) {
        setFormData((prev) => ({ ...prev, image: data.url }))
      } else {
        setError(data.message || 'Image upload failed')
      }
    } catch (e) {
      setError('Image upload failed')
    }
    setUploadingImage(false)
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.minDeposit || !formData.leverage) {
      setError('Please fill in all required fields')
      return
    }

    try {
      const url = editingType 
        ? `${API_URL}/account-types/${editingType._id}`
        : `${API_URL}/account-types`
      
      const res = await fetch(url, {
        method: editingType ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          minDeposit: parseFloat(formData.minDeposit),
          exposureLimit: formData.exposureLimit ? parseFloat(formData.exposureLimit) : 0,
          minSpread: parseFloat(formData.minSpread) || 0,
          commission: parseFloat(formData.commission) || 0,
          isDemo: formData.isAlgo ? false : formData.isDemo,
          demoBalance: (!formData.isAlgo && formData.isDemo) ? parseFloat(formData.demoBalance) : 0,
          isAlgo: formData.isAlgo,
          algoLockDays: formData.isAlgo ? (parseInt(formData.algoLockDays) || 90) : 90,
          algoRoiMin: formData.isAlgo ? (parseFloat(formData.algoRoiMin) || 0) : 0,
          algoRoiMax: formData.isAlgo ? (parseFloat(formData.algoRoiMax) || 0) : 0
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        setSuccess(editingType ? 'Account type updated!' : 'Account type created!')
        setShowModal(false)
        resetForm()
        fetchAccountTypes()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Error saving account type')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this account type?')) return

    try {
      const res = await fetch(`${API_URL}/account-types/${id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        setSuccess('Account type deleted!')
        fetchAccountTypes()
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (error) {
      setError('Error deleting account type')
    }
  }

  const handleToggleActive = async (type) => {
    try {
      const res = await fetch(`${API_URL}/account-types/${type._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...type, isActive: !type.isActive })
      })
      
      if (res.ok) {
        fetchAccountTypes()
      }
    } catch (error) {
      setError('Error updating account type')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      minDeposit: '',
      leverage: '1:100',
      exposureLimit: '',
      minSpread: '0',
      commission: '0',
      isActive: true,
      isDemo: false,
      demoBalance: '10000',
      isAlgo: false,
      algoLockDays: '90',
      algoRoiMin: '2',
      algoRoiMax: '5'
    })
    setEditingType(null)
    setError('')
  }

  // Open the create modal pre-configured as an Algo account, with the default
  // spec supplied by the client (Min Deposit $500, 1:500 leverage, 90-day lock,
  // 0 spread, $0 commission, 2%–5% monthly ROI target).
  const openAddAlgoModal = () => {
    resetForm()
    setFormData((prev) => ({
      ...prev,
      name: '',
      description: '',
      image: '',
      minDeposit: '500',
      leverage: '1:500',
      exposureLimit: '',
      minSpread: '0',
      commission: '0',
      isAlgo: true,
      algoLockDays: '90',
      algoRoiMin: '2',
      algoRoiMax: '5'
    }))
    setShowModal(true)
  }

  const openEditModal = (type) => {
    setEditingType(type)
    setFormData({
      name: type.name,
      description: type.description || '',
      image: type.image || '',
      minDeposit: type.minDeposit.toString(),
      leverage: type.leverage,
      exposureLimit: type.exposureLimit?.toString() || '',
      minSpread: type.minSpread?.toString() || '0',
      commission: type.commission?.toString() || '0',
      isActive: type.isActive,
      isDemo: type.isDemo || false,
      demoBalance: type.demoBalance?.toString() || '10000',
      isAlgo: type.isAlgo || false,
      algoLockDays: type.algoLockDays?.toString() || '90',
      algoRoiMin: type.algoRoiMin?.toString() ?? '2',
      algoRoiMax: type.algoRoiMax?.toString() ?? '5'
    })
    setShowModal(true)
    setError('')
  }

  const renderCard = (type) => (
    <div key={type._id} className={`bg-dark-800 rounded-lg p-4 border ${type.isAlgo ? (type.isActive ? 'border-purple-500/40' : 'border-red-500/30 opacity-60') : (type.isActive ? 'border-gray-700' : 'border-red-500/30 opacity-60')}`}>
      {type.image && (
        <div className="flex justify-center mb-3">
          <img src={imageSrc(type.image)} alt={type.name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-600" />
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium text-sm">{type.name}</h3>
          {type.isDemo && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-500">DEMO</span>
          )}
          {type.isAlgo && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gradient-to-r from-blue-500 to-cyan-500 text-white flex items-center gap-0.5"><Lock size={9} /> ALGO</span>
          )}
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${type.isActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
          {type.isActive ? 'Active' : 'Disabled'}
        </span>
      </div>
      <p className="text-gray-500 text-xs mb-3 line-clamp-1">{type.description || 'No description'}</p>
      <div className="space-y-1.5 mb-3 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Min Deposit</span>
          <span className="text-white">${type.minDeposit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Leverage</span>
          <span className="text-white">{type.leverage}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Exposure</span>
          <span className="text-white">${type.exposureLimit || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Min Spread</span>
          <span className="text-white">{type.minSpread || 0} pips</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Commission</span>
          <span className="text-white">{type.commission > 0 ? `$${type.commission}` : 'NO COMM'}</span>
        </div>
        {type.isDemo && (
          <div className="flex justify-between">
            <span className="text-gray-500">Demo Bal</span>
            <span className="text-yellow-500">${type.demoBalance || 10000}</span>
          </div>
        )}
        {type.isAlgo && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Lock Period</span>
              <span className="text-purple-400">{type.algoLockDays || 90} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Monthly ROI</span>
              <span className="text-purple-400">{type.algoRoiMin ?? 2}% – {type.algoRoiMax ?? 5}%</span>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => openEditModal(type)}
          className="flex-1 flex items-center justify-center gap-1 bg-dark-700 text-white py-1.5 rounded text-xs hover:bg-dark-600 transition-colors"
        >
          <Edit size={12} /> Edit
        </button>
        <button
          onClick={() => handleToggleActive(type)}
          className={`flex-1 py-1.5 rounded transition-colors text-xs ${type.isActive ? 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}
        >
          {type.isActive ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={() => handleDelete(type._id)}
          className="px-2 py-1.5 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )

  const regularTypes = accountTypes.filter((t) => !t.isAlgo)
  const algoTypes = accountTypes.filter((t) => t.isAlgo)

  return (
    <AdminLayout title="Account Types" subtitle="Manage trading account types">
      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          <Plus size={18} /> Add Account Type
        </button>
      </div>

      <div>
          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-500 flex items-center gap-2">
              <Check size={18} /> {success}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={24} className="text-gray-500 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {regularTypes.map(renderCard)}
                {accountTypes.length === 0 && (
                  <div className="col-span-3 bg-dark-800 rounded-xl p-8 border border-gray-800 text-center">
                    <CreditCard size={48} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">No account types created yet</p>
                  </div>
                )}
              </div>

              {/* Algo Accounts section */}
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
                  <Lock size={18} className="text-purple-400" />
                  <h2 className="text-white font-semibold">Algo Accounts</h2>
                  <span className="text-gray-500 text-xs flex-1">Balance is locked for the lock period; trading & withdrawals are blocked until it unlocks</span>
                  {algoTypes.length > 0 && (
                    <button
                      onClick={openAddAlgoModal}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity shrink-0"
                    >
                      <Plus size={15} /> Add Algo Account
                    </button>
                  )}
                </div>
                {algoTypes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {algoTypes.map(renderCard)}
                  </div>
                ) : (
                  <div className="bg-dark-800 rounded-xl p-8 border border-purple-500/20 text-center">
                    <Lock size={40} className="text-purple-500/40 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">No algo accounts created yet</p>
                    <button
                      onClick={openAddAlgoModal}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Plus size={16} /> Add Algo Account
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">
                {editingType ? (formData.isAlgo ? 'Edit Algo Account' : 'Edit Account Type') : (formData.isAlgo ? 'Create Algo Account' : 'Create Account Type')}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard, Premium, VIP"
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Account type description"
                  rows={2}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Account Type Photo */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Account Type Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-dark-700 border border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                    {formData.image ? (
                      <img src={imageSrc(formData.image)} alt="Account type" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={22} className="text-gray-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors">
                      <Upload size={15} />
                      {uploadingImage ? 'Uploading...' : (formData.image ? 'Change Photo' : 'Upload Photo')}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => handleImageUpload(e.target.files?.[0])}
                      />
                    </label>
                    {formData.image && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image: '' })}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1">Optional logo shown on account cards (max 5MB)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Min Deposit ($) *</label>
                  <input
                    type="number"
                    value={formData.minDeposit}
                    onChange={(e) => setFormData({ ...formData, minDeposit: e.target.value })}
                    placeholder="100"
                    className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Leverage *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leverage.replace('1:', '')}
                    onChange={(e) => setFormData({ ...formData, leverage: `1:${e.target.value}` })}
                    placeholder="100"
                    className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Exposure Limit ($)</label>
                <input
                  type="number"
                  value={formData.exposureLimit}
                  onChange={(e) => setFormData({ ...formData, exposureLimit: e.target.value })}
                  placeholder="0 for unlimited"
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Min Spread and Commission */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Min Spread (pips)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.minSpread}
                    onChange={(e) => setFormData({ ...formData, minSpread: e.target.value })}
                    placeholder="0"
                    className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Commission ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.commission}
                    onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                    placeholder="0"
                    className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Demo Account Toggle — hidden when creating an Algo account */}
              {!formData.isAlgo && (
              <div className="bg-dark-700 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Demo Account</label>
                    <p className="text-gray-500 text-xs mt-1">Enable this for practice/demo accounts with virtual funds</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isDemo: !formData.isDemo })}
                    className={`w-12 h-6 rounded-full transition-colors ${formData.isDemo ? 'bg-yellow-500' : 'bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${formData.isDemo ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {formData.isDemo && (
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <label className="block text-gray-400 text-sm mb-2">Demo Balance ($)</label>
                    <input
                      type="number"
                      value={formData.demoBalance}
                      onChange={(e) => setFormData({ ...formData, demoBalance: e.target.value })}
                      placeholder="10000"
                      className="w-full bg-dark-600 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                    />
                    <p className="text-gray-500 text-xs mt-1">Virtual balance users will receive when opening this account type</p>
                  </div>
                )}
              </div>
              )}

              {/* Algo Account config — only shown in the Algo modal */}
              {formData.isAlgo && (
              <div className="rounded-lg p-[1.5px] bg-gradient-to-r from-blue-500 to-cyan-500">
               <div className="bg-dark-700 rounded-[7px] p-4">
                <div>
                  <label className="text-white font-medium flex items-center gap-1.5"><Lock size={14} className="text-cyan-400" /> Algo Account</label>
                  <p className="text-gray-500 text-xs mt-1">Balance is locked after opening — user cannot trade or withdraw until it unlocks</p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-600 space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Capital Locking Period (days)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.algoLockDays}
                        onChange={(e) => setFormData({ ...formData, algoLockDays: e.target.value })}
                        placeholder="90"
                        className="w-full bg-dark-600 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-gray-500 text-xs mt-1">Number of days the balance stays locked from when the account is opened (default 90)</p>
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Monthly ROI Target (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.algoRoiMin}
                          onChange={(e) => setFormData({ ...formData, algoRoiMin: e.target.value })}
                          placeholder="2"
                          className="w-full bg-dark-600 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.algoRoiMax}
                          onChange={(e) => setFormData({ ...formData, algoRoiMax: e.target.value })}
                          placeholder="5"
                          className="w-full bg-dark-600 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">Target monthly return range shown to the user (informational)</p>
                    </div>

                    <div className="bg-dark-600/50 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                        <span className="text-gray-400"><span className="text-gray-300">Profit Withdrawal:</span> Allowed as per the withdrawal policy</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Lock size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                        <span className="text-gray-400"><span className="text-gray-300">Principal Withdrawal:</span> Available after completion of the {formData.algoLockDays || 90}-day lock period</span>
                      </div>
                    </div>
                </div>
               </div>
              </div>
              )}
            </div>

            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 bg-dark-700 text-white py-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-lg hover:bg-red-600 transition-colors"
              >
                {editingType ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminAccountTypes
