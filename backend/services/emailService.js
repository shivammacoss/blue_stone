import nodemailer from 'nodemailer'
import EmailSettings from '../models/EmailSettings.js'
import EmailTemplate from '../models/EmailTemplate.js'

let transporter = null

/**
 * Resolve effective SMTP config: prefer EmailSettings DB doc (admin can edit
 * via UI), fall back to SMTP_* env vars so a fresh production deploy can
 * bootstrap login OTP without first running admin DB setup. Returns null if
 * neither source has credentials.
 */
export const getSmtpConfig = async () => {
  try {
    const settings = await EmailSettings.findOne()
    if (settings && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
      return {
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        user: settings.smtpUser,
        pass: settings.smtpPass,
        fromName: settings.fromName || 'Bluestone Exchange',
        fromEmail: settings.fromEmail || settings.smtpUser,
        smtpEnabled: settings.smtpEnabled !== false,
        source: 'db'
      }
    }
  } catch (err) {
    console.warn('[Email] EmailSettings query failed, falling back to env vars:', err.message)
  }

  // Env-var fallback (production bootstrap path)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromName: process.env.SMTP_FROM_NAME || 'Bluestone Exchange',
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      smtpEnabled: true,
      source: 'env'
    }
  }

  return null
}

// Initialize or get transporter
const getTransporter = async () => {
  const cfg = await getSmtpConfig()
  if (!cfg) return null

  // Port 465 = direct SSL (secure: true)
  // Port 587 = STARTTLS (secure: false, upgrades to TLS)
  // Port 25 = plain (secure: false)
  const useSecure = cfg.port === 465

  const transportConfig = {
    host: cfg.host,
    port: cfg.port,
    secure: useSecure,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  }

  transporter = nodemailer.createTransport(transportConfig)

  return transporter
}

// Replace template variables
const replaceVariables = (content, variables) => {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, value || '')
  }
  return result
}

// Send email using template
export const sendTemplateEmail = async (templateSlug, toEmail, variables = {}) => {
  try {
    const cfg = await getSmtpConfig()

    if (!cfg) {
      const msg = 'SMTP not configured — set SMTP_HOST/SMTP_USER/SMTP_PASS in .env or configure Email Settings in admin panel'
      console.warn(`[Email] ${msg}`)
      return { success: false, message: msg }
    }

    if (!cfg.smtpEnabled) {
      console.log('[Email] SMTP is disabled in EmailSettings')
      return { success: false, message: 'SMTP is disabled in admin Email Settings' }
    }

    const template = await EmailTemplate.findOne({ slug: templateSlug })
    if (!template) {
      console.warn(`[Email] Template not found: ${templateSlug}`)
      return { success: false, message: `Email template "${templateSlug}" not found (run server restart to auto-seed)` }
    }

    if (!template.isEnabled) {
      console.log(`[Email] Template disabled: ${templateSlug}`)
      return { success: false, message: `Email template "${templateSlug}" is disabled` }
    }

    const transport = await getTransporter()
    if (!transport) {
      return { success: false, message: 'Failed to create SMTP transport' }
    }

    const subject = replaceVariables(template.subject, variables)
    const html = replaceVariables(template.htmlContent, variables)

    const mailOptions = {
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: toEmail,
      subject: subject,
      html: html
    }

    const info = await transport.sendMail(mailOptions)
    console.log(`[Email] Sent via ${cfg.source}: ${info.messageId} → ${toEmail}`)

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('[Email] Send failed:', error)
    return { success: false, message: error.message }
  }
}

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Check if OTP verification is enabled (requires both SMTP and OTP to be enabled)
export const isOTPEnabled = async () => {
  const settings = await EmailSettings.findOne()
  // OTP is only enabled if both SMTP is enabled AND OTP verification is enabled
  if (!settings) return false
  return settings.smtpEnabled && settings.otpVerificationEnabled
}

// Get OTP expiry in minutes
export const getOTPExpiry = () => {
  return 10 // Default 10 minutes
}

// Test SMTP connection
export const testSMTPConnection = async () => {
  try {
    const settings = await EmailSettings.findOne()
    
    // Validate SMTP host is configured and looks like a hostname
    if (!settings || !settings.smtpHost) {
      return { success: false, message: 'SMTP Host is not configured. Please enter a valid SMTP server (e.g., smtp.gmail.com)' }
    }
    
    // Check if smtpHost looks like an email address instead of a hostname
    if (settings.smtpHost.includes('@')) {
      return { success: false, message: 'SMTP Host should be a server hostname (e.g., smtp.gmail.com), not an email address' }
    }
    
    if (!settings.smtpUser) {
      return { success: false, message: 'SMTP Username is not configured' }
    }
    
    if (!settings.smtpPass) {
      return { success: false, message: 'SMTP Password is not configured' }
    }
    
    const transport = await getTransporter()
    if (!transport) {
      return { success: false, message: 'Failed to create SMTP transport' }
    }
    
    await transport.verify()
    return { success: true, message: 'SMTP connection successful' }
  } catch (error) {
    // Provide more helpful error messages for common issues
    if (error.message.includes('EBADNAME') || error.message.includes('ENOTFOUND')) {
      return { success: false, message: 'Invalid SMTP Host. Please check the server hostname (e.g., smtp.gmail.com)' }
    }
    if (error.message.includes('EAUTH') || error.message.includes('authentication')) {
      return { success: false, message: 'Authentication failed. Please check your username and password' }
    }
    return { success: false, message: error.message }
  }
}

// Send OTP email using database template
export const sendOTPEmail = async (toEmail, otp, firstName = 'User') => {
  try {
    // Use the admin_login_otp template from database
    return await sendTemplateEmail('admin_login_otp', toEmail, {
      otp,
      firstName,
      email: toEmail,
      expiryMinutes: '10',
      year: new Date().getFullYear().toString()
    })
  } catch (error) {
    console.error('Error sending OTP email:', error)
    return { success: false, message: error.message }
  }
}

export default {
  sendTemplateEmail,
  sendOTPEmail,
  generateOTP,
  isOTPEnabled,
  getOTPExpiry,
  testSMTPConnection
}
