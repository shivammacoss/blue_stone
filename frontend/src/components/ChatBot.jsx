import { useState, useEffect, useRef } from 'react'
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Headphones,
  HelpCircle,
  Wallet,
  TrendingUp,
  Users,
  Shield,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const API_URL = 'http://localhost:5001/api'

// FAQ Database - Platform related questions and answers
const faqDatabase = [
  {
    keywords: ['deposit', 'add money', 'fund', 'add funds', 'payment'],
    category: 'wallet',
    question: 'How do I deposit money?',
    answer: 'To deposit money:\n1. Go to Wallet section\n2. Click "Deposit"\n3. Choose your payment method (UPI, Bank Transfer, Card)\n4. Enter the amount and complete payment\n\nDeposits are usually instant but may take up to 24 hours.'
  },
  {
    keywords: ['withdraw', 'withdrawal', 'cash out', 'take money'],
    category: 'wallet',
    question: 'How do I withdraw money?',
    answer: 'To withdraw funds:\n1. Go to Wallet section\n2. Click "Withdraw"\n3. Enter the amount (minimum $10)\n4. Add your bank details if not already added\n5. Submit request\n\nWithdrawals are processed within 24-48 hours.'
  },
  {
    keywords: ['account', 'trading account', 'create account', 'new account', 'open account'],
    category: 'account',
    question: 'How do I create a trading account?',
    answer: 'To create a trading account:\n1. Go to "Account" section\n2. Click "Create New Account"\n3. Choose account type (Standard/ECN)\n4. Select leverage (1:100, 1:200, etc.)\n5. Fund your account from wallet\n\nYou can have multiple trading accounts.'
  },
  {
    keywords: ['trade', 'trading', 'buy', 'sell', 'order', 'place order'],
    category: 'trading',
    question: 'How do I place a trade?',
    answer: 'To place a trade:\n1. Go to Trading section\n2. Select an instrument (EUR/USD, Gold, etc.)\n3. Choose BUY or SELL\n4. Enter lot size (volume)\n5. Set Stop Loss & Take Profit (optional)\n6. Click "Execute Trade"\n\nYou can also set pending orders.'
  },
  {
    keywords: ['copy', 'copytrade', 'copy trading', 'follow trader'],
    category: 'copytrade',
    question: 'What is Copy Trading?',
    answer: 'Copy Trading lets you automatically copy trades from expert traders:\n1. Go to "Copytrade" section\n2. Browse available master traders\n3. Check their performance & stats\n4. Click "Copy" and set your investment amount\n5. Their trades will be copied to your account automatically!'
  },
  {
    keywords: ['ib', 'affiliate', 'referral', 'commission', 'partner', 'introduce'],
    category: 'ib',
    question: 'How does the IB Program work?',
    answer: 'Our Introducing Broker (IB) program lets you earn commissions:\n1. Go to "IB" section\n2. Get your unique referral link\n3. Share with friends & traders\n4. Earn commission on their trading volume\n\nCommission rates vary based on your tier level.'
  },
  {
    keywords: ['leverage', 'margin', 'lot', 'lot size'],
    category: 'trading',
    question: 'What is leverage and lot size?',
    answer: 'Leverage: Allows you to control larger positions with less capital. Example: 1:100 means $100 controls $10,000.\n\nLot Size: Trading volume unit.\n- 1 Standard Lot = 100,000 units\n- 0.1 Lot = 10,000 units\n- 0.01 Lot = 1,000 units\n\nHigher leverage = Higher risk & reward.'
  },
  {
    keywords: ['spread', 'commission', 'fee', 'charges', 'cost'],
    category: 'trading',
    question: 'What are the trading fees?',
    answer: 'Our fee structure:\n- Spread: Variable (from 0.1 pips on ECN)\n- Commission: $3-7 per lot depending on account type\n- Swap: Overnight holding fee (varies by instrument)\n- No deposit/withdrawal fees!\n\nCheck each instrument for specific spreads.'
  },
  {
    keywords: ['kyc', 'verify', 'verification', 'document', 'identity'],
    category: 'account',
    question: 'How do I verify my account?',
    answer: 'To complete KYC verification:\n1. Go to Profile section\n2. Click "Verify Account"\n3. Upload ID proof (Passport/Aadhar/License)\n4. Upload address proof (Utility bill/Bank statement)\n5. Wait for approval (usually 24-48 hours)\n\nVerification is required for withdrawals.'
  },
  {
    keywords: ['password', 'reset', 'forgot', 'login issue', 'cant login'],
    category: 'account',
    question: 'I forgot my password',
    answer: 'To reset your password:\n1. Go to login page\n2. Click "Forgot Password"\n3. Enter your registered email\n4. Check email for reset link\n5. Create new password\n\nIf you still have issues, contact support.'
  },
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening'],
    category: 'greeting',
    question: 'Greeting',
    answer: 'Hello! 👋 Welcome to our trading platform! I\'m here to help you with any questions about:\n\n• Deposits & Withdrawals\n• Trading & Orders\n• Account Management\n• Copy Trading\n• IB Program\n\nHow can I assist you today?'
  },
  {
    keywords: ['thank', 'thanks', 'thank you', 'thx'],
    category: 'greeting',
    question: 'Thanks',
    answer: 'You\'re welcome! 😊 Is there anything else I can help you with? Feel free to ask any questions about the platform.'
  }
]

