import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema({
  // Basic Info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  
  // Admin Type
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN'],
    default: 'ADMIN'
  },
  
  // Unique URL slug for this admin's users
  urlSlug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  
  // Company/Brand Info for this admin
  brandName: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: ''
  },
  
  // Parent admin (for sub-admins created by super admin)
  parentAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Permissions - what features this admin can access/manage
  // All defaults are FALSE - super admin must explicitly grant permissions
  permissions: {
    // User Management
    canManageUsers: { type: Boolean, default: false },
    canCreateUsers: { type: Boolean, default: false },
    canDeleteUsers: { type: Boolean, default: false },
    canViewUsers: { type: Boolean, default: false },
    
    // Trading Management
    canManageTrades: { type: Boolean, default: false },
    canCloseTrades: { type: Boolean, default: false },
    canModifyTrades: { type: Boolean, default: false },
    
    // Account Management
    canManageAccounts: { type: Boolean, default: false },
    canCreateAccounts: { type: Boolean, default: false },
    canDeleteAccounts: { type: Boolean, default: false },
    canModifyLeverage: { type: Boolean, default: false },
    
    // Wallet/Finance
    canManageDeposits: { type: Boolean, default: false },
    canApproveDeposits: { type: Boolean, default: false },
    canManageWithdrawals: { type: Boolean, default: false },
    canApproveWithdrawals: { type: Boolean, default: false },
    
    // KYC
    canManageKYC: { type: Boolean, default: false },
    canApproveKYC: { type: Boolean, default: false },
    
    // IB Management
    canManageIB: { type: Boolean, default: false },
    canApproveIB: { type: Boolean, default: false },
    
    // Copy Trading
    canManageCopyTrading: { type: Boolean, default: false },
    canApproveMasters: { type: Boolean, default: false },
    
    // Settings
    canManageSymbols: { type: Boolean, default: false },
    canManageGroups: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
    canManageTheme: { type: Boolean, default: false },
    
    // Reports
    canViewReports: { type: Boolean, default: false },
    canExportReports: { type: Boolean, default: false },
    
    // Admin Management (only for super admin)
    canManageAdmins: { type: Boolean, default: false },
    canFundAdmins: { type: Boolean, default: false }
  },
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'PENDING'],
    default: 'ACTIVE'
  },
  
  // Stats
  stats: {
    totalUsers: { type: Number, default: 0 },
    totalDeposits: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 },
    totalTrades: { type: Number, default: 0 }
  },
  
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

// Index for faster lookups
adminSchema.index({ urlSlug: 1 })
adminSchema.index({ email: 1 })
adminSchema.index({ parentAdmin: 1 })

export default mongoose.model('Admin', adminSchema)
