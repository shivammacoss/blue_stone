import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users,
  LogOut,
  TrendingUp,
  Wallet,
  Building2,
  UserCog,
  DollarSign,
  IndianRupee,
  Copy,
  Trophy,
  CreditCard,
  Shield,
  FileCheck,
  HeadphonesIcon,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Palette,
  BookOpen,
  Layers,
  Sun,
  Moon
} from 'lucide-react'
import logo from '../assets/logo.png'
import { useTheme } from '../context/ThemeContext'

const AdminLayout = ({ children, title, subtitle }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})

  // Get admin user and permissions from localStorage
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}')
  const permissions = adminUser.permissions || {}
  const isSuperAdmin = adminUser.role === 'SUPER_ADMIN' || adminUser._id === 'super-admin'

  // Debug: Log permissions on mount
  useEffect(() => {
    console.log('Admin User:', adminUser)
    console.log('Permissions:', permissions)
    console.log('Is Super Admin:', isSuperAdmin)
  }, [])

  // All menu items with their required permissions
  const allMenuItems = [
    { name: 'Overview Dashboard', icon: LayoutDashboard, path: '/admin/dashboard', permission: null }, // Always visible
    { name: 'User Management', icon: Users, path: '/admin/users', permission: 'canManageUsers' },
    { name: 'Trade Management', icon: TrendingUp, path: '/admin/trades', permission: 'canManageTrades' },
    { name: 'Book Management', icon: BookOpen, path: '/admin/book-management', permission: 'canManageTrades' },
    { name: 'Fund Management', icon: Wallet, path: '/admin/funds', permission: 'canManageDeposits' },
    { name: 'Bank Settings', icon: Building2, path: '/admin/bank-settings', permission: 'canManageSettings' },
    { name: 'IB Management', icon: UserCog, path: '/admin/ib-management', permission: 'canManageIB' },
    { name: 'Forex Charges', icon: DollarSign, path: '/admin/forex-charges', permission: 'canManageSettings' },
    { name: 'Earnings Report', icon: TrendingUp, path: '/admin/earnings', permission: 'canViewReports' },
    { name: 'Copy Trade Management', icon: Copy, path: '/admin/copy-trade', permission: 'canManageCopyTrading' },
    { name: 'Prop Firm Challenges', icon: Trophy, path: '/admin/prop-firm', permission: 'canManageSettings' },
    { name: 'Account Types', icon: CreditCard, path: '/admin/account-types', permission: 'canManageAccounts' },
    { name: 'Theme Settings', icon: Palette, path: '/admin/theme', permission: 'canManageTheme' },
    { name: 'Admin Management', icon: Shield, path: '/admin/admin-management', permission: 'canManageAdmins' },
    { name: 'KYC Verification', icon: FileCheck, path: '/admin/kyc', permission: 'canManageKYC' },
    { name: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support', permission: null }, // Always visible
  ]

  // Filter menu items based on permissions (Super Admin sees all)
  const menuItems = allMenuItems.filter(item => {
    if (isSuperAdmin) return true // Super admin sees everything
    if (item.permission === null) return true // Items with no permission requirement
    return permissions[item.permission] === true
  })

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      navigate('/admin')
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    navigate('/admin')
  }

  const isActive = (path) => location.pathname === path

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-dark-900' : 'bg-gray-50'}`}>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${sidebarExpanded ? 'w-64' : 'w-16'} 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isDarkMode ? 'bg-dark-900 border-gray-800' : 'bg-white border-gray-200'} border-r flex flex-col 
          transition-all duration-300 ease-in-out
        `}
      >
        {/* Logo */}
        <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <img src={logo} alt="BlueStone" className="h-16 object-contain flex-shrink-0" />
            {sidebarExpanded} 
          </div>
          <button 
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`hidden lg:block p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}
          >
            <Menu size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
          </button>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className={`lg:hidden p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}
          >
            <X size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Menu */}
        <nav className={`flex-1 px-2 py-4 overflow-y-auto scrollbar-thin ${isDarkMode ? 'scrollbar-thumb-gray-700' : 'scrollbar-thumb-gray-300'}`}>
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                navigate(item.path)
                setMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                isActive(item.path)
                  ? 'bg-red-500 text-white' 
                  : isDarkMode 
                    ? 'text-gray-400 hover:text-white hover:bg-dark-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={!sidebarExpanded ? item.name : ''}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {sidebarExpanded && (
                <span className="text-sm font-medium whitespace-nowrap truncate">{item.name}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Theme Toggle */}
        <div className={`p-2 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button 
            onClick={toggleDarkMode}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              isDarkMode 
                ? 'text-yellow-400 hover:text-yellow-300 hover:bg-dark-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={!sidebarExpanded ? (isDarkMode ? 'Light Mode' : 'Dark Mode') : ''}
          >
            {isDarkMode ? <Sun size={18} className="flex-shrink-0" /> : <Moon size={18} className="flex-shrink-0" />}
            {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:text-white hover:bg-dark-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={!sidebarExpanded ? 'Log Out' : ''}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Header */}
        <header className={`sticky top-0 z-30 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 py-4 border-b ${isDarkMode ? 'bg-dark-900/95 border-gray-800' : 'bg-white/95 border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-dark-700' : 'hover:bg-gray-100'}`}
            >
              <Menu size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
            </button>
            <div>
              <h1 className={`text-lg sm:text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title || 'Admin Dashboard'}</h1>
              {subtitle && <p className="text-gray-500 text-sm hidden sm:block">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-xs sm:text-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span className="hidden sm:inline">Admin Mode</span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default AdminLayout