// Quick action buttons
const quickActions = [
  { id: 'deposit', label: 'How to Deposit?', icon: Wallet, keywords: ['deposit'] },
  { id: 'trade', label: 'How to Trade?', icon: TrendingUp, keywords: ['trade'] },
  { id: 'withdraw', label: 'How to Withdraw?', icon: Wallet, keywords: ['withdraw'] },
  { id: 'copytrade', label: 'Copy Trading', icon: Users, keywords: ['copy'] },
  { id: 'verify', label: 'Account Verification', icon: Shield, keywords: ['kyc'] },
  { id: 'human', label: 'Talk to Human', icon: Headphones, keywords: ['human'] },
]

const ChatBot = () => {
  const { isDarkMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [waitingForHuman, setWaitingForHuman] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'bot',
        text: `Hi ${user.name || 'there'}! 👋\n\nWelcome to CoinLytix Support! I'm your virtual assistant and I'm here to help you navigate our trading platform.\n\nYou can ask me about:\n• Deposits & Withdrawals\n• Trading & Orders\n• Account Setup\n• Copy Trading\n• IB Program\n\nOr choose from the quick options below!`,
        timestamp: new Date()
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen])

  // Find answer from FAQ database
  const findAnswer = (userInput) => {
    const input = userInput.toLowerCase().trim()
    
    // Check for human support request
    if (input.includes('human') || input.includes('support') || input.includes('agent') || input.includes('person') || input.includes('talk to someone')) {
      return {
        found: true,
        isHumanRequest: true,
        answer: "I understand you'd like to speak with a human support agent. 🙋‍♂️\n\nPlease wait while I connect you with our support team. A human agent will respond to your query shortly.\n\nIn the meantime, feel free to describe your issue and I'll make sure it reaches our team."
      }
    }

    // Search FAQ database
    for (const faq of faqDatabase) {
      for (const keyword of faq.keywords) {
        if (input.includes(keyword)) {
          return { found: true, answer: faq.answer, category: faq.category }
        }
      }
    }

    // No match found
    return { found: false }
  }

  // Handle sending message
  const handleSend = async () => {
    if (!inputValue.trim()) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulate typing delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500))

    const result = findAnswer(inputValue)

    if (result.found) {
      if (result.isHumanRequest) {
        setWaitingForHuman(true)
        // Save to backend for human support
        try {
          await fetch(`${API_URL}/support/chat-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user._id,
              userName: user.name || user.email,
              message: inputValue,
              type: 'human_request'
            })
          })
        } catch (e) {
          console.error('Failed to save support request:', e)
        }
      }

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: result.answer,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botMessage])
    } else {
      // Unknown question - offer human support
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: "I'm not sure I understand your question completely. 🤔\n\nWould you like me to connect you with a human support agent? They can help you with more specific queries.\n\nOr you can try rephrasing your question, and I'll do my best to help!",
        showHumanOption: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botMessage])

      // Save unknown question for review
      try {
        await fetch(`${API_URL}/support/chat-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user._id,
            userName: user.name || user.email,
            message: inputValue,
            type: 'unknown_question'
          })
        })
      } catch (e) {
        console.error('Failed to save question:', e)
      }
    }

    setIsTyping(false)
  }

  // Handle quick action click
  const handleQuickAction = (action) => {
    if (action.id === 'human') {
      setInputValue('I want to talk to human support')
      setTimeout(() => handleSend(), 100)
    } else {
      const faq = faqDatabase.find(f => 
        action.keywords.some(k => f.keywords.includes(k))
      )
      if (faq) {
        const userMessage = {
          id: Date.now(),
          type: 'user',
          text: action.label,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, userMessage])
        
        setTimeout(() => {
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: faq.answer,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        }, 500)
      }
    }
  }

  // Connect to human support
  const connectToHuman = async () => {
    setWaitingForHuman(true)
    setIsTyping(true)

    await new Promise(resolve => setTimeout(resolve, 1000))

    const botMessage = {
      id: Date.now(),
      type: 'bot',
      text: "I've notified our support team about your request. 🙋‍♂️\n\nA human agent will review your conversation and respond shortly. You'll receive a notification when they reply.\n\nThank you for your patience!",
      timestamp: new Date()
    }
    setMessages(prev => [...prev, botMessage])
    setIsTyping(false)

    // Save to backend
    try {
      await fetch(`${API_URL}/support/chat-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          userName: user.name || user.email,
          messages: messages,
          type: 'human_escalation'
        })
      })
    } catch (e) {
      console.error('Failed to escalate:', e)
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 ${
          isOpen 
            ? 'bg-red-500 hover:bg-red-600 rotate-0' 
            : 'bg-accent-green hover:bg-green-600 animate-bounce'
        }`}
        style={{ animationDuration: '2s' }}
      >
        {isOpen ? (
          <X size={24} className="text-white" />
        ) : (
          <MessageCircle size={24} className="text-black" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-24 right-6 w-96 h-[550px] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300 ${
            isDarkMode ? 'bg-dark-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-accent-green to-green-600 px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold">CoinLytix Support</h3>
              <p className="text-white/80 text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
                {waitingForHuman ? 'Waiting for human agent...' : 'Online - Ready to help'}
              </p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-dark-900' : 'bg-gray-50'}`}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.type === 'user' 
                      ? 'bg-accent-green' 
                      : isDarkMode ? 'bg-dark-700' : 'bg-gray-200'
                  }`}>
                    {msg.type === 'user' ? (
                      <User size={16} className="text-black" />
                    ) : (
                      <Bot size={16} className={isDarkMode ? 'text-accent-green' : 'text-gray-600'} />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div>
                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.type === 'user'
                        ? 'bg-accent-green text-black rounded-br-md'
                        : isDarkMode 
                          ? 'bg-dark-700 text-white rounded-bl-md' 
                          : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-line">{msg.text}</p>
                    </div>
                    <p className={`text-xs mt-1 ${msg.type === 'user' ? 'text-right' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatTime(msg.timestamp)}
                    </p>

                    {/* Human Support Option */}
                    {msg.showHumanOption && !waitingForHuman && (
                      <button
                        onClick={connectToHuman}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                      >
                        <Headphones size={16} />
                        Connect to Human Support
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-dark-700' : 'bg-gray-200'}`}>
                    <Bot size={16} className={isDarkMode ? 'text-accent-green' : 'text-gray-600'} />
                  </div>
                  <div className={`rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-dark-700' : 'bg-white shadow-sm'}`}>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-gray-700 bg-dark-800' : 'border-gray-200 bg-white'}`}>
              <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Quick Actions</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      action.id === 'human'
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                        : isDarkMode 
                          ? 'bg-dark-700 text-gray-300 hover:bg-dark-600' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <action.icon size={14} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-dark-800' : 'border-gray-200 bg-white'}`}>
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2 ${isDarkMode ? 'bg-dark-700' : 'bg-gray-100'}`}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className={`flex-1 bg-transparent outline-none text-sm ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  inputValue.trim()
                    ? 'bg-accent-green text-black hover:bg-green-600'
                    : isDarkMode ? 'bg-dark-600 text-gray-500' : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatBot
