import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Mail, Check, AlertCircle } from 'lucide-react'
import logo from '../assets/logo.png'

import { API_URL } from '../config/api'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showEmailChange, setShowEmailChange] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          newEmail: showEmailChange ? newEmail : null
        })
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.message || 'Failed to submit request')
      }
    } catch (err) {
      setError('Error submitting request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-cyan-500/20 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-l from-orange-500/20 via-purple-500/20 to-transparent rounded-full blur-3xl" />
      
      {/* Modal */}
      <div className="relative bg-dark-700 rounded-2xl p-8 w-full max-w-md border border-gray-800">
        {/* Close button */}
        <Link to="/user/login" className="absolute top-4 right-4 w-8 h-8 bg-dark-600 rounded-full flex items-center justify-center hover:bg-dark-500 transition-colors">
          <X size={16} className="text-gray-400" />
        </Link>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logo} alt="BlueStone" className="h-32 object-contain" />
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Request Submitted</h2>
            <p className="text-gray-400 mb-6">
              Your password reset request has been sent to the admin. 
              You will receive a new password on your registered email shortly.
            </p>
            <Link 
              to="/user/login"
              className="inline-block bg-white text-black font-medium px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            {/* Title */}
            <h1 className="text-2xl font-semibold text-white mb-2">Forgot Password</h1>
            <p className="text-gray-400 text-sm mb-6">
              Enter your email address and we'll send your request to the admin. 
              A new password will be sent to your email.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Registered Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    className="w-full bg-dark-600 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                  />
                </div>
              </div>

              {/* Email change option */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="changeEmail"
                  checked={showEmailChange}
                  onChange={(e) => setShowEmailChange(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="changeEmail" className="text-gray-400 text-sm">
                  I want to change my email address
                </label>
              </div>

              {/* New email field */}
              {showEmailChange && (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">New Email Address</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      placeholder="Enter new email address"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-dark-600 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                    />
                  </div>
                  <p className="text-yellow-500 text-xs mt-2 flex items-start gap-1">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    Admin will verify and update your email. Password will be sent to the new email.
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-100 transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>

            {/* Back to login */}
            <p className="text-center text-gray-500 text-sm mt-6">
              Remember your password?{' '}
              <Link to="/user/login" className="text-white hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
