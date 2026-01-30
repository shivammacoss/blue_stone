import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, 
  Shield, 
  Users, 
  Zap, 
  BarChart3, 
  Globe, 
  ArrowRight,
  Play,
  CheckCircle,
  Star,
  ChevronDown
} from 'lucide-react'
import logo from '../assets/logo.png'
import heroVideo from '../assets/hero-video.mp4'

const HomePage = () => {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Advanced Trading',
      description: 'Access forex, crypto, and commodities with real-time market data and lightning-fast execution.'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Secure Platform',
      description: 'Bank-grade security with 256-bit encryption protecting your funds and personal data.'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Copy Trading',
      description: 'Follow and copy successful traders automatically. Earn while you learn from the best.'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Instant Execution',
      description: 'Ultra-low latency order execution with spreads starting from 0.0 pips.'
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'IB Program',
      description: 'Earn unlimited commissions through our 18-level referral program.'
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: '24/7 Support',
      description: 'Round-the-clock customer support to help you succeed in your trading journey.'
    }
  ]

  const stats = [
    { value: '$2.5B+', label: 'Trading Volume' },
    { value: '150K+', label: 'Active Traders' },
    { value: '99.9%', label: 'Uptime' },
    { value: '0.001s', label: 'Execution Speed' }
  ]

  const testimonials = [
    {
      name: 'Rajesh Kumar',
      role: 'Professional Trader',
      content: 'BlueStone has transformed my trading experience. The platform is incredibly fast and reliable.',
      rating: 5
    },
    {
      name: 'Sarah Johnson',
      role: 'Copy Trader',
      content: 'I started with copy trading and now I\'m earning consistent profits. Best decision I ever made!',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'IB Partner',
      content: 'The IB program is amazing. I\'ve built a passive income stream just by referring traders.',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-black/90 backdrop-blur-lg border-b border-gray-800' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <img src={logo} alt="BlueStone" className="h-12 object-contain" />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#stats" className="text-gray-300 hover:text-white transition-colors">Stats</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Testimonials</a>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.location.href = '/user/login'}
                className="text-white hover:text-blue-400 transition-colors font-medium"
              >
                Login
              </button>
              <button 
                onClick={() => window.location.href = '/user/signup'}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-full font-medium transition-all transform hover:scale-105"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Video */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 z-0 w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            webkit-playsinline="true"
            className="absolute top-0 left-0 w-full h-full object-cover"
            style={{ 
              minWidth: '100%', 
              minHeight: '100%',
              width: 'auto',
              height: 'auto'
            }}
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-400 text-sm font-medium">Live Trading Platform</span>
            </div>
            
           <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">Trade Smarter with</span>
              <span className="block bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                BlueStone
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-white/50 max-w-3xl mx-auto mb-8">
              Experience the future of trading with our advanced platform. Trade forex, crypto, and commodities 
              with lightning-fast execution and industry-leading spreads.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button 
                onClick={() => window.location.href = 'https://trade.BlueStone.com/user/signup'}
                className="group bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all transform hover:scale-105 flex items-center gap-2"
              >
                Start Trading Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => window.location.href = 'https://trade.BlueStone.com/user/login'}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-full font-semibold text-lg transition-all border border-white/20"
              >
                Login to Account
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Choose <span className="text-blue-500">BlueStone</span>?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We provide everything you need to succeed in the financial markets
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-6 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:transform hover:-translate-y-2"
              >
                <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-20 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Trusted by Traders <span className="text-blue-500">Worldwide</span>
              </h2>
              <p className="text-gray-400 mb-8">
                Join thousands of successful traders who have chosen BlueStone as their preferred trading platform. 
                Our commitment to excellence and innovation sets us apart.
              </p>
              <ul className="space-y-4">
                {['Regulated & Licensed', 'Segregated Client Funds', 'Negative Balance Protection', 'Free Demo Account'].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="bg-black/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center">
                  <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-gray-400 mt-2">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What Our <span className="text-blue-500">Traders</span> Say
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Real stories from real traders who have achieved success with BlueStone
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-6 border border-gray-700/50"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 italic">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-gray-400 text-sm">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-cyan-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to Start Your Trading Journey?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Join BlueStone today and get access to world-class trading tools, 
            educational resources, and 24/7 support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => window.location.href = '/user/signup'}
              className="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              Create Free Account
            </button>
            <button 
              onClick={() => window.location.href = '/user/login'}
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/10 transition-all"
            >
              Login
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <img src={logo} alt="BlueStone" className="h-10 object-contain mb-4" />
              <p className="text-gray-400 text-sm">
                Your trusted partner in forex and crypto trading. Trade with confidence.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Trading</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Forex Trading</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Crypto Trading</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Copy Trading</a></li>
                <li><a href="#" className="hover:text-white transition-colors">IB Program</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Risk Disclosure</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AML Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>© 2026 BlueStone. All rights reserved.</p>
            <p className="mt-2 text-xs">
              Trading involves significant risk of loss. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom Styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
      `}</style>
    </div>
  )
}

export default HomePage
