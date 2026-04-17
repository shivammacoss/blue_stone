import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavigationProps {
  scrollY: number;
}

const navLinks = [
  { name: 'Home', href: '#hero' },
  { name: 'Forex', href: '#forex' },
  { name: 'Funding', href: '#funding' },
  { name: 'Introducing Broker', href: '/ib-program' },
  { name: 'Copy Trading', href: '/copy-trading' },
  { name: 'About Us', href: '#about' },
  { name: 'Contact', href: '#contact' },
];

const accountLinks = [
  { name: 'Standard A/C', href: '/accounts/standard' },
  { name: 'Pro A/C', href: '/accounts/pro' },
  { name: 'ECN A/C', href: '/accounts/ecn' },
];

const fundingLinks = [
  { name: 'Starter Fund – $5K', href: '/funding/starter' },
  { name: 'Growth Fund – $10K', href: '/funding/growth' },
  { name: 'Pro Fund – $25K', href: '/funding/pro' },
  { name: 'Elite Fund – $50K', href: '/funding/elite' },
  { name: 'Prime Fund – $100K', href: '/funding/prime' },
  { name: 'Custom Plan', href: '/funding/custom', isImage: true },
  { name: 'Exclusive Plan', href: '/funding/exclusive', isImage: true },
];

export default function Navigation({ scrollY }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isForexOpen, setIsForexOpen] = useState(false);
  const [isFundingOpen, setIsFundingOpen] = useState(false);

  const isScrolled = scrollY > 50;

  useEffect(() => {
    // Track scroll state for background styling
    if (scrollY > 100) {
      setIsVisible(true);
    } else {
      setIsVisible(true);
    }
  }, [scrollY]);

  const scrollToSection = (href: string) => {
    setIsMenuOpen(false);

    if (href.startsWith('/')) {
      navigate(href);
      return;
    }

    const target = document.querySelector(href);
    if (target) {
      const offset = window.innerWidth < 1024 ? 80 : 100;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    } else if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: href } });
    }
  };

  return (
    <>
      {/* Fixed Navigation with Slide-Down Effect */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-bluestone-deep/30 backdrop-blur-xl border-b border-white/10 shadow-lg'
            : 'bg-white/10 backdrop-blur-md border-b border-white/5'
        }`}
        style={{
          transform: 'translateY(0)',
          opacity: 1,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <a
              href="#hero"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('#hero');
              }}
              className="flex items-center group"
            >
              <img
                src="/logo.png"
                alt="Bluestone"
                className="h-10 w-auto object-contain transform group-hover:scale-105 transition-transform duration-400"
              />
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link, index) => {
                if (link.name === 'Forex') {
                  return (
                    <div
                      key="forex-dropdown"
                      className="relative"
                      onMouseEnter={() => setIsForexOpen(true)}
                      onMouseLeave={() => setIsForexOpen(false)}
                    >
                      <button
                        className="relative text-sm font-medium text-white/80 hover:text-white transition-colors duration-400 nav-underline"
                        style={{
                          animationDelay: `${index * 80}ms`,
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
                          transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms`,
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToSection('#forex');
                        }}
                      >
                        Forex
                      </button>
                      <div
                        className={`absolute left-0 mt-2 w-44 rounded-2xl bg-bluestone-deep/95 border border-white/10 shadow-xl backdrop-blur transition-all duration-300 ${
                          isForexOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                        }`}
                      >
                        <div className="py-2">
                          {accountLinks.map((acct) => (
                            <button
                              key={acct.href}
                              className="w-full text-left px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                scrollToSection(acct.href);
                              }}
                            >
                              {acct.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (link.name === 'Funding') {
                  return (
                    <div
                      key="funding-dropdown"
                      className="relative"
                      onMouseEnter={() => setIsFundingOpen(true)}
                      onMouseLeave={() => setIsFundingOpen(false)}
                    >
                      <button
                        className="relative text-sm font-medium text-white/80 hover:text-white transition-colors duration-400 nav-underline"
                        style={{
                          animationDelay: `${index * 80}ms`,
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
                          transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms`,
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToSection('#funding');
                        }}
                      >
                        Funding
                      </button>
                      <div
                        className={`absolute left-0 mt-2 w-56 rounded-2xl bg-bluestone-deep/95 border border-white/10 shadow-xl backdrop-blur transition-all duration-300 ${
                          isFundingOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                        }`}
                      >
                        <div className="py-2">
                          {fundingLinks.map((fund, idx) => (
                            <button
                              key={fund.href}
                              className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-gradient-to-r hover:from-gold/10 hover:to-transparent transition-all duration-200 flex items-center gap-2 group"
                              onClick={(e) => {
                                e.preventDefault();
                                scrollToSection(fund.href);
                              }}
                              style={{ transitionDelay: `${idx * 30}ms` }}
                            >
                              {fund.isImage && (
                                <span className="w-5 h-5 rounded bg-gold/20 flex items-center justify-center text-xs text-gold">★</span>
                              )}
                              <span className="group-hover:translate-x-1 transition-transform duration-200">{fund.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(link.href);
                    }}
                    className="relative text-sm font-medium text-white/80 hover:text-white transition-colors duration-400 nav-underline"
                    style={{
                      animationDelay: `${index * 80}ms`,
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
                      transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms`,
                    }}
                  >
                    {link.name}
                  </a>
                );
              })}
            </div>

            {/* CTA Buttons */}
            <div 
              className="hidden lg:flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.3s, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
              }}
            >
              <button 
                onClick={() => navigate('/user/login')}
                className="text-sm font-medium text-white/80 hover:text-white transition-colors duration-400"
              >
                Login
              </button>
              <button 
                onClick={() => navigate('/user/signup')}
                className="btn-primary text-sm py-2.5 px-5 animate-pulse-glow"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors duration-400"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden absolute top-full left-0 right-0 bg-bluestone-deep/98 backdrop-blur-xl border-b border-white/10 transition-all duration-500 ${
            isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link, index) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href);
                }}
                className="block text-lg font-medium text-white/80 hover:text-white transition-colors duration-400"
                style={{
                  opacity: isMenuOpen ? 1 : 0,
                  transform: isMenuOpen ? 'translateX(0)' : 'translateX(-20px)',
                  transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms`,
                }}
              >
                {link.name}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <button 
                onClick={() => { setIsMenuOpen(false); navigate('/user/login'); }}
                className="w-full py-3 text-center text-white/80 border border-white/20 rounded-xl hover:bg-white/5 transition-colors duration-400"
              >
                Login
              </button>
              <button 
                onClick={() => { setIsMenuOpen(false); navigate('/user/signup'); }}
                className="w-full py-3 text-center btn-primary"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
