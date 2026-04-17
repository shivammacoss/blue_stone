import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Symbols to display in ticker
const TICKER_SYMBOLS = [
  { key: 'EURUSD', display: 'EUR/USD' },
  { key: 'GBPUSD', display: 'GBP/USD' },
  { key: 'USDJPY', display: 'USD/JPY' },
  { key: 'XAUUSD', display: 'XAU/USD' },
  { key: 'BTCUSD', display: 'BTC/USD' },
  { key: 'ETHUSD', display: 'ETH/USD' },
  { key: 'USDCHF', display: 'USD/CHF' },
  { key: 'AUDUSD', display: 'AUD/USD' },
  { key: 'NZDUSD', display: 'NZD/USD' },
  { key: 'USDCAD', display: 'USD/CAD' },
  { key: 'XAGUSD', display: 'XAG/USD' },
  { key: 'SOLUSD', display: 'SOL/USD' },
];

interface PriceData {
  bid: number;
  ask: number;
  change?: number;
}

// Color palette for badges
const BADGE_COLORS = [
  'from-amber-500/20 to-yellow-500/20 border-amber-500/30',      // Gold - XAU
  'from-orange-500/20 to-amber-500/20 border-orange-500/30',     // Orange - BTC
  'from-blue-500/20 to-indigo-500/20 border-blue-500/30',        // Blue - ETH
  'from-emerald-500/20 to-green-500/20 border-emerald-500/30',   // Green
  'from-cyan-500/20 to-teal-500/20 border-cyan-500/30',          // Cyan
  'from-purple-500/20 to-violet-500/20 border-purple-500/30',    // Purple
  'from-pink-500/20 to-rose-500/20 border-pink-500/30',          // Pink
  'from-red-500/20 to-orange-500/20 border-red-500/30',          // Red
  'from-teal-500/20 to-emerald-500/20 border-teal-500/30',       // Teal
  'from-indigo-500/20 to-purple-500/20 border-indigo-500/30',    // Indigo
  'from-slate-400/20 to-gray-500/20 border-slate-400/30',        // Silver - XAG
  'from-violet-500/20 to-fuchsia-500/20 border-violet-500/30',   // Violet
];

function TickerItem({ symbol, price, colorIndex }: {
  symbol: string;
  price: string;
  colorIndex: number;
}) {
  const colorClass = BADGE_COLORS[colorIndex % BADGE_COLORS.length];
  
  return (
    <div className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-full bg-gradient-to-r ${colorClass} border backdrop-blur-sm hover:scale-105 transition-all duration-300 cursor-pointer`}>
      <span className="text-sm font-semibold text-white/90">{symbol}</span>
      <span className="text-sm font-bold text-white">{price}</span>
    </div>
  );
}

export default function MarketTicker() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO for real-time prices
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[MarketTicker] Connected to price stream');
      socket.emit('subscribePrices');
    });

    socket.on('priceStream', (data: { prices: Record<string, PriceData> }) => {
      if (data.prices) {
        setPrices((prev: Record<string, PriceData>) => ({ ...prev, ...data.prices }));
      }
    });

    socket.on('priceUpdate', (data: { symbol: string; price: PriceData }) => {
      if (data.symbol && data.price) {
        setPrices((prev: Record<string, PriceData>) => ({ ...prev, [data.symbol]: data.price }));
      }
    });

    return () => {
      socket.emit('unsubscribePrices');
      socket.disconnect();
    };
  }, []);

  // Format price based on symbol
  const formatPrice = (symbol: string, price: number): string => {
    if (!price) return '-.--';
    if (symbol.includes('JPY')) return price.toFixed(2);
    if (['BTCUSD', 'ETHUSD', 'XAUUSD'].includes(symbol)) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (symbol === 'XAGUSD') return price.toFixed(3);
    return price.toFixed(4);
  };

  // Build market data from live prices
  const marketData = TICKER_SYMBOLS.map(s => {
    const priceData = prices[s.key];
    return {
      symbol: s.display,
      price: formatPrice(s.key, priceData?.bid || 0)
    };
  });

  // Duplicate data for seamless loop
  const duplicatedData = [...marketData, ...marketData];

  return (
    <section className="relative py-4 bg-bluestone-dark/80 backdrop-blur-sm border-y border-white/5 overflow-hidden">
      {/* Gradient Masks */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-bluestone-dark to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-bluestone-dark to-transparent z-10 pointer-events-none" />

      {/* Scrolling Ticker */}
      <div className="flex animate-ticker items-center">
        {duplicatedData.map((item, index) => (
          <TickerItem
            key={`${item.symbol}-${index}`}
            symbol={item.symbol}
            price={item.price}
            colorIndex={index % TICKER_SYMBOLS.length}
          />
        ))}
      </div>
    </section>
  );
}
