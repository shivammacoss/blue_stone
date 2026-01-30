import express from 'express'
import AccountType from '../models/AccountType.js'
import Charges from '../models/Charges.js'

const router = express.Router()

// GET /api/account-types - Get all active account types (for users)
// Merges Forex Charges (commission/spread) if set for each account type
router.get('/', async (req, res) => {
  try {
    const accountTypes = await AccountType.find({ isActive: true }).sort({ createdAt: -1 })
    
    // Get all ACCOUNT_TYPE level charges
    const accountTypeCharges = await Charges.find({ 
      level: 'ACCOUNT_TYPE', 
      isActive: true,
      accountTypeId: { $ne: null }
    })
    
    // Build a map of accountTypeId -> charges
    const chargesMap = {}
    for (const charge of accountTypeCharges) {
      const accTypeId = charge.accountTypeId.toString()
      if (!chargesMap[accTypeId]) {
        chargesMap[accTypeId] = { spreadValue: 0, commissionValue: 0 }
      }
      // Use the highest values found
      if (charge.spreadValue > chargesMap[accTypeId].spreadValue) {
        chargesMap[accTypeId].spreadValue = charge.spreadValue
      }
      if (charge.commissionValue > chargesMap[accTypeId].commissionValue) {
        chargesMap[accTypeId].commissionValue = charge.commissionValue
      }
    }
    
    // Merge charges into account types (Forex Charges override Account Type defaults)
    const mergedAccountTypes = accountTypes.map(accType => {
      const accTypeObj = accType.toObject()
      const charges = chargesMap[accType._id.toString()]
      if (charges) {
        // Override with Forex Charges if they have values
        if (charges.spreadValue > 0) {
          accTypeObj.minSpread = charges.spreadValue
        }
        if (charges.commissionValue > 0) {
          accTypeObj.commission = charges.commissionValue
        }
      }
      return accTypeObj
    })
    
    res.json({ success: true, accountTypes: mergedAccountTypes })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching account types', error: error.message })
  }
})

// GET /api/account-types/all - Get all account types (for admin)
router.get('/all', async (req, res) => {
  try {
    const accountTypes = await AccountType.find().sort({ createdAt: -1 })
    res.json({ accountTypes })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching account types', error: error.message })
  }
})

// POST /api/account-types - Create account type (admin)
router.post('/', async (req, res) => {
  try {
    const { name, description, minDeposit, leverage, exposureLimit, minSpread, commission, isDemo, demoBalance } = req.body
    const accountType = new AccountType({
      name,
      description,
      minDeposit,
      leverage,
      exposureLimit,
      minSpread: minSpread || 0,
      commission: commission || 0,
      isDemo: isDemo || false,
      demoBalance: isDemo ? (demoBalance || 10000) : 0
    })
    await accountType.save()
    res.status(201).json({ message: 'Account type created', accountType })
  } catch (error) {
    res.status(500).json({ message: 'Error creating account type', error: error.message })
  }
})

// PUT /api/account-types/:id - Update account type (admin)
router.put('/:id', async (req, res) => {
  try {
    const { name, description, minDeposit, leverage, exposureLimit, minSpread, commission, isActive, isDemo, demoBalance } = req.body
    
    // Build update object with only provided fields to avoid overwriting with undefined
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (minDeposit !== undefined) updateData.minDeposit = minDeposit
    if (leverage !== undefined) updateData.leverage = leverage
    if (exposureLimit !== undefined) updateData.exposureLimit = exposureLimit
    if (minSpread !== undefined) updateData.minSpread = minSpread
    if (commission !== undefined) updateData.commission = commission
    if (isActive !== undefined) updateData.isActive = isActive
    if (isDemo !== undefined) updateData.isDemo = isDemo
    if (demoBalance !== undefined) updateData.demoBalance = demoBalance
    
    console.log('Updating account type:', req.params.id, 'with data:', updateData)
    
    const accountType = await AccountType.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    if (!accountType) {
      return res.status(404).json({ message: 'Account type not found' })
    }
    console.log('Updated account type result:', accountType)
    res.json({ message: 'Account type updated', accountType })
  } catch (error) {
    console.error('Error updating account type:', error)
    res.status(500).json({ message: 'Error updating account type', error: error.message })
  }
})

// DELETE /api/account-types/:id - Delete account type (admin)
router.delete('/:id', async (req, res) => {
  try {
    const accountType = await AccountType.findByIdAndDelete(req.params.id)
    if (!accountType) {
      return res.status(404).json({ message: 'Account type not found' })
    }
    res.json({ message: 'Account type deleted' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting account type', error: error.message })
  }
})

export default router
