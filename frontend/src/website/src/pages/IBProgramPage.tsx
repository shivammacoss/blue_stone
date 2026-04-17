import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, BarChart3, Zap, Shield, Headphones, Link2, LayoutDashboard, Image, FileText, UserCheck, ChevronDown, ChevronUp, TrendingUp, Globe, Award, Briefcase } from 'lucide-react';
import Footer from '../sections/Footer';
import { API_URL, getPublicUploadUrl } from '../lib/api';

type ActiveBanner = {
  _id: string;
  title?: string;
  imageUrl: string;
  link?: string;
  order?: number;
};

const benefits = [
  { text: 'Competitive rebate structure', icon: DollarSign },
  { text: 'Unlimited earning potential', icon: TrendingUp },
  { text: 'Real-time commission tracking', icon: BarChart3 },
  { text: 'Instant partner dashboard', icon: LayoutDashboard },
  { text: 'Fast payouts', icon: Zap },
  { text: 'Dedicated partner support', icon: Headphones },
  { text: 'Marketing materials provided', icon: Image },
];

const commissionLevels = [
  { level: 'Level 1 Clients', rebate: 'Standard Rebate', color: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' },
  { level: 'High Volume Clients', rebate: 'Increased Rebate', color: 'from-gold/20 to-amber-500/20', border: 'border-gold/30' },
  { level: 'VIP Partners', rebate: 'Custom Commission Plans', color: 'from-purple-500/20 to-purple-600/20', border: 'border-purple-500/30' },
];

const steps = [
  { step: '01', title: 'Register as Partner', description: 'Complete a simple registration form to join our IB network.', icon: UserCheck },
  { step: '02', title: 'Share Your Referral Link', description: 'Get your unique referral link and share it with your network.', icon: Link2 },
  { step: '03', title: 'Earn Commission on Trades', description: 'Earn commissions every time your referrals trade.', icon: DollarSign },
];

const whyChooseUs = [
  { text: 'Reliable trading infrastructure', icon: Shield },
  { text: 'Transparent reporting', icon: BarChart3 },
  { text: 'Secure system', icon: Shield },
  { text: 'Long-term partnership model', icon: Users },
  { text: 'Trusted platform environment', icon: Award },
];

const partnerTools = [
  { text: 'Custom referral links', icon: Link2 },
  { text: 'Tracking dashboard', icon: LayoutDashboard },
  { text: 'Marketing banners', icon: Image },
  { text: 'Landing pages', icon: FileText },
  { text: 'Dedicated account manager', icon: Headphones },
];

const faqs = [
  { question: 'Who can become an IB?', answer: 'Anyone with a trading audience or network can become an Introducing Broker. Whether you are a trader, educator, signal provider, influencer, or community owner.' },
  { question: 'How do I get paid?', answer: 'Commissions are paid directly to your account. You can withdraw your earnings at any time through our secure payment system.' },
  { question: 'Is there any joining fee?', answer: 'No, joining our IB program is completely free. There are no hidden charges or setup fees.' },
  { question: 'Can I track my earnings?', answer: 'Yes, we provide a real-time tracking dashboard where you can monitor your referrals, trades, and commission earnings.' },
];

const ibTypes = [
  { text: 'Trader', icon: TrendingUp },
  { text: 'Educator', icon: Briefcase },
  { text: 'Signal Provider', icon: BarChart3 },
  { text: 'Influencer', icon: Globe },
  { text: 'Community Owner', icon: Users },
];

export default function IBProgramPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [partnerSpotlightBanner, setPartnerSpotlightBanner] = useState<ActiveBanner | null>(null);
  const [introStatsBanner, setIntroStatsBanner] = useState<ActiveBanner | null>(null);
  const [ibBannerLoading, setIbBannerLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [partnerRes, introRes] = await Promise.all([
          fetch(`${API_URL}/banners/active?type=ib`),
          fetch(`${API_URL}/banners/active?type=ib_intro`),
        ]);
        if (cancelled) return;
        const partnerData = await partnerRes.json();
        const introData = await introRes.json();
        if (partnerData.success && Array.isArray(partnerData.banners) && partnerData.banners[0]) {
          setPartnerSpotlightBanner(partnerData.banners[0]);
        }
        if (introData.success && Array.isArray(introData.banners) && introData.banners[0]) {
          setIntroStatsBanner(introData.banners[0]);
        }
      } catch {
        /* keep fallback UI */
      } finally {
        if (!cancelled) setIbBannerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Hero Banner */}
      <section className="pt-32 pb-24 relative overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-bluestone-accent/10 rounded-full blur-3xl animate-orb-1" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-bluestone-royal/10 rounded-full blur-3xl animate-orb-2" />
        </div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block bg-gold/20 text-gold text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              PARTNER PROGRAM
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Earn More With Our<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-amber-400">Introducing Broker Program</span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Partner with us, refer traders, and earn competitive commissions with transparent tracking and real-time reporting.
            </p>
          </div>
        </div>
      </section>

      {/* What is IB Program */}
      <section className="py-20 bg-bluestone-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-6">
                What Is an <span className="text-gold">Introducing Broker?</span>
              </h2>
              <p className="text-white/70 text-lg mb-6">
                An Introducing Broker (IB) is a partner who refers traders to our platform and earns commission based on their trading activity.
              </p>
              <p className="text-white/70 mb-8">
                IBs play a vital role in expanding the trading community while building a sustainable income stream.
              </p>
              <p className="text-white/60 mb-4">Whether you are:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ibTypes.map((type) => (
                  <div key={type.text} className="flex items-center gap-2 bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                    <type.icon className="w-5 h-5 text-gold" />
                    <span className="text-white/80 text-sm">{type.text}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/70 mt-6">
                You can become a successful IB partner.
              </p>
            </div>
            <div className="relative min-h-[280px]">
              {ibBannerLoading ? (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-3xl p-8 border border-white/10 h-64 flex items-center justify-center">
                  <div className="w-full h-48 rounded-2xl bg-white/5 animate-pulse" aria-hidden />
                </div>
              ) : introStatsBanner ? (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-3xl overflow-hidden border border-white/10">
                  {introStatsBanner.link ? (
                    <a
                      href={introStatsBanner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl overflow-hidden"
                    >
                      <img
                        src={getPublicUploadUrl(introStatsBanner.imageUrl)}
                        alt={introStatsBanner.title || 'Introducing Broker'}
                        className="w-full h-auto object-cover max-h-[320px] block"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  ) : (
                    <img
                      src={getPublicUploadUrl(introStatsBanner.imageUrl)}
                      alt={introStatsBanner.title || 'Introducing Broker'}
                      className="w-full h-auto object-cover max-h-[320px] block rounded-2xl"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  {introStatsBanner.title ? (
                    <p className="text-center text-white/70 text-sm py-3 px-4">{introStatsBanner.title}</p>
                  ) : null}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-3xl p-8 border border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gold/10 rounded-2xl p-6 text-center">
                      <DollarSign className="w-10 h-10 text-gold mx-auto mb-3" />
                      <p className="text-2xl font-bold text-white">$10M+</p>
                      <p className="text-white/60 text-sm">Paid to Partners</p>
                    </div>
                    <div className="bg-blue-500/10 rounded-2xl p-6 text-center">
                      <Users className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                      <p className="text-2xl font-bold text-white">5,000+</p>
                      <p className="text-white/60 text-sm">Active IBs</p>
                    </div>
                    <div className="bg-purple-500/10 rounded-2xl p-6 text-center">
                      <Globe className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                      <p className="text-2xl font-bold text-white">50+</p>
                      <p className="text-white/60 text-sm">Countries</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-2xl p-6 text-center">
                      <TrendingUp className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                      <p className="text-2xl font-bold text-white">90%</p>
                      <p className="text-white/60 text-sm">Partner Retention</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-bluestone-deep">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Join Our <span className="text-gold">IB Program?</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Unlock exclusive benefits designed to maximize your earning potential.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {benefits.map((benefit) => (
              <div
                key={benefit.text}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-gold/30 transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/30 transition-colors">
                  <benefit.icon className="w-6 h-6 text-gold" />
                </div>
                <p className="text-white font-medium">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="py-20 bg-bluestone-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Transparent <span className="text-gold">Commission Model</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              We provide one of the most rewarding IB commission structures designed to grow with your client volume.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {commissionLevels.map((level, idx) => (
              <div
                key={level.level}
                className={`relative bg-gradient-to-br ${level.color} rounded-2xl p-8 border ${level.border} text-center hover:scale-[1.02] transition-all duration-300`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-bluestone-dark px-4 py-1 rounded-full border border-white/10">
                  <span className="text-white/60 text-xs">Level {idx + 1}</span>
                </div>
                <h3 className="text-xl font-bold text-white mt-4 mb-2">{level.level}</h3>
                <p className="text-gold font-semibold">{level.rebate}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-white/50 mt-8 text-sm">
            Higher volume = Higher earnings.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-bluestone-deep">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Start Earning In <span className="text-gold">3 Simple Steps</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={step.step} className="relative">
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-gold/50 to-transparent" />
                )}
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center hover:border-gold/30 transition-all duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-gold/20 flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-8 h-8 text-gold" />
                  </div>
                  <span className="text-gold text-4xl font-bold opacity-30">{step.step}</span>
                  <h3 className="text-xl font-bold text-white mt-2 mb-3">{step.title}</h3>
                  <p className="text-white/60 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Partner With Us */}
      <section className="py-20 bg-bluestone-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-8">
                Why Partner <span className="text-gold">With Us?</span>
              </h2>
              <div className="space-y-4">
                {whyChooseUs.map((item) => (
                  <div key={item.text} className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="w-10 h-10 rounded-lg bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-gold" />
                    </div>
                    <span className="text-white/90">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="min-h-[280px] flex items-center justify-center">
              {ibBannerLoading ? (
                <div className="w-full h-64 rounded-2xl bg-white/5 animate-pulse" aria-hidden />
              ) : partnerSpotlightBanner ? (
                <div className="w-full flex items-center justify-center">
                  {partnerSpotlightBanner.link ? (
                    <a
                      href={partnerSpotlightBanner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={getPublicUploadUrl(partnerSpotlightBanner.imageUrl)}
                        alt={partnerSpotlightBanner.title || 'IB partner program'}
                        className="max-w-full h-auto object-contain max-h-[420px] block mx-auto"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center">
                      <img
                        src={getPublicUploadUrl(partnerSpotlightBanner.imageUrl)}
                        alt={partnerSpotlightBanner.title || 'IB partner program'}
                        className="max-w-full h-auto object-contain max-h-[420px] block mx-auto"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}
                  {partnerSpotlightBanner.title ? (
                    <p className="text-center text-white/70 text-sm mt-4">{partnerSpotlightBanner.title}</p>
                  ) : null}
                </div>
              ) : (
                <div className="text-center w-full">
                  <Award className="w-16 h-16 text-gold mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Trusted Partnership</h3>
                  <p className="text-white/60 mb-6">Join thousands of successful partners worldwide</p>
                  <button
                    type="button"
                    onClick={() => navigate('/user/login')}
                    className="btn-primary px-8 py-3 bg-gradient-to-r from-gold to-amber-500 text-bluestone-dark font-semibold"
                  >
                    Become a Partner
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Partner Tools & Support */}
      <section className="py-20 bg-bluestone-deep">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need <span className="text-gold">To Grow</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              We provide our IB partners with tools that help them succeed.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {partnerTools.map((tool) => (
              <div
                key={tool.text}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center hover:border-blue-500/30 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <tool.icon className="w-7 h-7 text-blue-400" />
                </div>
                <p className="text-white/90 text-sm font-medium">{tool.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-bluestone-dark">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Frequently Asked <span className="text-gold">Questions</span>
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-white font-medium pr-4">{faq.question}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-gold flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50 flex-shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-6">
                    <p className="text-white/70">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-r from-gold/20 via-bluestone-deep to-blue-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Start Your IB Journey <span className="text-gold">Today</span>
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">
            Join our partner network and unlock unlimited earning potential by referring traders globally.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-primary px-10 py-4 text-lg bg-gradient-to-r from-gold to-amber-500 text-bluestone-dark font-semibold">
              Become Partner
            </button>
            <button className="px-10 py-4 text-lg border border-white/20 rounded-xl text-white hover:bg-white/10 transition-all duration-300">
              Contact Team
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
