import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { authenticateSuperAdmin } from '../middleware/auth.js'
import Admin from '../models/Admin.js'
import AdminWallet from '../models/AdminWallet.js'

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'pv1x$3cur3K3y!2026@Pr0f1tV1s10nFX#Tr4d1ng$3rv3r'

// Super Admin credentials from environment
const SUPER_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@BlueStone.com'
const SUPER_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// POST /api/super-admin/login - Admin Login (checks Admin model first, then super admin)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' })
    }

    // First, check if this is an admin from the Admin model (created admins)
    const admin = await Admin.findOne({ email: email.toLowerCase() })
    
    if (admin) {
      // Check if admin is active
      if (admin.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'Account is suspended or pending' })
      }

      // Verify password with bcrypt
      const isMatch = await bcrypt.compare(password, admin.password)
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' })
      }

      // Update last login
      admin.lastLogin = new Date()
      await admin.save()

      // Get wallet info
      const wallet = await AdminWallet.findOne({ adminId: admin._id })

      // Generate JWT token
      const token = jwt.sign(
        { 
          adminId: admin._id,
          email: admin.email,
          role: admin.role,
          isSuperAdmin: admin.role === 'SUPER_ADMIN'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      )

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        admin: {
          _id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          urlSlug: admin.urlSlug,
          brandName: admin.brandName,
          permissions: admin.permissions,
          walletBalance: wallet?.balance || 0
        }
      })
    }

    // Fallback: Check hardcoded super admin credentials
    if (email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    // Check password for hardcoded super admin
    if (password !== SUPER_ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    // Generate JWT token for hardcoded super admin
    const token = jwt.sign(
      { 
        id: 'super-admin',
        email: SUPER_ADMIN_EMAIL,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        _id: 'super-admin',
        email: SUPER_ADMIN_EMAIL,
        role: 'SUPER_ADMIN',
        firstName: 'Super',
        lastName: 'Admin'
      }
    })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({ success: false, message: 'Login failed', error: error.message })
  }
})

// GET /api/super-admin/verify - Verify super admin token
router.get('/verify', authenticateSuperAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    admin: req.admin
  })
})

// POST /api/super-admin/change-password - Change super admin password
router.post('/change-password', authenticateSuperAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' })
    }

    if (currentPassword !== SUPER_ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' })
    }

    // In production, update the password in database or secure storage
    // For now, this would require updating the .env file manually
    res.json({
      success: true,
      message: 'Password change requested. Please update ADMIN_PASSWORD in .env file and restart server.'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error changing password', error: error.message })
  }
})

export default router
