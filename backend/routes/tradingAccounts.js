import express from 'express'
import TradingAccount from '../models/TradingAccount.js'
import AccountType from '../models/AccountType.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import bcrypt from 'bcryptjs'

const router = express.Router()

// GET /api/trading-accounts/user/:userId - Get user's trading accounts
router.get('/user/:userId', async (req, res) => {
  try {
    const accounts = await TradingAccount.find({ userId: req.params.userId })
      .populate('accountTypeId', 'name description')
      .sort({ createdAt: -1 })
    res.json({ success: true, accounts })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching accounts', error: error.message })
  }
})

// GET /api/trading-accounts/all - Get all trading accounts (admin)
router.get('/all', async (req, res) => {
  try {
    const accounts = await TradingAccount.find()
      .populate('userId', 'firstName email')
      .populate('accountTypeId', 'name')
      .sort({ createdAt: -1 })
    res.json({ accounts })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching accounts', error: error.message })
  }
})

// POST /api/trading-accounts - Create trading account
router.post('/', async (req, res) => {
  try {
    const { userId, accountTypeId, pin } = req.body

    // Validate PIN (4 digits)
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits' })
    }

    // Get account type
    const accountType = await AccountType.findById(accountTypeId)
    if (!accountType || !accountType.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive account type' })
    }

    // Get or create wallet (no balance check needed - accounts open with zero balance)
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 })
      await wallet.save()
    }

    // Generate unique account ID
    const accountId = await TradingAccount.generateAccountId()

    // Create trading account with ZERO balance - user must deposit separately
    const tradingAccount = new TradingAccount({
      userId,
      accountTypeId,
      accountId,
      pin,
      balance: 0, // Start with zero balance - no auto fund
      leverage: accountType.leverage,
      exposureLimit: accountType.exposureLimit
    })

    await tradingAccount.save()

    res.status(201).json({ 
      message: 'Trading account created successfully', 
      account: {
        accountId: tradingAccount.accountId,
        balance: tradingAccount.balance,
        leverage: tradingAccount.leverage,
        status: tradingAccount.status
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error creating account', error: error.message })
  }
})

// POST /api/trading-accounts/:id/verify-pin - Verify PIN
router.post('/:id/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body
    const account = await TradingAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Account not found' })
    }
    const isValid = await account.verifyPin(pin)
    res.json({ valid: isValid })
  } catch (error) {
    res.status(500).json({ message: 'Error verifying PIN', error: error.message })
  }
})

// PUT /api/trading-accounts/:id/change-pin - Change PIN
router.put('/:id/change-pin', async (req, res) => {
  try {
    const { currentPin, newPin } = req.body
    const account = await TradingAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Account not found' })
    }

    // Verify current PIN
    const isValid = await account.verifyPin(currentPin)
    if (!isValid) {
      return res.status(400).json({ message: 'Current PIN is incorrect' })
    }

    // Validate new PIN
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ message: 'New PIN must be exactly 4 digits' })
    }

    account.pin = newPin
    await account.save()

    res.json({ message: 'PIN changed successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error changing PIN', error: error.message })
  }
})

// PUT /api/trading-accounts/:id/admin-update - Admin update account
router.put('/:id/admin-update', async (req, res) => {
  try {
    const { leverage, exposureLimit, status } = req.body
    const account = await TradingAccount.findByIdAndUpdate(
      req.params.id,
      { leverage, exposureLimit, status },
      { new: true }
    )
    if (!account) {
      return res.status(404).json({ message: 'Account not found' })
    }
    res.json({ message: 'Account updated', account })
  } catch (error) {
    res.status(500).json({ message: 'Error updating account', error: error.message })
  }
})

// PUT /api/trading-accounts/:id/reset-pin - Admin reset PIN
router.put('/:id/reset-pin', async (req, res) => {
  try {
    const { newPin } = req.body
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits' })
    }

    const account = await TradingAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Account not found' })
    }

    account.pin = newPin
    await account.save()

    res.json({ message: 'PIN reset successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error resetting PIN', error: error.message })
  }
})

