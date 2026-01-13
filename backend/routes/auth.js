import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Admin from '../models/Admin.js'

const router = express.Router()

// Generate JWT token with issued at timestamp
const generateToken = (userId) => {
  return jwt.sign({ id: userId, iat: Math.floor(Date.now() / 1000) }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { firstName, email, phone, countryCode, password, adminSlug } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    // Find admin by slug if provided
    let assignedAdmin = null
    let adminUrlSlug = null
    if (adminSlug) {
      const admin = await Admin.findOne({ urlSlug: adminSlug.toLowerCase(), status: 'ACTIVE' })
      if (admin) {
        assignedAdmin = admin._id
        adminUrlSlug = admin.urlSlug
      }
    }

    // Create new user
    const user = await User.create({
      firstName,
      email,
      phone,
      countryCode,
      password,
      assignedAdmin,
      adminUrlSlug
    })

    // Update admin stats if assigned
    if (assignedAdmin) {
      await Admin.findByIdAndUpdate(assignedAdmin, { $inc: { 'stats.totalUsers': 1 } })
    }

    // Generate token
    const token = generateToken(user._id)

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        phone: user.phone,
        assignedAdmin,
        adminUrlSlug
      },
      token
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Error creating user', error: error.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user by email
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({ 
        message: 'Your account has been permanently banned. Please contact support.',
        reason: user.banReason || 'Account banned'
      })
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ 
        message: 'Your account has been temporarily blocked. Please contact support.',
        reason: user.blockReason || 'Account blocked'
      })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Generate token
    const token = generateToken(user._id)

    res.json({
      message: 'Login successful',
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        phone: user.phone,
        assignedAdmin: user.assignedAdmin,
        adminUrlSlug: user.adminUrlSlug
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Error logging in', error: error.message })
  }
})

// GET /api/auth/me - Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if user is banned - force logout
    if (user.isBanned) {
      return res.status(403).json({ 
        message: 'Your account has been permanently banned.',
        forceLogout: true,
        reason: user.banReason || 'Account banned'
      })
    }

    // Check if user is blocked - force logout
    if (user.isBlocked) {
      return res.status(403).json({ 
        message: 'Your account has been temporarily blocked.',
        forceLogout: true,
        reason: user.blockReason || 'Account blocked'
      })
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt) {
      const tokenIssuedAt = decoded.iat * 1000 // Convert to milliseconds
      const passwordChangedAt = new Date(user.passwordChangedAt).getTime()
      if (passwordChangedAt > tokenIssuedAt) {
        return res.status(403).json({ 
          message: 'Your password was changed. Please login again.',
          forceLogout: true
        })
      }
    }

    res.json({ user })
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' })
  }
})

// PUT /api/auth/update-profile - Update user profile
router.put('/update-profile', async (req, res) => {
  try {
    const { userId, firstName, lastName, phone, address, city, country, dateOfBirth, bankDetails, upiId } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Update basic profile fields
    if (firstName) user.firstName = firstName
    if (lastName !== undefined) user.lastName = lastName
    if (phone !== undefined) user.phone = phone
    if (address !== undefined) user.address = address
    if (city !== undefined) user.city = city
    if (country !== undefined) user.country = country
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth

    // Update bank details
    if (bankDetails) {
      user.bankDetails = {
        bankName: bankDetails.bankName || '',
        accountNumber: bankDetails.accountNumber || '',
        accountHolderName: bankDetails.accountHolderName || '',
        ifscCode: bankDetails.ifscCode || '',
        branchName: bankDetails.branchName || ''
      }
    }

    // Update UPI
    if (upiId !== undefined) user.upiId = upiId

    await user.save()

    res.json({ 
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        bankDetails: user.bankDetails,
        upiId: user.upiId,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Error updating profile', error: error.message })
  }
})

// GET /api/auth/user/:userId - Get user by ID (for admin)
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ user })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message })
  }
})

// POST /api/auth/forgot-password - Request password reset (admin will send new password)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, newEmail } = req.body

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' })
    }

    // Find user by email
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' })
    }

    // Create password reset request
    const PasswordResetRequest = (await import('../models/PasswordResetRequest.js')).default
    
    // Check if there's already a pending request
    const existingRequest = await PasswordResetRequest.findOne({ 
      userId: user._id, 
      status: 'Pending' 
    })
    
    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have a pending password reset request. Please wait for admin to process it.' 
      })
    }

    // Create new request
    await PasswordResetRequest.create({
      userId: user._id,
      email: user.email,
      newEmail: newEmail || null,
      status: 'Pending'
    })

    console.log(`[Password Reset Request] User: ${user.email}, New Email: ${newEmail || 'N/A'}`)

    res.json({ 
      success: true, 
      message: 'Password reset request submitted. Admin will send a new password to your email.' 
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ success: false, message: 'Error submitting request', error: error.message })
  }
})

export default router
