import express from 'express'
import Notification from '../models/Notification.js'

const router = express.Router()

// Get notifications for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 50, skip = 0, unreadOnly = false } = req.query
    
    const query = { userId }
    if (unreadOnly === 'true') {
      query.read = false
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
    
    const unreadCount = await Notification.countDocuments({ userId, read: false })
    
    res.json({ 
      success: true, 
      notifications,
      unreadCount
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' })
  }
})

// Get unread count
router.get('/user/:userId/unread-count', async (req, res) => {
  try {
    const { userId } = req.params
    const count = await Notification.countDocuments({ userId, read: false })
    res.json({ success: true, count })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get count' })
  }
})

// Mark single notification as read
router.put('/:notifId/read', async (req, res) => {
  try {
    const { notifId } = req.params
    await Notification.findByIdAndUpdate(notifId, { read: true })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' })
  }
})

// Mark all notifications as read for a user
router.put('/user/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params
    await Notification.updateMany({ userId, read: false }, { read: true })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark all as read' })
  }
})

// Delete old notifications (older than 30 days)
router.delete('/user/:userId/cleanup', async (req, res) => {
  try {
    const { userId } = req.params
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await Notification.deleteMany({ userId, createdAt: { $lt: thirtyDaysAgo } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cleanup' })
  }
})

// Create notification (internal use)
router.post('/create', async (req, res) => {
  try {
    const { userId, type, title, message, data } = req.body
    
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      data
    })
    
    await notification.save()
    res.json({ success: true, notification })
  } catch (error) {
    console.error('Error creating notification:', error)
    res.status(500).json({ success: false, message: 'Failed to create notification' })
  }
})

export default router

// Helper function to create notifications (can be imported by other modules)
export const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      data
    })
    await notification.save()
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}