// POST /api/trading-accounts/:id/transfer - Transfer funds between Main Wallet and Account Wallet
router.post('/:id/transfer', async (req, res) => {
  try {
    const { userId, amount, pin, direction, skipPinVerification } = req.body

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' })
    }

    // Get trading account
    const account = await TradingAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Account not found' })
    }

    // Verify PIN only if not skipped
    if (!skipPinVerification) {
      if (!pin || pin.length !== 4) {
        return res.status(400).json({ message: 'Invalid PIN' })
      }
      const isValidPin = await account.verifyPin(pin)
      if (!isValidPin) {
        return res.status(400).json({ message: 'Incorrect PIN' })
      }
    }

    // Check account status
    if (account.status !== 'Active') {
      return res.status(400).json({ message: 'Account is not active' })
    }

    // Get main wallet
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 })
      await wallet.save()
    }

    if (direction === 'deposit') {
      // Transfer from Main Wallet to Account Wallet
      if (wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient wallet balance' })
      }

      wallet.balance -= amount
      account.balance += amount
      
      await wallet.save()
      await account.save()

      // Log transaction
      await Transaction.create({
        userId,
        type: 'Transfer_To_Account',
        amount,
        paymentMethod: 'Internal',
        tradingAccountId: account._id,
        tradingAccountName: account.accountId,
        status: 'Completed',
        transactionRef: `TRF${Date.now()}`
      })

      res.json({ 
        message: 'Funds transferred to account successfully',
        walletBalance: wallet.balance,
        accountBalance: account.balance
      })
    } else if (direction === 'withdraw') {
      // Transfer from Account Wallet to Main Wallet
      if (account.balance < amount) {
        return res.status(400).json({ message: 'Insufficient account balance' })
      }

      account.balance -= amount
      wallet.balance += amount
      
      await account.save()
      await wallet.save()

      // Log transaction
      await Transaction.create({
        userId,
        type: 'Transfer_From_Account',
        amount,
        paymentMethod: 'Internal',
        tradingAccountId: account._id,
        tradingAccountName: account.accountId,
        status: 'Completed',
        transactionRef: `TRF${Date.now()}`
      })

      res.json({ 
        message: 'Funds withdrawn to main wallet successfully',
        walletBalance: wallet.balance,
        accountBalance: account.balance
      })
    } else {
      return res.status(400).json({ message: 'Invalid transfer direction' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error transferring funds', error: error.message })
  }
})

// POST /api/trading-accounts/account-transfer - Transfer between trading accounts
router.post('/account-transfer', async (req, res) => {
  try {
    const { userId, fromAccountId, toAccountId, amount, pin, skipPinVerification } = req.body

    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ message: 'Both source and target accounts are required' })
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ message: 'Cannot transfer to the same account' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid transfer amount' })
    }

    // Get source account
    const fromAccount = await TradingAccount.findById(fromAccountId)
    if (!fromAccount) {
      return res.status(404).json({ message: 'Source account not found' })
    }

    // Verify ownership
    if (fromAccount.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized access to source account' })
    }

    // Verify PIN if required
    if (!skipPinVerification) {
      const isPinValid = await bcrypt.compare(pin, fromAccount.pin)
      if (!isPinValid) {
        return res.status(401).json({ message: 'Invalid PIN' })
      }
    }

    // Check source account status and balance
    if (fromAccount.status !== 'Active') {
      return res.status(400).json({ message: 'Source account is not active' })
    }

    if (fromAccount.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance in source account' })
    }

    // Get target account
    const toAccount = await TradingAccount.findById(toAccountId)
    if (!toAccount) {
      return res.status(404).json({ message: 'Target account not found' })
    }

    // Verify target account ownership
    if (toAccount.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized access to target account' })
    }

    if (toAccount.status !== 'Active') {
      return res.status(400).json({ message: 'Target account is not active' })
    }

    // Perform transfer
    fromAccount.balance -= amount
    toAccount.balance += amount

    await fromAccount.save()
    await toAccount.save()

    // Log transaction for sender (debit)
    await Transaction.create({
      userId,
      type: 'Account_Transfer_Out',
      amount,
      paymentMethod: 'Internal',
      tradingAccountId: fromAccount._id,
      tradingAccountName: fromAccount.accountId,
      toTradingAccountId: toAccount._id,
      toTradingAccountName: toAccount.accountId,
      status: 'Completed',
      transactionRef: `ACCTRF${Date.now()}`
    })

    // Log transaction for receiver (credit)
    await Transaction.create({
      userId,
      type: 'Account_Transfer_In',
      amount,
      paymentMethod: 'Internal',
      tradingAccountId: toAccount._id,
      tradingAccountName: toAccount.accountId,
      fromTradingAccountId: fromAccount._id,
      fromTradingAccountName: fromAccount.accountId,
      status: 'Completed',
      transactionRef: `ACCTRF${Date.now()}`
    })

    console.log(`[Account Transfer] ${fromAccount.accountId} -> ${toAccount.accountId}: $${amount}`)

    res.json({
      success: true,
      message: `$${amount} transferred from ${fromAccount.accountId} to ${toAccount.accountId}`,
      fromAccountBalance: fromAccount.balance,
      toAccountBalance: toAccount.balance
    })
  } catch (error) {
    console.error('Account transfer error:', error)
    res.status(500).json({ message: 'Error transferring funds', error: error.message })
  }
})

export default router
