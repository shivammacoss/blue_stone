import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { X, Mail, ChevronDown, Search, Eye, EyeOff } from 'lucide-react'
import { signup } from '../api/auth'
import logo from '../assets/logo.png'

import { API_URL } from '../config/api'

const countries = [
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵' },
]

const Signup = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get('ref')
  const [activeTab, setActiveTab] = useState('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(countries[0])
  const dropdownRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    countryCode: '+1',
    password: ''
  })
  
  // Detect mobile view
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.code.includes(countrySearch)
  )

  const handleCountrySelect = (country) => {
    setSelectedCountry(country)
    setFormData({ ...formData, countryCode: country.code })
    setShowCountryDropdown(false)
    setCountrySearch('')
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      // Include referral code in signup data
      const signupData = {
        ...formData,
        referralCode: referralCode || undefined
      }
      
      const response = await signup(signupData)
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      
      // Also call register-referral API for backward compatibility
      if (referralCode && response.user?._id) {
        try {
          await fetch(`${API_URL}/ib/register-referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: response.user._id,
              referralCode: referralCode
            })
          })
          console.log('Referral registered:', referralCode)
        } catch (refError) {
          console.error('Error registering referral:', refError)
        }
      }
      
      // Redirect to mobile view on mobile devices
      if (isMobile) {
        navigate('/mobile')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-cyan-500/20 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-l from-orange-500/20 via-purple-500/20 to-transparent rounded-full blur-3xl" />
      
      {/* Modal */}
      <div className="relative bg-dark-700 rounded-2xl p-6 sm:p-8 w-full max-w-md border border-gray-800 mx-4 sm:mx-0">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logo} alt="ProfitVisionFX" className="h-32 object-contain" />
        </div>

        {/* Tabs */}
        <div className="flex bg-dark-600 rounded-full p-1 w-fit mb-8">
          <button
            onClick={() => setActiveTab('signup')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'signup' ? 'bg-dark-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign up
          </button>
          <Link
            to="/user/login"
            className="px-6 py-2 rounded-full text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-white mb-6">Create an account</h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <input
            type="text"
            name="firstName"
            placeholder="Enter your name"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full bg-dark-600 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
          />

          {/* Email field */}
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-dark-600 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
            />
          </div>

          {/* Phone field with country selector */}
          <div className="flex relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className="flex items-center gap-1 sm:gap-2 bg-dark-600 border border-gray-700 rounded-l-lg px-2 sm:px-3 py-3 border-r-0 hover:bg-dark-500 transition-colors min-w-[70px] sm:min-w-[90px]"
            >
              <span className="text-base sm:text-lg">{selectedCountry.flag}</span>
              <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">{selectedCountry.code}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            
            {/* Country Dropdown */}
            {showCountryDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 sm:w-72 bg-dark-600 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                {/* Search */}
                <div className="p-2 border-b border-gray-700">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search country..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full bg-dark-700 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gray-600"
                    />
                  </div>
                </div>
                {/* Country List */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredCountries.map((country, index) => (
                    <button
                      key={`${country.code}-${index}`}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-500 transition-colors text-left"
                    >
                      <span className="text-lg">{country.flag}</span>
                      <span className="text-white text-sm flex-1">{country.name}</span>
                      <span className="text-gray-500 text-sm">{country.code}</span>
                    </button>
                  ))}
                  {filteredCountries.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-3">No countries found</p>
                  )}
                </div>
              </div>
            )}
            
            <input
              type="tel"
              name="phone"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={handleChange}
              className="flex-1 bg-dark-600 border border-gray-700 rounded-r-lg px-3 sm:px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors min-w-0"
            />
          </div>

          {/* Password field */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Create password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-dark-600 border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

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
            {loading ? 'Creating account...' : 'Create an account'}
          </button>
        </form>

        {/* Terms */}
        <p className="text-center text-gray-500 text-sm mt-6">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-white hover:underline">Terms & Service</a>
        </p>
      </div>
    </div>
  )
}

export default Signup
