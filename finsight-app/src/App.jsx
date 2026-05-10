import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Activity, BarChart3, Newspaper, Eye, Plus,
  Search, X, ChevronDown, ChevronRight, Filter,
  Briefcase, Target, Shield, Zap, ArrowRight, Sparkles,
  AlertCircle, AlertTriangle, Info, CheckCircle2, Home,
  Settings, RefreshCw, Wifi, Key,
  Calculator, PiggyBank, Calendar, Lightbulb, ShieldAlert,
  Wallet, BookOpen, Menu, Brain, TrendingUp as Trend,
  Crosshair, BarChart2, Globe, Clock
} from 'lucide-react';

/* ============================================================
   FINSIGHT v2 — Real-Time Portfolio Intelligence
   With Finnhub API integration, recommendation engine, retirement planning
   ============================================================ */

const THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@200;300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --ink: #0a0d18; --ink-2: #0e1220;
  --surface: #141927; --surface-2: #1a2030; --surface-3: #232a3d;
  --border: #232a3d; --border-light: #303852;
  --text: #ece7d8; --text-2: #c8c2b0; --text-dim: #8a91a3; --text-faint: #565d70;
  --gold: #d4a945; --gold-bright: #e8c25c; --gold-dim: #8e7330;
  --pos: #5fa872; --pos-bright: #7bc78f;
  --neg: #c97049; --neg-bright: #df8964;
  --info: #6f8fb8;
}
* { box-sizing: border-box; }
html, body, #root { background: var(--ink); margin: 0; padding: 0; }
body { font-family: 'Manrope', system-ui, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; letter-spacing: -0.005em; }
.font-serif { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; }
.font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-feature-settings: 'tnum' 1, 'ss01' 1; }
.tnum { font-variant-numeric: tabular-nums; }
.serif-num { font-family: 'Instrument Serif', serif; font-weight: 400; font-feature-settings: 'tnum' 1; }

.flash-up { animation: flashUp 0.7s ease-out; }
.flash-down { animation: flashDown 0.7s ease-out; }
@keyframes flashUp { 0% { background-color: rgba(95,168,114,0.30); } 100% { background-color: transparent; } }
@keyframes flashDown { 0% { background-color: rgba(201,112,73,0.30); } 100% { background-color: transparent; } }

.fade-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.slide-in-r { animation: slideInR 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideInR { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
.scale-in { animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.pulse-dot { animation: pulseDot 2.4s infinite ease-in-out; }
@keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.skeleton { background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; border-radius: 4px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #252b3d; border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: #303852; }

.grid-bg { background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px); background-size: 40px 40px; }

.btn-primary { background: var(--gold); color: var(--ink); font-weight: 600; transition: all 0.15s ease; }
.btn-primary:hover { background: var(--gold-bright); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.btn-ghost { background: transparent; color: var(--text-dim); border: 1px solid var(--border); transition: all 0.15s ease; }
.btn-ghost:hover { color: var(--text); border-color: var(--border-light); background: var(--surface-2); }
.divider-fade { background: linear-gradient(90deg, transparent, var(--border), transparent); height: 1px; }

input, select, textarea { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); outline: none; transition: border-color 0.15s ease; }
input:focus, select:focus, textarea:focus { border-color: var(--gold); }
input::placeholder { color: var(--text-faint); }

input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; height: 4px; padding: 0; border: none; }
input[type="range"]::-webkit-slider-runnable-track { background: var(--surface-3); border-radius: 2px; height: 4px; }
input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--gold); margin-top: -5px; cursor: pointer; box-shadow: 0 0 0 3px rgba(212,169,69,0.15); }
input[type="range"]::-moz-range-track { background: var(--surface-3); border-radius: 2px; height: 4px; }
input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--gold); border: none; cursor: pointer; }

.no-tap { -webkit-tap-highlight-color: transparent; }
.tooltip-card { background: var(--surface-2); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }

.sidebar { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.main { flex: 1; min-width: 0; }

@media (max-width: 768px) {
  .sidebar { position: fixed; left: -280px; top: 0; bottom: 0; z-index: 50; transition: left 0.3s ease; }
  .sidebar.open { left: 0; }
  .main { margin-left: 0; }
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; display: none; }
  .overlay.open { display: block; }
}
`;

const C = {
  ink: '#0a0d18', surface: '#141927', surface2: '#1a2030', surface3: '#232a3d',
  border: '#232a3d', borderL: '#303852',
  text: '#ece7d8', textDim: '#8a91a3', textFaint: '#565d70',
  gold: '#d4a945', goldBright: '#e8c25c',
  pos: '#5fa872', neg: '#c97049', info: '#6f8fb8',
};

const SECTOR_COLORS = ['#d4a945', '#5fa872', '#c97049', '#6f8fb8', '#a587c1', '#c1a587', '#87a5c1', '#b08aa0', '#9ab086'];

/* ============================================================
   STOCK METADATA & USER PORTFOLIO (from Apr 21, 2026 Fidelity export)
   ============================================================ */

const STOCK_META = {
  AAPL:  { name: 'Apple Inc.',                sector: 'Technology',             industry: 'Consumer Electronics' },
  ADSK:  { name: 'Autodesk Inc.',             sector: 'Technology',             industry: 'Software' },
  AMD:   { name: 'Advanced Micro Devices',    sector: 'Technology',             industry: 'Semiconductors' },
  AMZN:  { name: 'Amazon.com Inc.',           sector: 'Consumer Discretionary', industry: 'Internet Retail' },
  AVGO:  { name: 'Broadcom Inc.',             sector: 'Technology',             industry: 'Semiconductors' },
  BABA:  { name: 'Alibaba Group Holding',     sector: 'Consumer Discretionary', industry: 'Internet Retail' },
  BROS:  { name: 'Dutch Bros Inc.',           sector: 'Consumer Discretionary', industry: 'Restaurants' },
  CL:    { name: 'Colgate-Palmolive Co.',     sector: 'Consumer Staples',       industry: 'Personal Products' },
  COIN:  { name: 'Coinbase Global Inc.',      sector: 'Financials',             industry: 'Capital Markets' },
  GOOG:  { name: 'Alphabet Inc.',             sector: 'Communication Services', industry: 'Internet Content' },
  INTC:  { name: 'Intel Corporation',         sector: 'Technology',             industry: 'Semiconductors' },
  MSFT:  { name: 'Microsoft Corporation',     sector: 'Technology',             industry: 'Software' },
  NVDA:  { name: 'NVIDIA Corporation',        sector: 'Technology',             industry: 'Semiconductors' },
  ORCL:  { name: 'Oracle Corporation',        sector: 'Technology',             industry: 'Software' },
  PG:    { name: 'Procter & Gamble Co.',      sector: 'Consumer Staples',       industry: 'Personal Products' },
  QCOM:  { name: 'Qualcomm Inc.',             sector: 'Technology',             industry: 'Semiconductors' },
  SOUN:  { name: 'SoundHound AI Inc.',        sector: 'Technology',             industry: 'AI Software' },
  TSLA:  { name: 'Tesla Inc.',                sector: 'Consumer Discretionary', industry: 'Auto Manufacturers' },
  TSM:   { name: 'Taiwan Semiconductor Mfg.', sector: 'Technology',             industry: 'Semiconductors' },
  TXN:   { name: 'Texas Instruments Inc.',    sector: 'Technology',             industry: 'Semiconductors' },
  XOM:   { name: 'Exxon Mobil Corporation',   sector: 'Energy',                 industry: 'Oil & Gas' },
  LRCX:  { name: 'Lam Research Corporation',  sector: 'Technology',             industry: 'Semiconductors' },
  AMAT:  { name: 'Applied Materials Inc.',    sector: 'Technology',             industry: 'Semiconductors' },
  KO:    { name: 'Coca-Cola Co.',             sector: 'Consumer Staples',       industry: 'Beverages' },
  JNJ:   { name: 'Johnson & Johnson',         sector: 'Healthcare',             industry: 'Pharmaceuticals' },
  V:     { name: 'Visa Inc.',                 sector: 'Financials',             industry: 'Payment Services' },
  COST:  { name: 'Costco Wholesale',          sector: 'Consumer Staples',       industry: 'Discount Stores' },
};

const STOCK_BETAS = {
  AAPL: 1.18, ADSK: 1.43, AMD: 1.68, AMZN: 1.15, AVGO: 1.13, BABA: 0.51,
  BROS: 2.04, CL: 0.42, COIN: 3.41, GOOG: 1.04, INTC: 0.96, MSFT: 0.92,
  NVDA: 1.74, ORCL: 0.98, PG: 0.41, QCOM: 1.32, SOUN: 2.78, TSLA: 2.06,
  TSM: 1.06, TXN: 1.04, XOM: 0.94, LRCX: 1.42, AMAT: 1.51, KO: 0.59,
  JNJ: 0.52, V: 0.94, COST: 0.78,
};

const PORTFOLIO_DATE = '2026-04-21';

const INITIAL_HOLDINGS = [
  { symbol: 'AAPL', shares: 10,  avgCost: 150.46, lastPrice: 273.05, prevClose: 270.23 },
  { symbol: 'ADSK', shares: 10,  avgCost: 256.17, lastPrice: 245.31, prevClose: 242.02 },
  { symbol: 'AMD',  shares: 10,  avgCost: 131.19, lastPrice: 274.95, prevClose: 278.39 },
  { symbol: 'AMZN', shares: 10,  avgCost: 166.61, lastPrice: 248.28, prevClose: 250.56 },
  { symbol: 'AVGO', shares: 10,  avgCost: 177.54, lastPrice: 399.63, prevClose: 406.54 },
  { symbol: 'BABA', shares: 10,  avgCost: 188.38, lastPrice: 140.17, prevClose: 141.01 },
  { symbol: 'BROS', shares: 15,  avgCost: 63.48,  lastPrice: 54.62,  prevClose: 53.44 },
  { symbol: 'CL',   shares: 15,  avgCost: 94.64,  lastPrice: 83.53,  prevClose: 85.28 },
  { symbol: 'COIN', shares: 15,  avgCost: 257.11, lastPrice: 211.63, prevClose: 206.33 },
  { symbol: 'GOOG', shares: 10,  avgCost: 165.77, lastPrice: 335.40, prevClose: 339.40 },
  { symbol: 'INTC', shares: 25,  avgCost: 19.54,  lastPrice: 65.70,  prevClose: 68.50 },
  { symbol: 'MSFT', shares: 10,  avgCost: 400.57, lastPrice: 418.07, prevClose: 422.79 },
  { symbol: 'NVDA', shares: 50,  avgCost: 112.07, lastPrice: 202.06, prevClose: 201.68 },
  { symbol: 'ORCL', shares: 15,  avgCost: 265.80, lastPrice: 177.58, prevClose: 175.06 },
  { symbol: 'PG',   shares: 10,  avgCost: 157.15, lastPrice: 144.49, prevClose: 146.93 },
  { symbol: 'QCOM', shares: 10,  avgCost: 163.21, lastPrice: 137.52, prevClose: 136.20 },
  { symbol: 'SOUN', shares: 150, avgCost: 15.45,  lastPrice: 8.32,   prevClose: 8.08 },
  { symbol: 'TSLA', shares: 15,  avgCost: 216.75, lastPrice: 392.50, prevClose: 400.62 },
  { symbol: 'TSM',  shares: 20,  avgCost: 180.51, lastPrice: 366.24, prevClose: 370.50 },
  { symbol: 'TXN',  shares: 10,  avgCost: 207.26, lastPrice: 233.70, prevClose: 229.82 },
  { symbol: 'XOM',  shares: 10,  avgCost: 147.72, lastPrice: 147.68, prevClose: 146.44 },
];

const INITIAL_CASH = { symbol: 'SPAXX', label: 'Money Market (SPAXX)', value: 5049.55, apy: 4.27 };

const INITIAL_WATCHLIST = [
  // Technology
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMD',
  // Semiconductors
  'TSM', 'AVGO', 'QCOM', 'INTC', 'LRCX', 'AMAT',
  // Consumer / E-commerce
  'AMZN', 'COST', 'WMT', 'TGT', 'KO', 'PEP',
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'ABBV',
  // Financials
  'JPM', 'BAC', 'V', 'MA', 'GS',
  // Energy
  'XOM', 'CVX',
  // Industrials
  'CAT', 'HON', 'BA',
  // Utilities / REIT
  'NEE', 'AMT',
];

const WATCHLIST_PRICES = {
  LRCX: { lastPrice: 1124.50, prevClose: 1118.20 },
  AMAT: { lastPrice: 218.40,  prevClose: 215.30 },
  KO:   { lastPrice: 71.20,   prevClose: 70.85 },
  JNJ:  { lastPrice: 162.43,  prevClose: 161.80 },
  V:    { lastPrice: 318.42,  prevClose: 316.18 },
  COST: { lastPrice: 928.40,  prevClose: 925.10 },
};

/* ============================================================
   FORMATTERS
   ============================================================ */
const fmt = {
  dollar: (n, dp = 2) => {
    if (n == null || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  },
  big$: (n) => {
    if (n == null) return '—';
    if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (Math.abs(n) >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4)  return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  },
  pct: (n, dp = 2) => {
    if (n == null || isNaN(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return sign + n.toFixed(dp) + '%';
  },
  num: (n, dp = 0) => n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
  shares: (n) => n.toLocaleString('en-US', { maximumFractionDigits: 4 }),
  timeAgo: (date) => {
    if (!date) return 'never';
    const sec = Math.floor((Date.now() - date) / 1000);
    if (sec < 30) return 'just now';
    if (sec < 60) return sec + 's ago';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
  },
};
/* ============================================================
   FINNHUB API LAYER
   ============================================================ */
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

async function fetchQuote(symbol, apiKey) {
  if (!apiKey) throw new Error('No API key');
  const r = await fetch(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${apiKey}`);
  if (!r.ok) {
    if (r.status === 401) throw new Error('Invalid API key');
    if (r.status === 429) throw new Error('Rate limit exceeded');
    throw new Error(`API error ${r.status}`);
  }
  const d = await r.json();
  // Finnhub returns all zeros for unknown symbols. After-hours can return c=0
  // with valid pc — fall back to pc in that case rather than failing the whole batch.
  if (d.c === 0 && d.pc === 0) throw new Error('Symbol not found');
  const price = d.c > 0 ? d.c : d.pc;
  return {
    price, prevClose: d.pc,
    dayChange: d.c > 0 ? d.d : 0,
    dayChangePct: d.c > 0 ? d.dp : 0,
    high: d.h || price, low: d.l || price, open: d.o || price, timestamp: d.t,
  };
}

async function fetchAllQuotes(symbols, apiKey) {
  const results = await Promise.allSettled(
    symbols.map(async s => ({ symbol: s, quote: await fetchQuote(s, apiKey) }))
  );
  const quotes = {};
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') quotes[r.value.symbol] = r.value.quote;
    else errors.push({ symbol: symbols[i], error: r.reason.message });
  });
  return { quotes, errors };
}

/* ============================================================
   PRICE STATE HOOK
   ============================================================ */
function usePriceState(holdings, watchlist) {
  const initialPrices = {};
  holdings.forEach(h => {
    initialPrices[h.symbol] = {
      price: h.lastPrice, prevClose: h.prevClose,
      dayChange: h.lastPrice - h.prevClose,
      dayChangePct: ((h.lastPrice - h.prevClose) / h.prevClose) * 100,
      timestamp: null, source: 'imported',
    };
  });
  watchlist.forEach(s => {
    if (WATCHLIST_PRICES[s]) {
      initialPrices[s] = {
        price: WATCHLIST_PRICES[s].lastPrice, prevClose: WATCHLIST_PRICES[s].prevClose,
        dayChange: WATCHLIST_PRICES[s].lastPrice - WATCHLIST_PRICES[s].prevClose,
        dayChangePct: ((WATCHLIST_PRICES[s].lastPrice - WATCHLIST_PRICES[s].prevClose) / WATCHLIST_PRICES[s].prevClose) * 100,
        timestamp: null, source: 'imported',
      };
    }
  });

  const [prices, setPrices] = useState(initialPrices);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('finsight-api-key') || '');
  const [apiStatus, setApiStatus] = useState('cached');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [flashes, setFlashes] = useState({});
  const [demoMode, setDemoMode] = useState(true);

  const refresh = useCallback(async (symbols) => {
    if (!apiKey) return;
    setApiStatus('loading');
    setErrorMsg(null);
    try {
      const { quotes, errors } = await fetchAllQuotes(symbols, apiKey);
      const newFlashes = {};
      setPrices(prev => {
        const next = { ...prev };
        Object.entries(quotes).forEach(([sym, q]) => {
          const old = prev[sym];
          if (old && Math.abs(q.price - old.price) > 0.001) {
            newFlashes[sym] = q.price > old.price ? 'up' : 'down';
          }
          next[sym] = { ...q, source: 'live' };
        });
        return next;
      });
      setFlashes(newFlashes);
      setTimeout(() => setFlashes({}), 700);

      const totalQuotes = Object.keys(quotes).length;
      if (totalQuotes === 0) {
        setApiStatus('error');
        setErrorMsg(errors[0]?.error || 'API request failed');
      } else {
        setApiStatus('live');
        if (errors.length > 0) setErrorMsg(`${errors.length} symbol(s) failed`);
      }
      setLastUpdated(Date.now());
    } catch (e) {
      setApiStatus('error');
      setErrorMsg(e.message);
    }
  }, [apiKey]);

  // Demo mode price simulation
  useEffect(() => {
    if (apiKey || !demoMode) return;
    const tick = () => {
      const newFlashes = {};
      setPrices(prev => {
        const next = { ...prev };
        Object.keys(prev).forEach(sym => {
          const cur = prev[sym];
          const beta = STOCK_BETAS[sym] || 1.0;
          const vol = 0.0006 + beta * 0.0006;
          const change = (Math.random() - 0.5) * 2 * vol;
          const newPrice = +(cur.price * (1 + change)).toFixed(2);
          if (Math.abs(newPrice - cur.price) > 0.005) {
            newFlashes[sym] = newPrice > cur.price ? 'up' : 'down';
          }
          next[sym] = {
            ...cur, price: newPrice,
            dayChange: newPrice - cur.prevClose,
            dayChangePct: ((newPrice - cur.prevClose) / cur.prevClose) * 100,
            source: 'demo',
          };
        });
        return next;
      });
      setFlashes(newFlashes);
      setTimeout(() => setFlashes({}), 700);
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [apiKey, demoMode]);

  // Auto-refresh when API key is set. Re-runs when holdings/watchlist change
  // so newly-bought tickers get picked up by the 60s poll.
  useEffect(() => {
    if (!apiKey) return;
    const symbols = [...new Set([...holdings.map(h => h.symbol), ...watchlist])];
    if (symbols.length === 0) return;
    refresh(symbols);
    const id = setInterval(() => refresh(symbols), 60000);
    return () => clearInterval(id);
  }, [apiKey, refresh, holdings, watchlist]);

  return { prices, apiKey, setApiKey, apiStatus, lastUpdated, errorMsg, flashes,
           demoMode, setDemoMode, refresh };
}

/* ============================================================
   HISTORICAL DATA GENERATION
   ============================================================ */
function seededRandom(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function genHistory(symbol, endPrice, points, vol = 0.018, drift = 0.0006) {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0) * 17, 1);
  const rng = seededRandom(seed);
  const walk = [1.0];
  for (let i = 1; i < points; i++) {
    const change = (rng() - 0.5) * 2 * vol + drift;
    walk.push(walk[i - 1] * (1 + change));
  }
  const scale = endPrice / walk[walk.length - 1];
  return walk.map((v, i) => ({ i, value: +(v * scale).toFixed(2) }));
}

const RANGES = [
  { key: '1D',  label: '1D',  points: 78,  drift: 0.0001, vol: 0.004 },
  { key: '1W',  label: '1W',  points: 35,  drift: 0.0002, vol: 0.009 },
  { key: '1M',  label: '1M',  points: 30,  drift: 0.0003, vol: 0.013 },
  { key: '3M',  label: '3M',  points: 65,  drift: 0.0004, vol: 0.016 },
  { key: '1Y',  label: '1Y',  points: 252, drift: 0.0005, vol: 0.018 },
  { key: 'ALL', label: 'ALL', points: 600, drift: 0.0006, vol: 0.020 },
];

/* ============================================================
   PORTFOLIO ANALYTICS
   ============================================================ */
function computePortfolio(holdings, prices, cash) {
  let value = cash?.value || 0;
  let prevValue = cash?.value || 0;
  let cost = 0;
  const positions = [];

  holdings.forEach(h => {
    const p = prices[h.symbol];
    if (!p) return;
    const posValue = h.shares * p.price;
    const posPrevValue = h.shares * p.prevClose;
    const posCost = h.shares * h.avgCost;
    value += posValue;
    prevValue += posPrevValue;
    cost += posCost;
    positions.push({
      ...h, ...STOCK_META[h.symbol], ...p,
      value: posValue, cost: posCost,
      dayChangeAbs: posValue - posPrevValue,
      dayChangePct: ((p.price - p.prevClose) / p.prevClose) * 100,
      totalReturn: posValue - posCost,
      totalReturnPct: ((posValue - posCost) / posCost) * 100,
    });
  });

  const dayChange = value - prevValue;
  const dayChangePct = prevValue > 0 ? (dayChange / prevValue) * 100 : 0;
  const totalReturn = value - cost - (cash?.value || 0);
  const totalReturnPct = cost > 0 ? (totalReturn / cost) * 100 : 0;

  return {
    value, prevValue, cost, dayChange, dayChangePct,
    totalReturn, totalReturnPct, positions,
    equityValue: value - (cash?.value || 0),
    cashValue: cash?.value || 0,
  };
}

function computeSectorAllocation(positions, cash) {
  const map = {};
  let total = 0;
  positions.forEach(p => {
    map[p.sector] = (map[p.sector] || 0) + p.value;
    total += p.value;
  });
  if (cash?.value > 0) {
    map['Cash'] = cash.value;
    total += cash.value;
  }
  const data = Object.entries(map)
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
  return { data, total };
}

function computeIndustryAllocation(positions) {
  const map = {};
  let total = 0;
  positions.forEach(p => {
    map[p.industry] = (map[p.industry] || 0) + p.value;
    total += p.value;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

function computeRiskMetrics(positions, cash) {
  const totalValue = positions.reduce((s, p) => s + p.value, 0) + (cash?.value || 0);
  const equityValue = positions.reduce((s, p) => s + p.value, 0);

  const weightedBeta = positions.reduce((sum, p) =>
    sum + (p.value / totalValue) * (STOCK_BETAS[p.symbol] || 1), 0);

  const sectorMap = {};
  positions.forEach(p => { sectorMap[p.sector] = (sectorMap[p.sector] || 0) + p.value; });
  const sectorWeights = Object.values(sectorMap).map(v => v / equityValue);
  const sectorHHI = sectorWeights.reduce((s, w) => s + w * w, 0);

  const sorted = [...positions].sort((a, b) => b.value - a.value);
  const top3Pct = sorted.slice(0, 3).reduce((s, p) => s + p.value, 0) / equityValue * 100;
  const top1Pct = sorted[0] ? (sorted[0].value / equityValue) * 100 : 0;
  const divScore = Math.max(0, Math.min(100, Math.round((1 - sectorHHI) * 110)));

  const cashRatio = totalValue > 0 ? ((cash?.value || 0) / totalValue) * 100 : 0;
  const annualVol = weightedBeta * 16;
  const expectedReturn = 8 + (weightedBeta - 1) * 5;
  const sharpe = (expectedReturn - 4.3) / annualVol;

  return {
    weightedBeta, sectorHHI, top3Pct, top1Pct, divScore,
    cashRatio, annualVol, sharpe, expectedReturn,
    topPosition: sorted[0],
  };
}
/* ============================================================
   RECOMMENDATION ENGINE — 5 Expert Personas
   ============================================================ */

const PERSONAS = {
  cfp:       { id: 'cfp',       name: 'Certified Financial Planner', short: 'CFP',             icon: BookOpen,    color: '#d4a945', desc: 'Retirement strategy & financial planning' },
  tax:       { id: 'tax',       name: 'Tax Strategist',              short: 'Tax',             icon: Calculator,  color: '#5fa872', desc: 'Tax-efficient investing & withdrawal sequencing' },
  portfolio: { id: 'portfolio', name: 'Portfolio Strategist',        short: 'Portfolio',       icon: PiggyBank,   color: '#6f8fb8', desc: 'Asset allocation & rebalancing' },
  risk:      { id: 'risk',      name: 'Risk Analyst',                short: 'Risk',            icon: ShieldAlert, color: '#c97049', desc: 'Stress testing & risk management' },
  ss:        { id: 'ss',        name: 'Social Security Specialist',  short: 'Social Security', icon: Calendar,    color: '#a587c1', desc: 'Claiming strategy optimization' },
};

function generateRecommendations(portfolio, risk, sectorAlloc, retirementProfile, cashRatio) {
  const recs = [];
  const positions = portfolio.positions;
  const totalValue = portfolio.value;

  /* ===== PORTFOLIO STRATEGIST ===== */
  const topSector = sectorAlloc.data[0];
  if (topSector && topSector.pct > 50) {
    recs.push({
      persona: 'portfolio', severity: 'critical',
      title: `Excessive ${topSector.name} concentration`,
      description: `${topSector.pct.toFixed(1)}% of portfolio in ${topSector.name} — well above the 30-35% prudent maximum. A sector-specific drawdown could erase ${fmt.dollar(topSector.value * 0.3, 0)} in a 30% pullback.`,
      action: `Rotate ${fmt.dollar(topSector.value - totalValue * 0.35, 0)} from ${topSector.name} into underweight sectors: Healthcare, Financials, Real Estate.`,
      impact: 'Reduces single-sector tail risk; improves Sharpe ratio.',
      score: 9,
    });
  } else if (topSector && topSector.pct > 35) {
    recs.push({
      persona: 'portfolio', severity: 'warning',
      title: `${topSector.name} sector approaching threshold`,
      description: `${topSector.pct.toFixed(1)}% in ${topSector.name}. Conventional wisdom caps single-sector exposure at 30-35%.`,
      action: 'Consider modest trimming or directing new contributions to other sectors.',
      impact: 'Improves diversification score.',
      score: 6,
    });
  }

  const concentrated = positions.filter(p => (p.value / totalValue) > 0.10);
  concentrated.forEach(p => {
    const pct = (p.value / totalValue) * 100;
    recs.push({
      persona: 'portfolio',
      severity: pct > 15 ? 'critical' : 'warning',
      title: `${p.symbol} concentration risk`,
      description: `${p.symbol} represents ${pct.toFixed(1)}% of portfolio (${fmt.dollar(p.value, 0)}). Single-stock exposure above 10% materially increases idiosyncratic risk.`,
      action: `Consider trimming ${p.symbol} to 8-10% range — sell ${Math.round((p.value - totalValue * 0.10) / p.price)} shares to right-size.`,
      impact: `Reduces single-stock risk by ${(pct - 10).toFixed(1)} pp.`,
      score: pct > 15 ? 8 : 5,
    });
  });

  if (cashRatio > 10) {
    recs.push({
      persona: 'portfolio', severity: 'info',
      title: 'High cash allocation',
      description: `${cashRatio.toFixed(1)}% in cash earning 4.27% APY. While safe, this creates real-return drag of ~3-5% vs equity benchmark.`,
      action: `Deploy ${fmt.dollar((cashRatio - 5) * totalValue / 100, 0)} into a diversified equity index for higher long-term returns.`,
      impact: `Estimated +${fmt.dollar((cashRatio - 5) * totalValue / 100 * 0.04, 0)} annualized return delta.`,
      score: 4,
    });
  } else if (cashRatio < 3) {
    recs.push({
      persona: 'portfolio', severity: 'warning',
      title: 'Insufficient cash buffer',
      description: `Only ${cashRatio.toFixed(1)}% cash. Standard recommendation: 3-6 months expenses (5-10% of portfolio) for liquidity needs.`,
      action: 'Build cash position to ~5% of portfolio over 2-3 months.',
      impact: 'Provides emergency liquidity; enables opportunistic deployment in pullbacks.',
      score: 5,
    });
  }

  /* ===== TAX STRATEGIST ===== */
  const losers = positions.filter(p => p.totalReturn < -300);
  losers.forEach(p => {
    const lossSize = Math.abs(p.totalReturn);
    const taxSavings = lossSize * 0.30;
    recs.push({
      persona: 'tax',
      severity: lossSize > 1000 ? 'opportunity' : 'info',
      title: `Tax-loss harvest: ${p.symbol}`,
      description: `${p.symbol} shows ${fmt.dollar(p.totalReturn, 0)} unrealized loss (${p.totalReturnPct.toFixed(1)}%). Realizing this loss generates ~${fmt.dollar(taxSavings, 0)} in tax benefit at 30% blended rate.`,
      action: `Sell ${p.shares} shares of ${p.symbol}; buy similar-but-not-identical replacement (sector ETF) to maintain exposure. Wait 31 days before repurchasing to avoid wash sale.`,
      impact: `Realized loss: ${fmt.dollar(lossSize, 0)} · Tax benefit: ~${fmt.dollar(taxSavings, 0)}`,
      score: lossSize > 1500 ? 8 : lossSize > 800 ? 6 : 4,
    });
  });

  const bigWinners = positions.filter(p => p.totalReturnPct > 100);
  if (bigWinners.length > 0) {
    const totalEmbeddedGain = bigWinners.reduce((s, p) => s + p.totalReturn, 0);
    const taxLiability = totalEmbeddedGain * 0.20;
    recs.push({
      persona: 'tax', severity: 'info',
      title: 'Embedded long-term gains',
      description: `${bigWinners.length} positions with >100% gains carry ${fmt.dollar(totalEmbeddedGain, 0)} in unrealized appreciation: ${bigWinners.map(p => p.symbol).join(', ')}. Selling triggers ~${fmt.dollar(taxLiability, 0)} in long-term capital gains tax.`,
      action: 'Hold in taxable account; if rebalancing needed, prefer trimming losers or using tax-advantaged accounts. Consider donating appreciated shares for double benefit.',
      impact: 'Defers tax indefinitely; charitable donation eliminates capital gains tax entirely.',
      score: 5,
    });
  }

  if (retirementProfile && retirementProfile.currentAge < 60 && cashRatio > 5) {
    recs.push({
      persona: 'tax', severity: 'opportunity',
      title: 'Roth conversion ladder analysis',
      description: 'Strategic Roth conversions during low-income years (gap between retirement and SS claim) can save substantial lifetime tax.',
      action: 'Model conversions of $30-50K annually in years 1-5 of early retirement to fill 12% bracket. Use cash buffer to pay conversion taxes.',
      impact: 'Estimated lifetime tax savings: $40-80K depending on retirement bracket.',
      score: 5,
    });
  }

  /* ===== RISK ANALYST ===== */
  if (risk.weightedBeta > 1.4) {
    recs.push({
      persona: 'risk', severity: 'warning',
      title: 'Elevated market beta',
      description: `Portfolio beta of ${risk.weightedBeta.toFixed(2)} means a 10% market drop projects to a ${(risk.weightedBeta * 10).toFixed(1)}% portfolio drawdown. Estimated max loss in 2008-style crisis (-37%): ${fmt.dollar(totalValue * (risk.weightedBeta * 0.37), 0)}.`,
      action: 'Add lower-beta defensive holdings: utilities (XLU), staples (XLP), or short-duration bonds. Target portfolio beta 1.0-1.2.',
      impact: 'Reduces drawdown sensitivity; smooths returns through cycles.',
      score: 7,
    });
  }

  if (retirementProfile && retirementProfile.retirementAge - retirementProfile.currentAge < 10) {
    recs.push({
      persona: 'risk', severity: 'critical',
      title: 'Sequence-of-returns risk window',
      description: `${retirementProfile.retirementAge - retirementProfile.currentAge} years to retirement places you in the "fragile decade" where early retirement losses compound dramatically. Studies show first 5 years of retirement returns drive 80% of portfolio survival probability.`,
      action: 'Build a "bucket strategy": 2 years cash, 3-5 years bonds, remainder equities. Reduce equity beta as retirement approaches.',
      impact: 'Increases 30-year portfolio survival probability from ~78% to ~92%.',
      score: 9,
    });
  }

  if (risk.annualVol > 25) {
    recs.push({
      persona: 'risk', severity: 'info',
      title: 'High portfolio volatility',
      description: `Estimated annualized volatility of ${risk.annualVol.toFixed(1)}% means typical year sees swings of ±${risk.annualVol.toFixed(0)}% in either direction.`,
      action: 'If short-term needs exist, ensure 1-2 years of liquidity is held outside this volatility profile.',
      impact: 'Reduces forced selling at unfavorable prices.',
      score: 4,
    });
  }

  /* ===== CFP ===== */
  if (retirementProfile) {
    const yearsToRet = retirementProfile.retirementAge - retirementProfile.currentAge;
    const requiredNestEgg = (retirementProfile.targetMonthlyIncome * 12) / 0.04;
    const realReturn = 0.05;
    const fvCurrent = totalValue * Math.pow(1 + realReturn, yearsToRet);
    const monthlyRate = realReturn / 12;
    const months = yearsToRet * 12;
    const fvContrib = retirementProfile.monthlyContribution *
      ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    const projected = fvCurrent + fvContrib;
    const gap = requiredNestEgg - projected;

    if (gap > 0) {
      const requiredMonthly = (requiredNestEgg - fvCurrent) /
        ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      recs.push({
        persona: 'cfp', severity: 'warning',
        title: `Retirement savings gap: ${fmt.dollar(gap, 0)}`,
        description: `Your target requires nest egg of ${fmt.dollar(requiredNestEgg, 0)} (today's $, 4% rule). At current pace (${fmt.dollar(retirementProfile.monthlyContribution, 0)}/mo), projected to ${fmt.dollar(projected, 0)} — short by ${fmt.dollar(gap, 0)}.`,
        action: `Increase monthly savings to ${fmt.dollar(requiredMonthly, 0)} (${fmt.dollar(requiredMonthly - retirementProfile.monthlyContribution, 0)} additional). Or extend retirement by ~${Math.ceil(gap / (totalValue * 0.07))} years.`,
        impact: `Closes gap; reaches target by age ${retirementProfile.retirementAge}.`,
        score: 8,
      });
    } else {
      recs.push({
        persona: 'cfp', severity: 'positive',
        title: 'On track for retirement target',
        description: `Projected nest egg of ${fmt.dollar(projected, 0)} exceeds required ${fmt.dollar(requiredNestEgg, 0)} by ${fmt.dollar(-gap, 0)}.`,
        action: 'Consider increasing retirement income target or earlier retirement date.',
        impact: 'Buffer against sequence risk and longevity tail.',
        score: 3,
      });
    }
  }

  /* ===== SOCIAL SECURITY ===== */
  if (retirementProfile && retirementProfile.ss62 && retirementProfile.ss70) {
    const lifeExp = 85;
    const lifetimeAt62 = retirementProfile.ss62 * 12 * (lifeExp - 62);
    const lifetimeAt70 = retirementProfile.ss70 * 12 * (lifeExp - 70);
    const advantage = lifetimeAt70 - lifetimeAt62;

    if (advantage > 0) {
      recs.push({
        persona: 'ss', severity: 'opportunity',
        title: 'Delay SS to age 70 for higher lifetime income',
        description: `Claiming at 62: ${fmt.dollar(retirementProfile.ss62, 0)}/mo · Claiming at 70: ${fmt.dollar(retirementProfile.ss70, 0)}/mo (+${(((retirementProfile.ss70/retirementProfile.ss62)-1)*100).toFixed(0)}%). At life expectancy ${lifeExp}, delaying generates ${fmt.dollar(advantage, 0)} more in lifetime SS income.`,
        action: `Plan to bridge ages ${retirementProfile.retirementAge}-70 using portfolio withdrawals. Roth conversion ladder during this window further reduces lifetime tax.`,
        impact: `+${fmt.dollar(advantage, 0)} lifetime · COLA-protected · longevity insurance.`,
        score: 7,
      });
    }
  }

  return recs.sort((a, b) => b.score - a.score);
}

/* ============================================================
   RETIREMENT CALCULATIONS
   ============================================================ */
function calculateRetirement(profile, currentPortfolioValue) {
  const yearsToRetirement = profile.retirementAge - profile.currentAge;
  const yearsInRetirement = profile.lifeExpectancy - profile.retirementAge;

  const annualTarget = profile.targetMonthlyIncome * 12;
  const requiredNestEgg = annualTarget / 0.04;
  const futureRequiredNestEgg = requiredNestEgg * Math.pow(1 + profile.inflation, yearsToRetirement);

  const fvCurrent = currentPortfolioValue * Math.pow(1 + profile.expectedReturn, yearsToRetirement);
  const monthlyRate = profile.expectedReturn / 12;
  const months = yearsToRetirement * 12;
  const fvContributions = months > 0 && monthlyRate > 0 ?
    profile.monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) : 0;

  const projectedTotal = fvCurrent + fvContributions;
  const gap = requiredNestEgg - projectedTotal;

  const requiredMonthly = projectedTotal < requiredNestEgg ?
    (requiredNestEgg - fvCurrent) / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) :
    profile.monthlyContribution;

  return {
    yearsToRetirement, yearsInRetirement,
    annualTarget, requiredNestEgg, futureRequiredNestEgg,
    fvCurrent, fvContributions, projectedTotal, gap, requiredMonthly,
    onTrack: gap <= 0,
    surplus: gap < 0 ? -gap : 0,
  };
}

function randomNormal() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function monteCarloSimulation(profile, currentPortfolioValue, runs = 300) {
  const yearsToRetirement = profile.retirementAge - profile.currentAge;
  const months = yearsToRetirement * 12;
  const meanMonthlyReturn = profile.expectedReturn / 12;
  const monthlyStdDev = (profile.volatility || 0.15) / Math.sqrt(12);

  const trajectories = [];
  for (let r = 0; r < runs; r++) {
    let value = currentPortfolioValue;
    const path = [value];
    for (let m = 0; m < months; m++) {
      const ret = meanMonthlyReturn + monthlyStdDev * randomNormal();
      value = value * (1 + ret) + profile.monthlyContribution;
      if (m % 12 === 11) path.push(value);
    }
    trajectories.push(path);
  }

  const yearCount = trajectories[0].length;
  const percentiles = [];
  for (let y = 0; y < yearCount; y++) {
    const yearVals = trajectories.map(t => t[y]).sort((a, b) => a - b);
    percentiles.push({
      year: y, age: profile.currentAge + y,
      p10: yearVals[Math.floor(runs * 0.10)],
      p25: yearVals[Math.floor(runs * 0.25)],
      p50: yearVals[Math.floor(runs * 0.50)],
      p75: yearVals[Math.floor(runs * 0.75)],
      p90: yearVals[Math.floor(runs * 0.90)],
    });
  }

  const required = (profile.targetMonthlyIncome * 12) / 0.04;
  const finalVals = trajectories.map(t => t[t.length - 1]);
  const successProbability = (finalVals.filter(v => v >= required).length / runs) * 100;

  return { percentiles, successProbability, finalVals, required };
}

function calculateSocialSecurity(profile) {
  const FRA = profile.fullRetirementAge || 67;
  const lifeExp = profile.lifeExpectancy;

  const lifetime62 = profile.ss62 * 12 * (lifeExp - 62);
  const lifetimeFRA = profile.ssFRA * 12 * (lifeExp - FRA);
  const lifetime70 = profile.ss70 * 12 * (lifeExp - 70);

  let be62vs70 = null;
  for (let age = 70; age <= 100; age++) {
    if (profile.ss70 * 12 * (age - 70) >= profile.ss62 * 12 * (age - 62)) { be62vs70 = age; break; }
  }
  let beFRAvs70 = null;
  for (let age = 70; age <= 100; age++) {
    if (profile.ss70 * 12 * (age - 70) >= profile.ssFRA * 12 * (age - FRA)) { beFRAvs70 = age; break; }
  }

  return {
    strategies: [
      { name: 'Claim Early (62)', startAge: 62, monthly: profile.ss62, annual: profile.ss62 * 12, lifetime: lifetime62,
        pros: ['Earliest income', 'Maximum flexibility', 'Useful if life expectancy uncertain'],
        cons: ['Permanently reduced (~30% less than FRA)', 'Lowest lifetime total', 'Loses to COLA inflation'] },
      { name: `Full Retirement Age (${FRA})`, startAge: FRA, monthly: profile.ssFRA, annual: profile.ssFRA * 12, lifetime: lifetimeFRA,
        pros: ['100% of earned benefit', 'Compromise approach', 'Simpler planning'],
        cons: ['Missed delayed credits', 'Suboptimal if longevity expected'] },
      { name: 'Delay to 70', startAge: 70, monthly: profile.ss70, annual: profile.ss70 * 12, lifetime: lifetime70,
        pros: ['Maximum benefit (+24% vs FRA)', 'Best longevity insurance', 'Highest lifetime total typically'],
        cons: ['8 years of bridge needed', 'Lost benefits if early death', 'Requires sufficient assets'] },
    ],
    breakeven: { be62vs70, beFRAvs70 },
    optimalStrategy: lifetime70 > lifetimeFRA && lifetime70 > lifetime62 ? 'Delay to 70' :
                     lifetimeFRA > lifetime62 ? `Full Retirement Age (${FRA})` : 'Claim Early (62)',
  };
}

const DEFAULT_RETIREMENT_PROFILE = {
  currentAge: 38, retirementAge: 65, lifeExpectancy: 90, fullRetirementAge: 67,
  annualIncome: 165000, monthlyContribution: 2200, targetMonthlyIncome: 8000,
  expectedReturn: 0.07, inflation: 0.03, volatility: 0.16,
  ss62: 1850, ssFRA: 2640, ss70: 3275, taxBracket: 24,
};
/* ============================================================
   ATOMIC UI COMPONENTS
   ============================================================ */
const Card = ({ children, className = '', style = {}, ...props }) => (
  <div className={`rounded-xl border ${className}`}
    style={{ background: C.surface, borderColor: C.border, ...style }} {...props}>
    {children}
  </div>
);

const SectionLabel = ({ children, accent }) => (
  <div className="flex items-baseline gap-3 mb-4">
    <div className="font-serif italic text-sm" style={{ color: C.gold }}>—</div>
    <div className="text-xs uppercase tracking-[0.18em] font-medium" style={{ color: C.textDim }}>{children}</div>
    {accent && <div className="text-xs font-mono" style={{ color: C.textFaint }}>{accent}</div>}
  </div>
);

const PillBadge = ({ children, tone = 'neutral', icon, size = 'md' }) => {
  const tones = {
    pos:     { bg: 'rgba(95,168,114,0.12)', color: C.pos,     border: 'rgba(95,168,114,0.25)' },
    neg:     { bg: 'rgba(201,112,73,0.12)', color: C.neg,     border: 'rgba(201,112,73,0.25)' },
    gold:    { bg: 'rgba(212,169,69,0.12)', color: C.gold,    border: 'rgba(212,169,69,0.28)' },
    info:    { bg: 'rgba(111,143,184,0.12)', color: C.info,   border: 'rgba(111,143,184,0.28)' },
    neutral: { bg: 'rgba(138,145,163,0.10)', color: C.textDim, border: 'rgba(138,145,163,0.20)' },
  };
  const t = tones[tone];
  const padding = size === 'sm' ? 'px-1.5 py-0' : 'px-2 py-0.5';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${padding} rounded ${text} font-medium font-mono tnum`}
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
      {icon}{children}
    </span>
  );
};

const ChangeIndicator = ({ value, percent, size = 'md', mono = true }) => {
  const positive = value >= 0;
  const sizes = { sm: 'text-xs gap-1', md: 'text-sm gap-1.5', lg: 'text-base gap-2' };
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center ${sizes[size]} ${mono ? 'font-mono' : ''} tnum font-medium`}
      style={{ color: positive ? C.pos : C.neg }}>
      <Icon size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} strokeWidth={2.2} />
      {percent != null ? fmt.pct(percent) : fmt.dollar(value)}
    </span>
  );
};

const Sparkline = ({ data, positive, height = 32, width = 80 }) => {
  if (!data || data.length === 0) return null;
  const color = positive ? C.pos : C.neg;
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((d, i) => `${i * stepX},${height - ((d.value - min) / range) * height * 0.85 - height * 0.075}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const id = `spark-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

const StatusIndicator = ({ status, errorMsg, lastUpdated }) => {
  const config = {
    cached:  { color: C.textDim, label: 'Cached Data',     dot: false, pulse: false },
    loading: { color: C.info,    label: 'Updating…',       dot: true,  pulse: true },
    live:    { color: C.pos,     label: 'Live',            dot: true,  pulse: true },
    error:   { color: C.neg,     label: 'Connection Error', dot: true,  pulse: false },
  };
  const c = config[status] || config.cached;
  return (
    <div className="flex items-center gap-2">
      {c.dot && <div className={`w-1.5 h-1.5 rounded-full ${c.pulse ? 'pulse-dot' : ''}`} style={{ background: c.color }} />}
      <span className="text-xs uppercase tracking-wider" style={{ color: c.color }}>{c.label}</span>
      {lastUpdated && status === 'live' && (
        <span className="text-[11px]" style={{ color: C.textFaint }}>· {fmt.timeAgo(lastUpdated)}</span>
      )}
      {errorMsg && status === 'error' && (
        <span className="text-[11px]" style={{ color: C.neg }}>· {errorMsg}</span>
      )}
    </div>
  );
};

/* ============================================================
   CHARTS
   ============================================================ */
const PerformanceChart = ({ data, height = 280, showAxis = true }) => {
  const positive = data.length > 1 && data[data.length - 1].value >= data[0].value;
  const lineColor = positive ? C.pos : C.neg;
  const gid = `perfGrad-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 8, left: 8 }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {showAxis && (
          <YAxis domain={['dataMin - 100', 'dataMax + 100']} axisLine={false} tickLine={false}
            tick={{ fill: C.textFaint, fontSize: 11, fontFamily: 'JetBrains Mono' }}
            tickFormatter={(v) => fmt.big$(v)} width={60} orientation="right" />
        )}
        <Tooltip cursor={{ stroke: C.borderL, strokeWidth: 1, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            return (
              <div className="tooltip-card">
                <div style={{ color: C.textDim, fontSize: 10, marginBottom: 2 }}>VALUE</div>
                <div style={{ color: lineColor, fontSize: 14, fontWeight: 600 }}>{fmt.dollar(payload[0].value, 2)}</div>
              </div>
            );
          }} />
        <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={1.8}
          fill={`url(#${gid})`} dot={false}
          activeDot={{ r: 4, fill: lineColor, stroke: C.ink, strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const AllocationDonut = ({ data, total }) => {
  const [activeIdx, setActiveIdx] = useState(null);
  const active = activeIdx != null ? data[activeIdx] : null;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={68} outerRadius={100} paddingAngle={2}
            stroke={C.ink} strokeWidth={2}
            onMouseEnter={(_, i) => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}>
            {data.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {active ? (
          <>
            <div className="text-xs uppercase tracking-wider" style={{ color: C.textDim }}>{active.name}</div>
            <div className="font-serif text-3xl mt-1" style={{ color: C.text }}>{((active.value / total) * 100).toFixed(1)}%</div>
            <div className="font-mono text-xs mt-0.5" style={{ color: C.textFaint }}>{fmt.big$(active.value)}</div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.textFaint }}>Total Equity</div>
            <div className="font-serif text-3xl mt-1" style={{ color: C.text }}>{fmt.big$(total)}</div>
            <div className="font-mono text-xs mt-0.5" style={{ color: C.textFaint }}>{data.length} segments</div>
          </>
        )}
      </div>
    </div>
  );
};

const SectorBars = ({ data, total }) => {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.value / total) * 100;
        const barW = (d.value / max) * 100;
        return (
          <div key={d.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                <span className="text-sm" style={{ color: C.text }}>{d.name}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs tnum" style={{ color: C.textDim }}>{fmt.big$(d.value)}</span>
                <span className="font-mono text-sm tnum w-14 text-right" style={{ color: C.text }}>{pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${barW}%`,
                  background: `linear-gradient(90deg, ${SECTOR_COLORS[i % SECTOR_COLORS.length]}, ${SECTOR_COLORS[i % SECTOR_COLORS.length]}aa)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ============================================================
   SIDEBAR & TOPBAR
   ============================================================ */
const Sidebar = ({ active, setActive, apiStatus, lastUpdated, errorMsg }) => {
  const groups = [
    {
      label: 'Portfolio',
      items: [
        { key: 'dashboard',       label: 'Dashboard',       icon: Home },
        { key: 'holdings',        label: 'Holdings',        icon: Briefcase },
        { key: 'watchlist',       label: 'Watchlist',       icon: Eye },
        { key: 'search',          label: 'Stock Search',    icon: Search },
        { key: 'analytics',       label: 'Analytics',       icon: BarChart3 },
        { key: 'activity',        label: 'Activity',        icon: Activity },
      ],
    },
    {
      label: 'AI Intelligence',
      items: [
        { key: 'aibrain',    label: 'AI Brain',           icon: Brain,         badge: 'AI' },
        { key: 'macro',      label: 'Macro Radar',        icon: Globe },
        { key: 'sentiment',  label: 'Sentiment',          icon: Newspaper },
        { key: 'alerts',     label: 'Alert Center',       icon: AlertTriangle, badge: 'LIVE' },
        { key: 'optimizer',  label: 'Portfolio Optimizer',icon: Target },
      ],
    },
    {
      label: 'Trading',
      items: [
        { key: 'tips',            label: 'Trading Tips',    icon: Crosshair },
        { key: 'predict',         label: 'ML Forecast',     icon: BarChart2 },
        { key: 'recommendations', label: 'Recommendations', icon: Lightbulb },
        { key: 'retirement',      label: 'Retirement',      icon: PiggyBank },
        { key: 'news',            label: 'News',            icon: Newspaper },
      ],
    },
  ];

  return (
    <aside className="w-full flex-1 flex flex-col border-r overflow-hidden" style={{ background: C.ink, borderColor: C.border }}>
      <div className="px-6 py-6 border-b" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-serif text-lg"
            style={{ background: C.gold, color: C.ink }}>ƒ</div>
          <div>
            <div className="font-serif text-xl leading-none" style={{ color: C.text }}>FinSight</div>
            <div className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: C.textFaint }}>Intelligence</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {groups.map(group => (
          <div key={group.label} className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] px-3 mb-1.5" style={{ color: C.textFaint }}>{group.label}</div>
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = active === item.key;
                const badgeColor = item.badge === 'AI' ? '#a78bfa' : item.badge === 'LIVE' ? C.pos : C.gold;
                return (
                  <li key={item.key}>
                    <button onClick={() => setActive(item.key)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm relative no-tap"
                      style={{ color: isActive ? C.text : C.textDim, background: isActive ? C.surface : 'transparent' }}>
                      {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r" style={{ background: C.gold }} />}
                      <Icon size={15} strokeWidth={1.8} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && !isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wider"
                          style={{ background: badgeColor + '25', color: badgeColor }}>{item.badge}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="text-[10px] uppercase tracking-[0.2em] px-3 mb-2 mt-2" style={{ color: C.textFaint }}>Configuration</div>
        <ul className="space-y-0.5">
          <li>
            <button onClick={() => setActive('settings')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm relative no-tap"
              style={{ color: active === 'settings' ? C.text : C.textDim, background: active === 'settings' ? C.surface : 'transparent' }}>
              {active === 'settings' && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r" style={{ background: C.gold }} />}
              <Settings size={15} strokeWidth={1.8} />
              <span>Settings</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="p-4 mx-3 mb-3 rounded-lg border" style={{ background: C.surface, borderColor: C.border }}>
        <div className="mb-2"><StatusIndicator status={apiStatus} errorMsg={errorMsg} lastUpdated={lastUpdated} /></div>
        <div className="font-mono text-[10px]" style={{ color: C.textFaint }}>
          {apiStatus === 'live' ? 'Finnhub · 60 calls/min' :
           apiStatus === 'cached' ? `Imported ${PORTFOLIO_DATE}` :
           apiStatus === 'loading' ? 'Fetching quotes…' : 'Check API key'}
        </div>
      </div>
    </aside>
  );
};

const TopBar = ({ portfolioValue, dayChange, dayChangePct, onAdd, onRefresh, apiStatus, hasApiKey, onSettings, onToggleSidebar }) => (
  <header className="h-16 px-8 flex items-center justify-between border-b shrink-0"
    style={{ background: C.ink, borderColor: C.border }}>
    <div className="flex items-center gap-4">
      <button onClick={onToggleSidebar} className="md:hidden p-2 rounded-lg no-tap"
        style={{ color: C.textDim }}>
        <Menu size={20} />
      </button>
      <button className="flex items-center gap-3 w-80 px-4 py-2 rounded-lg text-sm border transition-all no-tap"
        style={{ background: C.surface, borderColor: C.border, color: C.textFaint }}>
        <Search size={15} strokeWidth={1.8} />
        <span>Search ticker, company, or sector…</span>
        <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded border"
          style={{ borderColor: C.border, color: C.textFaint }}>⌘ K</span>
      </button>

      {!hasApiKey && (
        <button onClick={onSettings} className="px-3 py-2 rounded-lg flex items-center gap-2 text-xs no-tap"
          style={{ background: 'rgba(212,169,69,0.10)', color: C.gold, border: '1px solid rgba(212,169,69,0.25)' }}>
          <Key size={13} /> Add API key for live data
        </button>
      )}
    </div>

    <div className="flex items-center gap-4">
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.textFaint }}>Portfolio</div>
        <div className="flex items-baseline gap-3 mt-0.5">
          <span className="serif-num text-2xl" style={{ color: C.text }}>{fmt.dollar(portfolioValue, 2)}</span>
          <ChangeIndicator value={dayChange} percent={dayChangePct} size="sm" />
        </div>
      </div>

      <div className="h-8 w-px" style={{ background: C.border }} />

      <button onClick={onRefresh} disabled={apiStatus === 'loading'}
        className="btn-ghost p-2 rounded-lg no-tap" title="Refresh prices">
        <RefreshCw size={15} className={apiStatus === 'loading' ? 'spin' : ''} />
      </button>

      <button onClick={onAdd} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2 text-sm no-tap">
        <Plus size={15} strokeWidth={2.2} /> Add Transaction
      </button>

      <div className="w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm border"
        style={{ background: C.surface, borderColor: C.border, color: C.gold }}>SD</div>
    </div>
  </header>
);
/* ============================================================
   DASHBOARD VIEW
   ============================================================ */
const HeroStats = ({ portfolio, cash }) => {
  const stats = [
    { label: 'Total Portfolio', value: fmt.dollar(portfolio.value, 2), sub: `${portfolio.positions.length} positions + cash`, tone: 'gold' },
    { label: "Today's Change",  value: fmt.dollar(portfolio.dayChange, 2), sub: fmt.pct(portfolio.dayChangePct), tone: portfolio.dayChange >= 0 ? 'pos' : 'neg' },
    { label: 'Total Return',    value: fmt.dollar(portfolio.totalReturn, 2), sub: fmt.pct(portfolio.totalReturnPct), tone: portfolio.totalReturn >= 0 ? 'pos' : 'neg' },
    { label: 'Cash Position',   value: fmt.dollar(cash.value, 2), sub: `${cash.label} · ${cash.apy}% APY`, tone: 'neutral' },
  ];
  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <Card key={i} className="p-5 fade-in" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: C.textFaint }}>{s.label}</div>
          <div className="serif-num text-3xl leading-none" style={{
            color: s.tone === 'gold' ? C.gold : s.tone === 'pos' ? C.pos : s.tone === 'neg' ? C.neg : C.text }}>
            {s.value}
          </div>
          <div className="mt-2 text-xs font-mono tnum" style={{ color: C.textDim }}>{s.sub}</div>
        </Card>
      ))}
    </div>
  );
};

const PerformanceSection = ({ portfolio }) => {
  const [range, setRange] = useState('1M');
  const rangeConfig = RANGES.find(r => r.key === range);
  const chartData = useMemo(() =>
    genHistory('PORTFOLIO_' + range, portfolio.value, rangeConfig.points, rangeConfig.vol, rangeConfig.drift),
    [range, portfolio.value]);

  const startVal = chartData[0]?.value || 0;
  const endVal = chartData[chartData.length - 1]?.value || 0;
  const change = endVal - startVal;
  const changePct = (change / startVal) * 100;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <SectionLabel>Performance</SectionLabel>
          <div className="flex items-baseline gap-4">
            <span className="serif-num text-4xl" style={{ color: C.text }}>{fmt.dollar(endVal, 2)}</span>
            <ChangeIndicator value={change} percent={changePct} size="lg" />
          </div>
          <div className="mt-1 text-xs font-mono" style={{ color: C.textFaint }}>
            {range} period · vs S&amp;P 500: <span style={{ color: changePct > 5 ? C.pos : C.textDim }}>+{(changePct - 4.2).toFixed(2)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg border" style={{ borderColor: C.border, background: C.surface2 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className="px-3 py-1 rounded text-xs font-medium font-mono transition-all no-tap"
              style={{ background: range === r.key ? C.gold : 'transparent', color: range === r.key ? C.ink : C.textDim }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2"><PerformanceChart data={chartData} /></div>
    </Card>
  );
};

const TopMovers = ({ positions }) => {
  const winners = [...positions].sort((a, b) => b.dayChangePct - a.dayChangePct).slice(0, 3);
  const losers = [...positions].sort((a, b) => a.dayChangePct - b.dayChangePct).slice(0, 3);

  const Mover = ({ stock, idx }) => (
    <div className="flex items-center justify-between py-2.5 fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold border"
          style={{ background: C.surface2, borderColor: C.border, color: C.text }}>
          {stock.symbol.slice(0, 4)}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: C.text }}>{stock.symbol}</div>
          <div className="text-[11px]" style={{ color: C.textDim }}>{stock.sector}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm tnum" style={{ color: C.text }}>{fmt.dollar(stock.price, 2)}</div>
        <ChangeIndicator value={stock.dayChange} percent={stock.dayChangePct} size="sm" />
      </div>
    </div>
  );

  return (
    <Card className="p-6">
      <SectionLabel accent="Today">Top Movers</SectionLabel>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={13} style={{ color: C.pos }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: C.pos }}>Winners</span>
          </div>
          {winners.map((s, i) => <Mover key={s.symbol} stock={s} idx={i} />)}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={13} style={{ color: C.neg }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: C.neg }}>Laggards</span>
          </div>
          {losers.map((s, i) => <Mover key={s.symbol} stock={s} idx={i} />)}
        </div>
      </div>
    </Card>
  );
};

const RecommendationsPreview = ({ recs, onViewAll }) => {
  const top = recs.slice(0, 3);
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: C.gold }} />
          <span className="text-xs uppercase tracking-[0.18em]" style={{ color: C.gold }}>Top Recommendations</span>
        </div>
        <button onClick={onViewAll} className="text-xs flex items-center gap-1 no-tap" style={{ color: C.textDim }}>
          View all {recs.length} <ChevronRight size={12} />
        </button>
      </div>
      <div className="space-y-3">
        {top.map((rec, i) => {
          const persona = PERSONAS[rec.persona];
          const Icon = persona.icon;
          const sevColor = rec.severity === 'critical' ? C.neg : rec.severity === 'warning' ? C.gold :
                           rec.severity === 'opportunity' ? C.pos : rec.severity === 'positive' ? C.pos : C.info;
          return (
            <div key={i} className="p-3 rounded-lg border-l-2 fade-in cursor-pointer"
              onClick={onViewAll}
              style={{ background: C.surface2, borderLeftColor: sevColor, animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', color: persona.color }}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-mono" style={{ color: persona.color }}>{persona.short}</span>
                    <span className="text-[10px]" style={{ color: C.textFaint }}>·</span>
                    <span className="text-[10px] uppercase font-medium" style={{ color: sevColor }}>{rec.severity}</span>
                  </div>
                  <div className="font-medium text-sm leading-tight" style={{ color: C.text }}>{rec.title}</div>
                </div>
                <ArrowUpRight size={14} style={{ color: C.textFaint }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const AllocationSection = ({ portfolio, cash }) => {
  const sectorData = useMemo(() => computeSectorAllocation(portfolio.positions, cash), [portfolio.positions, cash]);
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="p-6">
        <SectionLabel>Asset Allocation</SectionLabel>
        <AllocationDonut data={sectorData.data} total={sectorData.total} />
      </Card>
      <Card className="p-6">
        <SectionLabel accent="By Value">Sector Breakdown</SectionLabel>
        <SectorBars data={sectorData.data} total={sectorData.total} />
      </Card>
    </div>
  );
};

const DashboardView = ({ portfolio, cash, recs, onViewRecs }) => (
  <div className="space-y-4">
    <div>
      <div className="font-serif text-3xl mb-1" style={{ color: C.text }}>
        Welcome back, <span className="italic" style={{ color: C.gold }}>Suhas</span>
      </div>
      <div className="text-sm" style={{ color: C.textDim }}>
        Portfolio is <span style={{ color: portfolio.dayChange >= 0 ? C.pos : C.neg }}>
          {portfolio.dayChange >= 0 ? 'up' : 'down'} {fmt.pct(portfolio.dayChangePct)}
        </span> today · Total return <span style={{ color: portfolio.totalReturn >= 0 ? C.pos : C.neg }}>
          {fmt.pct(portfolio.totalReturnPct)}
        </span> all-time · {recs.length} recommendation{recs.length !== 1 ? 's' : ''} await
      </div>
    </div>
    <HeroStats portfolio={portfolio} cash={cash} />
    <PerformanceSection portfolio={portfolio} />
    <div className="grid grid-cols-2 gap-4">
      <TopMovers positions={portfolio.positions} />
      <RecommendationsPreview recs={recs} onViewAll={onViewRecs} />
    </div>
    <AllocationSection portfolio={portfolio} cash={cash} />
  </div>
);

/* ============================================================
   HOLDINGS VIEW
   ============================================================ */
const HoldingsView = ({ portfolio, cash, onSelectStock, flashes }) => {
  const [sortBy, setSortBy] = useState('value');
  const [sortDir, setSortDir] = useState('desc');

  const enriched = portfolio.positions.map(p => ({
    ...p, sparkData: genHistory(p.symbol + '_spark', p.price, 30, 0.018, 0.0008),
  }));
  const totalValue = portfolio.equityValue;

  const sorted = [...enriched].sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy];
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const headers = [
    { key: 'symbol', label: 'Symbol', align: 'left' },
    { key: 'shares', label: 'Shares', align: 'right' },
    { key: 'avgCost', label: 'Avg Cost', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'dayChangePct', label: "Today", align: 'right' },
    { key: 'value', label: 'Market Value', align: 'right' },
    { key: 'totalReturnPct', label: 'Total Return', align: 'right' },
    { key: 'allocation', label: '% Portfolio', align: 'right' },
  ];

  const setSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-serif text-3xl" style={{ color: C.text }}>Holdings</div>
          <div className="text-sm mt-1" style={{ color: C.textDim }}>
            {portfolio.positions.length} equity positions · {fmt.dollar(totalValue, 2)} market value
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {headers.map(h => (
                  <th key={h.key}
                    className={`px-4 py-3 text-[10px] uppercase tracking-[0.15em] font-medium cursor-pointer no-tap ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                    style={{ color: sortBy === h.key ? C.gold : C.textFaint }}
                    onClick={() => setSort(h.key)}>
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      {sortBy === h.key && <ChevronDown size={11} style={{ transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none' }} />}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] font-medium text-right" style={{ color: C.textFaint }}>30D</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h, i) => {
                const isFlash = flashes[h.symbol];
                const allocation = (h.value / totalValue) * 100;
                return (
                  <tr key={h.symbol} onClick={() => onSelectStock(h.symbol)}
                    className={`cursor-pointer transition-colors no-tap fade-in ${isFlash === 'up' ? 'flash-up' : isFlash === 'down' ? 'flash-down' : ''}`}
                    style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : 'none', animationDelay: `${i * 25}ms` }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.surface2}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold border shrink-0"
                          style={{ background: C.surface2, borderColor: C.border, color: C.text }}>
                          {h.symbol.slice(0, 4)}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: C.text }}>{h.symbol}</div>
                          <div className="text-[11px]" style={{ color: C.textDim }}>{h.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm tnum" style={{ color: C.text }}>{fmt.shares(h.shares)}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm tnum" style={{ color: C.textDim }}>{fmt.dollar(h.avgCost, 2)}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm tnum" style={{ color: C.text }}>{fmt.dollar(h.price, 2)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex flex-col items-end">
                        <ChangeIndicator value={h.dayChange} percent={h.dayChangePct} size="sm" />
                        <span className="text-[10px] font-mono tnum" style={{ color: C.textFaint }}>{fmt.dollar(h.dayChangeAbs, 0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm tnum font-medium" style={{ color: C.text }}>{fmt.dollar(h.value, 0)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex flex-col items-end">
                        <span className="font-mono text-sm tnum font-medium" style={{ color: h.totalReturn >= 0 ? C.pos : C.neg }}>
                          {fmt.pct(h.totalReturnPct)}
                        </span>
                        <span className="text-[10px] font-mono tnum" style={{ color: C.textFaint }}>
                          {h.totalReturn >= 0 ? '+' : ''}{fmt.dollar(h.totalReturn, 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
                          <div className="h-full rounded-full" style={{ width: `${allocation}%`, background: C.gold }} />
                        </div>
                        <span className="font-mono text-xs tnum w-10 text-right" style={{ color: C.text }}>{allocation.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <Sparkline data={h.sparkData} positive={h.totalReturn >= 0} width={70} height={28} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold"
              style={{ background: 'rgba(212,169,69,0.10)', border: '1px solid rgba(212,169,69,0.25)', color: C.gold }}>
              SPAXX
            </div>
            <div>
              <div className="font-medium" style={{ color: C.text }}>{cash.label}</div>
              <div className="text-xs" style={{ color: C.textDim }}>Fidelity Government Money Market Fund · {cash.apy}% APY</div>
            </div>
          </div>
          <div className="font-mono text-sm tnum font-medium" style={{ color: C.text }}>{fmt.dollar(cash.value, 2)}</div>
        </div>
      </Card>
    </div>
  );
};

/* ============================================================
   WATCHLIST VIEW
   ============================================================ */
const WatchlistView = ({ watchlist, prices, onSelectStock, onAddToPortfolio, onRemove, flashes }) => {
  const enriched = watchlist.map(symbol => {
    const p = prices[symbol];
    const meta = STOCK_META[symbol];
    if (!p || !meta) return null;
    return { symbol, ...meta, ...p, sparkData: genHistory(symbol + '_w', p.price, 30, 0.020, 0.0007) };
  }).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <div className="font-serif text-3xl" style={{ color: C.text }}>Watchlist</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>
          {watchlist.length} stocks tracked · Click to view details or add to portfolio
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {enriched.map((s, i) => {
          const positive = s.price >= s.prevClose;
          const flash = flashes[s.symbol];
          return (
            <div key={s.symbol} onClick={() => onSelectStock(s.symbol)}
              className={`rounded-xl border p-5 cursor-pointer transition-all no-tap fade-in ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}
              style={{ background: C.surface, borderColor: C.border, animationDelay: `${i * 40}ms` }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = C.borderL}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center font-mono text-xs font-semibold border"
                    style={{ background: C.surface2, borderColor: C.border, color: C.text }}>
                    {s.symbol.slice(0, 4)}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: C.text }}>{s.symbol}</div>
                    <div className="text-xs" style={{ color: C.textDim }}>{s.sector}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); onAddToPortfolio(s.symbol); }}
                    className="p-1.5 rounded transition-colors" style={{ color: C.gold }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212,169,69,0.10)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <Plus size={15} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRemove(s.symbol); }}
                    className="p-1.5 rounded transition-colors" style={{ color: C.textFaint }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,112,73,0.10)'; e.currentTarget.style.color = C.neg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textFaint; }}>
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div className="text-xs mb-3" style={{ color: C.textDim }}>{s.name}</div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="serif-num text-2xl" style={{ color: C.text }}>{fmt.dollar(s.price, 2)}</div>
                  <ChangeIndicator value={s.price - s.prevClose} percent={s.dayChangePct} size="sm" />
                </div>
                <Sparkline data={s.sparkData} positive={positive} width={100} height={36} />
              </div>
              <div className="mt-4 pt-3 grid grid-cols-3 gap-2 border-t" style={{ borderColor: C.border }}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Industry</div>
                  <div className="text-xs mt-0.5" style={{ color: C.text }}>{s.industry}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Beta</div>
                  <div className="font-mono text-xs tnum mt-0.5" style={{ color: C.text }}>{(STOCK_BETAS[s.symbol] || 1).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Day</div>
                  <div className="font-mono text-[10px] tnum mt-0.5" style={{ color: positive ? C.pos : C.neg }}>
                    {fmt.pct(s.dayChangePct, 1)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
/* ============================================================
   RECOMMENDATIONS VIEW
   ============================================================ */
const RecommendationsView = ({ recs }) => {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? recs : recs.filter(r => r.persona === filter);

  const counts = useMemo(() => {
    const c = { all: recs.length };
    Object.keys(PERSONAS).forEach(k => { c[k] = recs.filter(r => r.persona === k).length; });
    return c;
  }, [recs]);

  const SeverityBadge = ({ severity }) => {
    const config = {
      critical:    { tone: 'neg',  label: 'Critical',    icon: AlertCircle },
      warning:     { tone: 'gold', label: 'Warning',     icon: AlertTriangle },
      opportunity: { tone: 'pos',  label: 'Opportunity', icon: Sparkles },
      info:        { tone: 'info', label: 'Info',        icon: Info },
      positive:    { tone: 'pos',  label: 'On Track',    icon: CheckCircle2 },
    };
    const c = config[severity] || config.info;
    const Icon = c.icon;
    return <PillBadge tone={c.tone} icon={<Icon size={11} />}>{c.label}</PillBadge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="font-serif text-3xl" style={{ color: C.text }}>Recommendations</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>
          {recs.length} actionable insights from {Object.keys(PERSONAS).length} expert advisors analyzing your portfolio
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilter('all')}
          className="px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap no-tap flex items-center gap-2"
          style={{
            background: filter === 'all' ? C.gold : C.surface,
            color: filter === 'all' ? C.ink : C.textDim,
            border: `1px solid ${filter === 'all' ? C.gold : C.border}`,
          }}>
          All <span className="font-mono">({counts.all})</span>
        </button>
        {Object.values(PERSONAS).map(p => {
          const Icon = p.icon;
          return (
            <button key={p.id} onClick={() => setFilter(p.id)}
              className="px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap no-tap flex items-center gap-2"
              style={{
                background: filter === p.id ? p.color : C.surface,
                color: filter === p.id ? C.ink : C.textDim,
                border: `1px solid ${filter === p.id ? p.color : C.border}`,
              }}>
              <Icon size={13} /> {p.short} <span className="font-mono">({counts[p.id]})</span>
            </button>
          );
        })}
      </div>

      {filter === 'all' && (
        <div className="grid grid-cols-5 gap-3">
          {Object.values(PERSONAS).map((p, i) => {
            const Icon = p.icon;
            const personaRecs = recs.filter(r => r.persona === p.id);
            const critical = personaRecs.filter(r => r.severity === 'critical').length;
            return (
              <Card key={p.id} className="p-4 cursor-pointer fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setFilter(p.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', color: p.color }}>
                    <Icon size={16} />
                  </div>
                  {critical > 0 && (
                    <div className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'rgba(201,112,73,0.15)', color: C.neg, border: '1px solid rgba(201,112,73,0.3)' }}>
                      {critical}
                    </div>
                  )}
                </div>
                <div className="font-medium text-sm leading-tight" style={{ color: C.text }}>{p.short}</div>
                <div className="text-[11px] mt-1" style={{ color: C.textDim }}>{p.desc}</div>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
                  <span className="font-mono text-2xl" style={{ color: p.color }}>{personaRecs.length}</span>
                  <span className="text-[11px] ml-1" style={{ color: C.textFaint }}>
                    insight{personaRecs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: C.pos }} />
          <div className="font-serif text-xl" style={{ color: C.text }}>No recommendations in this category</div>
          <div className="text-sm mt-1" style={{ color: C.textDim }}>Your portfolio is well-positioned in this dimension.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, i) => {
            const persona = PERSONAS[rec.persona];
            const Icon = persona.icon;
            const sevColor = rec.severity === 'critical' ? C.neg : rec.severity === 'warning' ? C.gold :
                             rec.severity === 'opportunity' || rec.severity === 'positive' ? C.pos : C.info;
            return (
              <Card key={i} className="p-5 fade-in"
                style={{ animationDelay: `${i * 30}ms`, borderLeft: `3px solid ${sevColor}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.04)', color: persona.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider font-mono font-medium" style={{ color: persona.color }}>
                        {persona.name}
                      </span>
                      <SeverityBadge severity={rec.severity} />
                      <span className="text-[10px] font-mono ml-auto" style={{ color: C.textFaint }}>
                        Priority {rec.score}/10
                      </span>
                    </div>
                    <div className="font-serif text-xl mb-2" style={{ color: C.text }}>{rec.title}</div>
                    <div className="text-sm leading-relaxed mb-3" style={{ color: C.textDim }}>
                      {rec.description}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="p-3 rounded-md" style={{ background: C.surface2 }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.textFaint }}>Recommended Action</div>
                        <div className="text-xs leading-relaxed" style={{ color: C.text }}>{rec.action}</div>
                      </div>
                      <div className="p-3 rounded-md" style={{ background: C.surface2 }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.textFaint }}>Expected Impact</div>
                        <div className="text-xs leading-relaxed" style={{ color: C.text }}>{rec.impact}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4" style={{ background: C.surface2 }}>
        <div className="flex items-start gap-3">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: C.textFaint }} />
          <div className="text-[11px] leading-relaxed" style={{ color: C.textDim }}>
            These recommendations are generated algorithmically based on portfolio analytics and conventional financial planning frameworks.
            They are educational in nature and not personalized financial advice. Consult a fiduciary advisor before implementing.
            Tax treatments depend on individual circumstances and current law. Past performance does not guarantee future results.
          </div>
        </div>
      </Card>
    </div>
  );
};
/* ============================================================
   RETIREMENT VIEW
   ============================================================ */
const RetirementView = ({ portfolioValue, profile, setProfile }) => {
  const calc = useMemo(() => calculateRetirement(profile, portfolioValue), [profile, portfolioValue]);
  const monteCarlo = useMemo(() => monteCarloSimulation(profile, portfolioValue, 300), [profile, portfolioValue]);
  const ssAnalysis = useMemo(() => calculateSocialSecurity(profile), [profile]);

  const updateField = (key, value) => setProfile(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div>
        <div className="font-serif text-3xl" style={{ color: C.text }}>Retirement Planning</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>
          Comprehensive analysis with Monte Carlo simulation, gap analysis, and Social Security optimization
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: C.textFaint }}>Years to Retirement</div>
          <div className="serif-num text-3xl" style={{ color: C.gold }}>{calc.yearsToRetirement}</div>
          <div className="text-xs font-mono mt-2" style={{ color: C.textDim }}>Age {profile.currentAge} → {profile.retirementAge}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: C.textFaint }}>Required Nest Egg</div>
          <div className="serif-num text-3xl" style={{ color: C.text }}>{fmt.big$(calc.requiredNestEgg)}</div>
          <div className="text-xs font-mono mt-2" style={{ color: C.textDim }}>4% rule · Today's $</div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: C.textFaint }}>Projected Total</div>
          <div className="serif-num text-3xl" style={{ color: calc.onTrack ? C.pos : C.neg }}>{fmt.big$(calc.projectedTotal)}</div>
          <div className="text-xs font-mono mt-2" style={{ color: C.textDim }}>at age {profile.retirementAge}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: C.textFaint }}>
            {calc.onTrack ? 'Surplus' : 'Gap'}
          </div>
          <div className="serif-num text-3xl" style={{ color: calc.onTrack ? C.pos : C.neg }}>
            {fmt.big$(Math.abs(calc.gap))}
          </div>
          <div className="text-xs font-mono mt-2" style={{ color: C.textDim }}>
            {calc.onTrack ? 'Ahead of plan' : `Save ${fmt.dollar(calc.requiredMonthly, 0)}/mo`}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <SectionLabel>Your Profile</SectionLabel>
        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
          {[
            { key: 'currentAge', label: 'Current Age', min: 20, max: 75, step: 1, format: v => v },
            { key: 'retirementAge', label: 'Retirement Age', min: profile.currentAge + 1, max: 80, step: 1, format: v => v },
            { key: 'lifeExpectancy', label: 'Life Expectancy', min: profile.retirementAge + 5, max: 100, step: 1, format: v => v },
            { key: 'monthlyContribution', label: 'Monthly Contribution', min: 0, max: 10000, step: 100, format: v => fmt.dollar(v, 0) },
            { key: 'targetMonthlyIncome', label: 'Target Monthly Income', min: 2000, max: 25000, step: 500, format: v => fmt.dollar(v, 0) },
            { key: 'expectedReturn', label: 'Expected Return', min: 0.03, max: 0.12, step: 0.005, format: v => (v * 100).toFixed(1) + '%' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-[10px] uppercase tracking-[0.15em] block mb-1.5" style={{ color: C.textFaint }}>
                {field.label}
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={field.min} max={field.max} step={field.step} value={profile[field.key]}
                  onChange={(e) => updateField(field.key, parseFloat(e.target.value))} className="flex-1" />
                <span className="font-mono text-sm tnum w-20 text-right" style={{ color: C.text }}>
                  {field.format(profile[field.key])}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <SectionLabel accent={`${monteCarlo.successProbability.toFixed(0)}% success probability`}>
            Monte Carlo Simulation
          </SectionLabel>
          <PillBadge tone={monteCarlo.successProbability > 80 ? 'pos' : monteCarlo.successProbability > 60 ? 'gold' : 'neg'}>
            {monteCarlo.successProbability > 80 ? 'High Confidence' :
             monteCarlo.successProbability > 60 ? 'Moderate Confidence' : 'Low Confidence'}
          </PillBadge>
        </div>

        <div className="text-xs mb-4" style={{ color: C.textDim }}>
          300 simulations across {calc.yearsToRetirement} years using {(profile.expectedReturn * 100).toFixed(1)}% mean return
          and {(profile.volatility * 100).toFixed(0)}% annual volatility. Bands show 10th–90th percentile outcomes.
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={monteCarlo.percentiles} margin={{ top: 10, right: 8, bottom: 8, left: 8 }}>
            <defs>
              <linearGradient id="mcBand" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={C.gold} stopOpacity="0.25" />
                <stop offset="100%" stopColor={C.gold} stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <XAxis dataKey="age" axisLine={false} tickLine={false}
              tick={{ fill: C.textFaint, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fill: C.textFaint, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => fmt.big$(v)} width={60} orientation="right" />
            <ReferenceLine y={calc.requiredNestEgg} stroke={C.neg} strokeDasharray="4 4"
              label={{ value: 'Target', fill: C.neg, fontSize: 11, fontFamily: 'JetBrains Mono', position: 'right' }} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const d = payload[0].payload;
              return (
                <div className="tooltip-card">
                  <div style={{ color: C.textDim, fontSize: 10, marginBottom: 4 }}>AGE {d.age}</div>
                  <div style={{ color: C.gold, fontSize: 12 }}>50th pct: {fmt.dollar(d.p50, 0)}</div>
                  <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>10th: {fmt.dollar(d.p10, 0)}</div>
                  <div style={{ color: C.textDim, fontSize: 11 }}>90th: {fmt.dollar(d.p90, 0)}</div>
                </div>
              );
            }} />
            <Area type="monotone" dataKey="p90" stroke="none" fill="url(#mcBand)" />
            <Area type="monotone" dataKey="p10" stroke="none" fill={C.ink} />
            <Line type="monotone" dataKey="p50" stroke={C.gold} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p25" stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" dot={false} strokeOpacity={0.6} />
            <Line type="monotone" dataKey="p75" stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" dot={false} strokeOpacity={0.6} />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { label: '10th (Bear)',   key: 'p10', tone: 'neg' },
            { label: '25th',          key: 'p25', tone: 'gold' },
            { label: '50th (Median)', key: 'p50', tone: 'gold' },
            { label: '75th',          key: 'p75', tone: 'pos' },
            { label: '90th (Bull)',   key: 'p90', tone: 'pos' },
          ].map(p => {
            const value = monteCarlo.percentiles[monteCarlo.percentiles.length - 1][p.key];
            return (
              <div key={p.label} className="p-3 rounded-md" style={{ background: C.surface2 }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>{p.label}</div>
                <div className="font-mono text-sm tnum mt-1" style={{
                  color: p.tone === 'pos' ? C.pos : p.tone === 'neg' ? C.neg : C.gold }}>
                  {fmt.big$(value)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <SectionLabel accent={`Optimal: ${ssAnalysis.optimalStrategy}`}>Social Security Optimization</SectionLabel>

        <div className="grid grid-cols-3 gap-4">
          {ssAnalysis.strategies.map((s, i) => {
            const isOptimal = s.name === ssAnalysis.optimalStrategy;
            return (
              <div key={s.name} className="p-5 rounded-lg border"
                style={{ background: C.surface2, borderColor: isOptimal ? C.gold : C.border, borderWidth: isOptimal ? 2 : 1 }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.textFaint }}>Strategy {i + 1}</div>
                    <div className="font-medium" style={{ color: C.text }}>{s.name}</div>
                  </div>
                  {isOptimal && <PillBadge tone="gold" icon={<CheckCircle2 size={11} />}>Optimal</PillBadge>}
                </div>
                <div className="mb-4 pb-4 border-b" style={{ borderColor: C.border }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Monthly</div>
                  <div className="serif-num text-3xl" style={{ color: isOptimal ? C.gold : C.text }}>{fmt.dollar(s.monthly, 0)}</div>
                  <div className="text-xs mt-1" style={{ color: C.textDim }}>Lifetime: {fmt.big$(s.lifetime)}</div>
                </div>
                <div className="space-y-1.5 mb-3">
                  {s.pros.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: C.pos }} />
                      <span style={{ color: C.textDim }}>{p}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {s.cons.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: C.neg }} />
                      <span style={{ color: C.textFaint }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {ssAnalysis.breakeven.be62vs70 && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(212,169,69,0.06)', border: '1px solid rgba(212,169,69,0.2)' }}>
            <div className="flex items-start gap-3">
              <Info size={14} className="mt-0.5 shrink-0" style={{ color: C.gold }} />
              <div>
                <div className="font-medium text-sm mb-1" style={{ color: C.text }}>Break-even Analysis</div>
                <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>
                  Claiming at 70 vs 62 breaks even at age <span className="font-mono" style={{ color: C.gold }}>{ssAnalysis.breakeven.be62vs70}</span>.
                  If your life expectancy exceeds this age, delaying is mathematically optimal.
                  {ssAnalysis.breakeven.beFRAvs70 && (
                    <> Versus FRA, break-even occurs at age <span className="font-mono" style={{ color: C.gold }}>{ssAnalysis.breakeven.beFRAvs70}</span>.</>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <SectionLabel>Tax-Efficient Withdrawal Sequencing</SectionLabel>
        <div className="text-sm mb-4" style={{ color: C.textDim }}>
          Conventional wisdom for stretching retirement portfolio longevity through tax-aware withdrawal ordering.
        </div>

        <div className="space-y-2">
          {[
            { phase: 1, label: 'Taxable Brokerage', desc: 'Spend taxable accounts first. Pay 0-20% LTCG on appreciation; let tax-advantaged accounts compound.', color: C.info },
            { phase: 2, label: 'Tax-Deferred (401k/Trad IRA)', desc: 'Withdraw next; pay ordinary income tax. Strategic Roth conversions during low-bracket years can reduce future RMDs.', color: C.gold },
            { phase: 3, label: 'Tax-Free (Roth IRA)', desc: 'Save for last; longest tax-free compounding. Bonus: tax-free legacy for heirs (no RMDs during lifetime).', color: C.pos },
          ].map((p) => (
            <div key={p.phase} className="flex items-start gap-4 p-4 rounded-lg" style={{ background: C.surface2 }}>
              <div className="w-10 h-10 rounded-md flex items-center justify-center font-mono text-lg font-semibold shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', color: p.color }}>{p.phase}</div>
              <div className="flex-1">
                <div className="font-medium" style={{ color: C.text }}>{p.label}</div>
                <div className="text-xs leading-relaxed mt-1" style={{ color: C.textDim }}>{p.desc}</div>
              </div>
              <ArrowRight size={16} style={{ color: C.textFaint }} className="shrink-0 mt-3" />
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(95,168,114,0.06)', border: '1px solid rgba(95,168,114,0.2)' }}>
          <div className="flex items-start gap-3">
            <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: C.pos }} />
            <div>
              <div className="font-medium text-sm mb-1" style={{ color: C.text }}>4% Withdrawal Rule</div>
              <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>
                Bengen's classic rule: withdrawing 4% in year one and adjusting for inflation thereafter has historically supported
                30-year retirements with 95%+ success rate. At your target of {fmt.dollar(profile.targetMonthlyIncome, 0)}/mo
                ({fmt.dollar(profile.targetMonthlyIncome * 12, 0)}/yr), this requires {fmt.big$(calc.requiredNestEgg)}.
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
/* ============================================================
   ANALYTICS VIEW
   ============================================================ */
const AnalyticsView = ({ portfolio, cash }) => {
  const risk = useMemo(() => computeRiskMetrics(portfolio.positions, cash), [portfolio.positions, cash]);
  const sectorAlloc = useMemo(() => computeSectorAllocation(portfolio.positions, cash), [portfolio.positions, cash]);
  const industryAlloc = useMemo(() => computeIndustryAllocation(portfolio.positions), [portfolio.positions]);

  const ytdReturn = portfolio.totalReturnPct * 0.6;
  const sp500YTD = 12.4;

  const compData = useMemo(() => {
    const portChart = genHistory('PORT_COMP', portfolio.value, 252, 0.014, 0.0009);
    const sp500End = portfolio.value * 0.92;
    const sp = genHistory('SP500_COMP', sp500End, 252, 0.011, 0.0007);
    return portChart.map((p, i) => ({ i, portfolio: p.value, sp500: sp[i].value }));
  }, [portfolio.value]);

  const metrics = [
    { label: 'YTD Return', value: fmt.pct(ytdReturn), sub: `vs S&P ${fmt.pct(ytdReturn - sp500YTD)}`,
      tone: ytdReturn > sp500YTD ? 'pos' : 'neg', icon: TrendingUp },
    { label: 'Sharpe Ratio', value: risk.sharpe.toFixed(2), sub: 'Risk-adjusted return', tone: 'gold', icon: Target },
    { label: 'Volatility (Est.)', value: fmt.pct(risk.annualVol, 1), sub: 'Annualized stdev', tone: 'neutral', icon: Activity },
    { label: 'Portfolio Beta', value: risk.weightedBeta.toFixed(2), sub: risk.weightedBeta > 1 ? 'Aggressive' : 'Defensive', tone: 'gold', icon: Zap },
    { label: 'Diversification', value: risk.divScore + '/100', sub: `${risk.top3Pct.toFixed(0)}% in top 3`,
      tone: risk.divScore > 70 ? 'pos' : risk.divScore > 50 ? 'gold' : 'neg', icon: Shield },
    { label: 'Cash Buffer', value: fmt.pct(risk.cashRatio, 1), sub: '4.27% APY in SPAXX', tone: 'neutral', icon: Wallet },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="font-serif text-3xl" style={{ color: C.text }}>Analytics</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>
          Risk decomposition, performance attribution, and benchmark comparison
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-5 fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: C.textFaint }}>{m.label}</div>
                <Icon size={16} style={{
                  color: m.tone === 'pos' ? C.pos : m.tone === 'neg' ? C.neg : m.tone === 'gold' ? C.gold : C.textDim }} />
              </div>
              <div className="serif-num text-3xl" style={{
                color: m.tone === 'pos' ? C.pos : m.tone === 'neg' ? C.neg : m.tone === 'gold' ? C.gold : C.text }}>
                {m.value}
              </div>
              <div className="text-xs mt-2 font-mono tnum" style={{ color: C.textDim }}>{m.sub}</div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <SectionLabel>Benchmark Comparison · 1Y</SectionLabel>
            <div className="flex items-center gap-6 mt-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: C.gold }} />
                <span className="text-sm" style={{ color: C.text }}>Portfolio</span>
                <span className="font-mono text-sm tnum" style={{ color: C.pos }}>+{ytdReturn.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: C.textDim }} />
                <span className="text-sm" style={{ color: C.text }}>S&amp;P 500</span>
                <span className="font-mono text-sm tnum" style={{ color: C.textDim }}>+{sp500YTD}%</span>
              </div>
            </div>
          </div>
          <PillBadge tone={ytdReturn > sp500YTD ? 'pos' : 'neg'}
            icon={ytdReturn > sp500YTD ? <TrendingUp size={11} /> : <TrendingDown size={11} />}>
            {ytdReturn > sp500YTD ? 'Outperforming' : 'Underperforming'} {fmt.pct(ytdReturn - sp500YTD, 1)}
          </PillBadge>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={compData} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
            <YAxis domain={['dataMin - 100', 'dataMax + 100']} axisLine={false} tickLine={false}
              tick={{ fill: C.textFaint, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => fmt.big$(v)} width={60} orientation="right" />
            <Tooltip cursor={{ stroke: C.borderL, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="tooltip-card">
                    <div style={{ color: C.gold, fontSize: 12 }}>Portfolio: {fmt.dollar(payload[0]?.value, 2)}</div>
                    <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>S&amp;P: {fmt.dollar(payload[1]?.value, 2)}</div>
                  </div>
                );
              }} />
            <Line type="monotone" dataKey="portfolio" stroke={C.gold} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sp500" stroke={C.textDim} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <SectionLabel>Sector Allocation</SectionLabel>
          <SectorBars data={sectorAlloc.data} total={sectorAlloc.total} />
        </Card>
        <Card className="p-6">
          <SectionLabel accent="Top 6">Industry Concentration</SectionLabel>
          <SectorBars data={industryAlloc.slice(0, 6)} total={portfolio.equityValue} />
        </Card>
      </div>

      <Card className="p-6">
        <SectionLabel>Position Contributors · Lifetime</SectionLabel>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {[...portfolio.positions].sort((a, b) => b.totalReturn - a.totalReturn).map((h, i) => {
            const totalReturnSum = portfolio.positions.reduce((s, p) => s + Math.abs(p.totalReturn), 0);
            const pct = (Math.abs(h.totalReturn) / totalReturnSum) * 100;
            return (
              <div key={h.symbol} className="flex items-center gap-3">
                <div className="font-mono text-xs" style={{ color: C.textFaint, width: 16 }}>{i + 1}</div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold border"
                  style={{ background: C.surface2, borderColor: C.border, color: C.text }}>
                  {h.symbol.slice(0, 4)}
                </div>
                <div className="flex-1">
                  <div className="text-sm" style={{ color: C.text }}>{h.symbol}</div>
                  <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: C.surface2 }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`,
                      background: h.totalReturn >= 0 ? C.pos : C.neg }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm tnum" style={{ color: h.totalReturn >= 0 ? C.pos : C.neg }}>
                    {h.totalReturn >= 0 ? '+' : ''}{fmt.dollar(h.totalReturn, 0)}
                  </div>
                  <div className="font-mono text-[10px] tnum" style={{ color: C.textFaint }}>
                    {fmt.pct(h.totalReturnPct, 1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

/* ============================================================
   NEWS VIEW
   ============================================================ */
const MOCK_NEWS = [
  { id: 1,  ticker: 'NVDA',  headline: 'NVIDIA unveils Blackwell Ultra B300 chips, raising AI training ambitions for 2027 deployments', time: '2h',  source: 'Reuters',     sentiment: 'pos' },
  { id: 2,  ticker: 'AAPL',  headline: 'Apple AI services revenue accelerates in fiscal Q3, beats Street expectations', time: '4h',  source: 'Bloomberg',   sentiment: 'pos' },
  { id: 3,  ticker: 'TSLA',  headline: 'Tesla Q1 deliveries soft amid intensified China EV competition; Musk defends pricing strategy', time: '6h',  source: 'WSJ',         sentiment: 'neg' },
  { id: 4,  ticker: 'INTC',  headline: 'Intel Foundry secures third major client; production ramp in Ohio on schedule', time: '8h',  source: 'Reuters',     sentiment: 'pos' },
  { id: 5,  ticker: 'COIN',  headline: 'Coinbase faces fresh SEC inquiry over staking program disclosures', time: '10h', source: 'Bloomberg',   sentiment: 'neg' },
  { id: 6,  ticker: 'ORCL',  headline: 'Oracle Cloud Infrastructure revenue grows 49% YoY, propelled by enterprise AI deployments', time: '12h', source: 'CNBC',        sentiment: 'pos' },
  { id: 7,  ticker: 'AMZN',  headline: 'AWS launches sovereign cloud regions targeting EU regulatory compliance markets', time: '14h', source: 'TechCrunch',  sentiment: 'pos' },
  { id: 8,  ticker: 'GOOG',  headline: 'Alphabet plans Waymo spinoff into independent entity, sources confirm', time: '1d',  source: 'Reuters',     sentiment: 'neutral' },
  { id: 9,  ticker: 'AVGO',  headline: 'Broadcom\'s VMware integration ahead of plan; cross-sell momentum building', time: '1d',  source: 'FT',          sentiment: 'pos' },
  { id: 10, ticker: 'AMD',   headline: 'AMD MI400 series accelerators secure design wins at three hyperscalers', time: '2d',  source: 'Reuters',     sentiment: 'pos' },
  { id: 11, ticker: 'BABA',  headline: 'Alibaba reorganization shows progress as cloud unit returns to growth', time: '2d',  source: 'WSJ',         sentiment: 'pos' },
  { id: 12, ticker: 'XOM',   headline: 'Exxon Q1 production rises on Permian Basin output; cash flow strong', time: '3d',  source: 'Bloomberg',   sentiment: 'pos' },
  { id: 13, ticker: 'SOUN',  headline: 'SoundHound AI lands automotive contract with major Asian OEM for voice assistant', time: '3d',  source: 'TechCrunch', sentiment: 'pos' },
  { id: 14, ticker: 'MSFT',  headline: 'Microsoft Copilot enterprise adoption hits 70% of Fortune 500, says CEO Nadella', time: '4d',  source: 'CNBC',     sentiment: 'pos' },
];

const NewsView = ({ portfolio }) => {
  const [filter, setFilter] = useState('all');
  const tickers = ['all', ...new Set(portfolio.positions.map(p => p.symbol))];
  const filtered = filter === 'all' ? MOCK_NEWS : MOCK_NEWS.filter(n => n.ticker === filter);

  return (
    <div className="space-y-4">
      <div>
        <div className="font-serif text-3xl" style={{ color: C.text }}>Market News</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>
          Curated from your holdings · Connect Finnhub for live news feed
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tickers.slice(0, 14).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap no-tap"
            style={{
              background: filter === t ? C.gold : C.surface,
              color: filter === t ? C.ink : C.textDim,
              border: `1px solid ${filter === t ? C.gold : C.border}`,
            }}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Newspaper size={32} className="mx-auto mb-3" style={{ color: C.textFaint }} />
            <div className="text-sm" style={{ color: C.textDim }}>No news for {filter}</div>
          </div>
        ) : filtered.map((n, i) => (
          <div key={n.id} className="p-5 transition-colors cursor-pointer fade-in"
            style={{
              borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
              animationDelay: `${i * 30}ms`,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.surface2}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center font-mono text-[10px] font-semibold border shrink-0"
                style={{
                  background: n.sentiment === 'pos' ? 'rgba(95,168,114,0.08)' : n.sentiment === 'neg' ? 'rgba(201,112,73,0.08)' : C.surface2,
                  borderColor: n.sentiment === 'pos' ? 'rgba(95,168,114,0.25)' : n.sentiment === 'neg' ? 'rgba(201,112,73,0.25)' : C.border,
                  color: n.sentiment === 'pos' ? C.pos : n.sentiment === 'neg' ? C.neg : C.text,
                }}>
                {n.ticker.slice(0, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: C.textFaint }}>{n.source}</span>
                  <span className="text-[11px]" style={{ color: C.textFaint }}>·</span>
                  <span className="font-mono text-[11px]" style={{ color: C.textFaint }}>{n.time} ago</span>
                  {n.sentiment !== 'neutral' && (
                    <PillBadge tone={n.sentiment === 'pos' ? 'pos' : 'neg'}>
                      {n.sentiment === 'pos' ? 'Bullish' : 'Bearish'}
                    </PillBadge>
                  )}
                </div>
                <div className="text-base leading-snug" style={{ color: C.text }}>{n.headline}</div>
              </div>
              <ArrowUpRight size={16} style={{ color: C.textFaint }} className="shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

/* ============================================================
   ACTIVITY VIEW
   ============================================================ */
const ActivityView = ({ transactions }) => (
  <div className="space-y-4">
    <div>
      <div className="font-serif text-3xl" style={{ color: C.text }}>Activity</div>
      <div className="text-sm mt-1" style={{ color: C.textDim }}>
        Transaction history · {transactions.length} total
      </div>
    </div>

    {transactions.length === 0 ? (
      <Card className="p-12 text-center">
        <Activity size={32} className="mx-auto mb-3" style={{ color: C.textFaint }} />
        <div className="font-serif text-xl" style={{ color: C.text }}>No transactions yet</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>Add transactions via the top-right button to track activity here.</div>
      </Card>
    ) : (
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Date', 'Type', 'Symbol', 'Shares', 'Price', 'Total'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] font-medium text-left"
                  style={{ color: C.textFaint }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...transactions].reverse().map((t, i) => (
              <tr key={t.id} className="fade-in"
                style={{ borderBottom: i < transactions.length - 1 ? `1px solid ${C.border}` : 'none', animationDelay: `${i * 25}ms` }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.surface2}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td className="px-4 py-3.5 font-mono text-sm" style={{ color: C.textDim }}>{t.date}</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded text-xs uppercase font-medium font-mono"
                    style={{
                      background: t.type === 'buy' ? 'rgba(95,168,114,0.10)' : 'rgba(201,112,73,0.10)',
                      color: t.type === 'buy' ? C.pos : C.neg,
                      border: `1px solid ${t.type === 'buy' ? 'rgba(95,168,114,0.25)' : 'rgba(201,112,73,0.25)'}`,
                    }}>{t.type}</span>
                </td>
                <td className="px-4 py-3.5 font-medium" style={{ color: C.text }}>{t.symbol}</td>
                <td className="px-4 py-3.5 font-mono text-sm tnum" style={{ color: C.text }}>{fmt.shares(t.shares)}</td>
                <td className="px-4 py-3.5 font-mono text-sm tnum" style={{ color: C.text }}>{fmt.dollar(t.price, 2)}</td>
                <td className="px-4 py-3.5 font-mono text-sm tnum font-medium" style={{ color: C.text }}>
                  {fmt.dollar(t.shares * t.price, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    )}
  </div>
);

/* ============================================================
   SETTINGS VIEW
   ============================================================ */
const SettingsView = ({ apiKey, setApiKey, apiStatus, errorMsg, demoMode, setDemoMode, refreshAll }) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    if (!keyInput) return;
    setTesting(true);
    setTestResult(null);
    try {
      const quote = await fetchQuote('AAPL', keyInput);
      setTestResult({ success: true, msg: `Connected! AAPL @ $${quote.price.toFixed(2)}` });
    } catch (e) {
      setTestResult({ success: false, msg: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = keyInput.trim();
    localStorage.setItem('finsight-api-key', trimmed);
    setApiKey(trimmed);
    setTestResult(null);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('finsight-api-key');
    setApiKey('');
    setKeyInput('');
    setTestResult(null);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <div className="font-serif text-3xl" style={{ color: C.text }}>Settings</div>
        <div className="text-sm mt-1" style={{ color: C.textDim }}>
          Configure data sources, behavior, and display preferences
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Key size={14} style={{ color: C.gold }} />
              <span className="font-medium" style={{ color: C.text }}>Finnhub API Integration</span>
            </div>
            <div className="text-xs" style={{ color: C.textDim }}>
              Connect to Finnhub for real-time market quotes. Free tier: 60 API calls/minute.
            </div>
          </div>
          <StatusIndicator status={apiStatus} errorMsg={errorMsg} />
        </div>

        {!apiKey ? (
          <>
            <div className="p-4 rounded-lg mb-4" style={{ background: 'rgba(212,169,69,0.06)', border: '1px solid rgba(212,169,69,0.2)' }}>
              <div className="flex items-start gap-3">
                <Info size={14} className="mt-0.5 shrink-0" style={{ color: C.gold }} />
                <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>
                  Get a free API key at <span className="font-mono" style={{ color: C.gold }}>finnhub.io/register</span> (no credit card required).
                  Your key is stored only in this browser session and is never sent to any server other than Finnhub.
                </div>
              </div>
            </div>

            <label className="text-[10px] uppercase tracking-[0.15em] block mb-2" style={{ color: C.textFaint }}>API Key</label>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <input type={showKey ? 'text' : 'password'} value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Paste your Finnhub API key here…"
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm" />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded no-tap"
                  style={{ color: C.textFaint }}>
                  {showKey ? <Eye size={14} /> : <Eye size={14} className="opacity-50" />}
                </button>
              </div>
              <button onClick={handleTest} disabled={!keyInput || testing}
                className="btn-ghost px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 no-tap">
                {testing ? <RefreshCw size={14} className="spin" /> : <Wifi size={14} />}
                Test
              </button>
              <button onClick={handleSave} disabled={!keyInput}
                className="btn-primary px-4 py-2.5 rounded-lg text-sm no-tap">
                Connect
              </button>
            </div>

            {testResult && (
              <div className="p-3 rounded-md flex items-center gap-2 fade-in" style={{
                background: testResult.success ? 'rgba(95,168,114,0.08)' : 'rgba(201,112,73,0.08)',
                border: `1px solid ${testResult.success ? 'rgba(95,168,114,0.25)' : 'rgba(201,112,73,0.25)'}`,
              }}>
                {testResult.success ? <CheckCircle2 size={14} style={{ color: C.pos }} /> : <AlertCircle size={14} style={{ color: C.neg }} />}
                <span className="text-xs" style={{ color: testResult.success ? C.pos : C.neg }}>{testResult.msg}</span>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-4 rounded-lg" style={{ background: 'rgba(95,168,114,0.06)', border: '1px solid rgba(95,168,114,0.2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} style={{ color: C.pos }} />
                  <div>
                    <div className="font-medium text-sm" style={{ color: C.text }}>Connected to Finnhub</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: C.textDim }}>
                      Key: {apiKey.slice(0, 8)}{'•'.repeat(Math.max(0, apiKey.length - 12))}{apiKey.slice(-4)}
                    </div>
                  </div>
                </div>
                <button onClick={refreshAll} className="btn-ghost px-3 py-1.5 rounded-md text-xs flex items-center gap-2 no-tap">
                  <RefreshCw size={12} /> Refresh now
                </button>
              </div>
            </div>
            <button onClick={handleDisconnect}
              className="btn-ghost px-4 py-2 rounded-md text-sm no-tap"
              style={{ color: C.neg, borderColor: 'rgba(201,112,73,0.25)' }}>
              Disconnect API
            </button>
          </div>
        )}
      </Card>

      {!apiKey && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium mb-1" style={{ color: C.text }}>Demo Mode (Simulated Prices)</div>
              <div className="text-xs" style={{ color: C.textDim }}>
                Without a live API key, simulate price ticks every 4s for a "live" feel using imported prices as base.
              </div>
            </div>
            <button onClick={() => setDemoMode(!demoMode)}
              className="relative w-11 h-6 rounded-full transition-colors no-tap"
              style={{ background: demoMode ? C.gold : C.surface3 }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: demoMode ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="font-medium mb-3" style={{ color: C.text }}>About FinSight</div>
        <div className="space-y-3 text-xs leading-relaxed" style={{ color: C.textDim }}>
          <p>
            FinSight is a portfolio intelligence platform combining real-time tracking with five expert advisor personas:
            Certified Financial Planner, Tax Strategist, Portfolio Strategist, Risk Analyst, and Social Security Specialist.
          </p>
          <p>
            <span style={{ color: C.text }}>Data sources:</span> Quotes via Finnhub (free tier).
            Sector classifications and beta values are pre-computed for the included universe.
            Historical chart data is procedurally generated from current prices for visualization purposes.
          </p>
          <p>
            <span style={{ color: C.text }}>Privacy:</span> Your API key and portfolio data are stored only in browser memory
            and persist only for this session. Nothing is sent to any server other than Finnhub for quote requests.
          </p>
          <p style={{ color: C.textFaint }}>
            FinSight is for educational purposes only and does not constitute personalized financial advice.
            Consult a qualified fiduciary advisor before implementing any strategy.
          </p>
        </div>
      </Card>
    </div>
  );
};
/* ============================================================
   STOCK DETAIL PANEL (slide-in)
   ============================================================ */
const StockDetailPanel = ({ symbol, prices, holdings, onClose, onAddTransaction }) => {
  const [range, setRange] = useState('1M');
  const rangeConfig = RANGES.find(r => r.key === range);

  if (!symbol) return null;
  const p = prices[symbol];
  const meta = STOCK_META[symbol];
  if (!p || !meta) return null;

  const holding = holdings.find(h => h.symbol === symbol);
  const positive = p.price >= p.prevClose;
  const beta = STOCK_BETAS[symbol] || 1.0;

  const chartData = useMemo(() =>
    genHistory(symbol + '_detail_' + range, p.price, rangeConfig.points, rangeConfig.vol, rangeConfig.drift),
    [symbol, range, p.price]);

  const stats = [
    { label: 'Open', value: fmt.dollar(p.open || p.price * 0.998, 2) },
    { label: 'Day High', value: fmt.dollar(p.high || p.price * 1.012, 2) },
    { label: 'Day Low', value: fmt.dollar(p.low || p.price * 0.988, 2) },
    { label: 'Prev Close', value: fmt.dollar(p.prevClose, 2) },
    { label: 'Beta (5Y)', value: beta.toFixed(2) },
    { label: 'Sector', value: meta.sector, mono: false },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[520px] z-50 slide-in-r overflow-y-auto"
        style={{ background: C.surface, borderLeft: `1px solid ${C.borderL}` }}>

        <div className="sticky top-0 z-10 px-6 py-5 flex items-center justify-between border-b backdrop-blur-md"
          style={{ background: 'rgba(20,25,39,0.92)', borderColor: C.border }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md flex items-center justify-center font-mono text-xs font-semibold border"
              style={{ background: C.surface2, borderColor: C.border, color: C.text }}>
              {symbol.slice(0, 4)}
            </div>
            <div>
              <div className="font-medium" style={{ color: C.text }}>{symbol}</div>
              <div className="text-xs" style={{ color: C.textDim }}>{meta.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-md no-tap">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="serif-num text-4xl" style={{ color: C.text }}>{fmt.dollar(p.price, 2)}</span>
              <ChangeIndicator value={p.price - p.prevClose} percent={p.dayChangePct} size="lg" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <PillBadge tone="neutral">{meta.sector}</PillBadge>
              <PillBadge tone="neutral">{meta.industry}</PillBadge>
              <PillBadge tone={beta > 1.3 ? 'neg' : beta < 0.8 ? 'pos' : 'gold'}>β {beta.toFixed(2)}</PillBadge>
            </div>
          </div>

          {holding && (
            <div className="p-4 rounded-lg" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: C.gold }}>Your Position</span>
                <span className="text-[10px] font-mono" style={{ color: C.textFaint }}>
                  {((holding.shares * p.price) / 70000 * 100).toFixed(1)}% of portfolio
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Shares · Avg Cost</div>
                  <div className="font-mono text-sm tnum mt-1" style={{ color: C.text }}>
                    {fmt.shares(holding.shares)} @ {fmt.dollar(holding.avgCost, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Market Value</div>
                  <div className="font-mono text-sm tnum mt-1" style={{ color: C.text }}>
                    {fmt.dollar(holding.shares * p.price, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Cost Basis</div>
                  <div className="font-mono text-sm tnum mt-1" style={{ color: C.textDim }}>
                    {fmt.dollar(holding.shares * holding.avgCost, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Total Return</div>
                  <div className="font-mono text-sm tnum mt-1" style={{
                    color: holding.shares * p.price - holding.shares * holding.avgCost >= 0 ? C.pos : C.neg }}>
                    {fmt.dollar(holding.shares * p.price - holding.shares * holding.avgCost, 2)}
                    {' · '}
                    {fmt.pct(((p.price - holding.avgCost) / holding.avgCost) * 100)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.18em]" style={{ color: C.textDim }}>Price History</span>
              <div className="flex items-center gap-1 p-0.5 rounded-md border" style={{ borderColor: C.border, background: C.surface2 }}>
                {RANGES.map(r => (
                  <button key={r.key} onClick={() => setRange(r.key)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono transition-all no-tap"
                    style={{ background: range === r.key ? C.gold : 'transparent', color: range === r.key ? C.ink : C.textDim }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <PerformanceChart data={chartData} height={200} showAxis={false} />
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] mb-3" style={{ color: C.textDim }}>Key Stats</div>
            <div className="grid grid-cols-2 gap-3">
              {stats.map(s => (
                <div key={s.label} className="p-3 rounded-md" style={{ background: C.surface2 }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>{s.label}</div>
                  <div className={`mt-1 ${s.mono !== false ? 'font-mono' : ''} text-sm tnum`} style={{ color: C.text }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => onAddTransaction(symbol, 'buy')}
              className="btn-primary px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm no-tap">
              <Plus size={14} strokeWidth={2.2} /> Buy {symbol}
            </button>
            <button onClick={() => onAddTransaction(symbol, 'sell')} disabled={!holding}
              className="btn-ghost px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm no-tap"
              style={{ opacity: holding ? 1 : 0.4 }}>
              <ArrowDownRight size={14} /> Sell {symbol}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/* ============================================================
   TRANSACTION MODAL
   ============================================================ */
const TransactionModal = ({ open, prefilledSymbol, prefilledType, prices, holdings, onClose, onSubmit }) => {
  const [type, setType] = useState(prefilledType || 'buy');
  const [symbol, setSymbol] = useState(prefilledSymbol || '');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (open) {
      setType(prefilledType || 'buy');
      setSymbol(prefilledSymbol || '');
      setShares('');
      const sym = prefilledSymbol || '';
      if (sym && prices[sym]) setPrice(prices[sym].price.toFixed(2));
      else setPrice('');
    }
  }, [open, prefilledSymbol, prefilledType, prices]);

  useEffect(() => {
    if (symbol && prices[symbol] && !prefilledSymbol) {
      setPrice(prices[symbol].price.toFixed(2));
    }
  }, [symbol, prices, prefilledSymbol]);

  if (!open) return null;

  const sharesNum = parseFloat(shares) || 0;
  const priceNum = parseFloat(price) || 0;
  const total = sharesNum * priceNum;
  const symbolUpper = symbol.toUpperCase();
  const meta = STOCK_META[symbolUpper];
  const currentHolding = holdings.find(h => h.symbol === symbolUpper);
  const canSell = type === 'sell' ? (currentHolding && sharesNum <= currentHolding.shares) : true;

  const handleSubmit = () => {
    if (!symbolUpper || !sharesNum || !priceNum || !canSell) return;
    onSubmit({
      type, symbol: symbolUpper, shares: sharesNum, price: priceNum,
      date: new Date().toISOString().slice(0, 10),
      id: Date.now(),
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
        <div className="rounded-xl border p-6 w-full max-w-md scale-in"
          style={{ background: C.surface, borderColor: C.borderL, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
          onClick={(e) => e.stopPropagation()}>

          <div className="flex items-center justify-between mb-5">
            <div className="font-serif text-2xl" style={{ color: C.text }}>Add Transaction</div>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-md no-tap"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {['buy', 'sell'].map(t => (
              <button key={t} onClick={() => setType(t)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium uppercase tracking-wider transition-all no-tap"
                style={{
                  background: type === t ? (t === 'buy' ? C.pos : C.neg) : C.surface2,
                  color: type === t ? C.ink : C.textDim,
                  border: `1px solid ${type === t ? (t === 'buy' ? C.pos : C.neg) : C.border}`,
                }}>
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] block mb-1.5" style={{ color: C.textFaint }}>Symbol</label>
              <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL" className="w-full px-4 py-2.5 rounded-lg font-mono text-sm" />
              {symbolUpper && meta && (
                <div className="text-[11px] mt-1.5" style={{ color: C.textDim }}>
                  {meta.name} · {meta.sector}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] block mb-1.5" style={{ color: C.textFaint }}>Shares</label>
                <input type="number" value={shares} onChange={(e) => setShares(e.target.value)}
                  placeholder="0" step="0.0001"
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm" />
                {type === 'sell' && currentHolding && (
                  <div className="text-[11px] mt-1.5" style={{ color: sharesNum > currentHolding.shares ? C.neg : C.textDim }}>
                    Available: {fmt.shares(currentHolding.shares)}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] block mb-1.5" style={{ color: C.textFaint }}>Price/Share</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00" step="0.01"
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm" />
              </div>
            </div>

            {sharesNum > 0 && priceNum > 0 && (
              <div className="p-4 rounded-lg" style={{ background: C.surface2 }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: C.textFaint }}>Total {type === 'buy' ? 'Cost' : 'Proceeds'}</span>
                  <span className="serif-num text-2xl" style={{ color: type === 'buy' ? C.neg : C.pos }}>
                    {type === 'buy' ? '-' : '+'}{fmt.dollar(total, 2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="btn-ghost flex-1 py-2.5 rounded-lg text-sm no-tap">Cancel</button>
              <button onClick={handleSubmit}
                disabled={!symbolUpper || !sharesNum || !priceNum || !canSell}
                className="btn-primary flex-[2] py-2.5 rounded-lg text-sm no-tap">
                Confirm {type === 'buy' ? 'Purchase' : 'Sale'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
/* ============================================================
   BACKEND API CONFIG
   ============================================================ */
const API_BASE = import.meta.env.VITE_API_URL || 'https://trading-trip-api.onrender.com';

class WarmupError extends Error {
  constructor() { super('warming_up'); this.isWarmup = true; }
}

async function _doFetch(path, opts, timeoutMs) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const method = (opts.method || 'GET').toUpperCase();
    const headers = method === 'GET' || method === 'HEAD'
      ? { ...opts.headers }
      : { 'Content-Type': 'application/json', ...opts.headers };
    const r = await fetch(`${API_BASE}${path}`, { headers, signal: controller.signal, ...opts });
    if (!r.ok) throw new Error(`API ${r.status}: ${path}`);
    return r.json();
  } catch (e) {
    // AbortError = timeout; TypeError = network failure (cold-start connection refused)
    if (e.name === 'AbortError' || (e instanceof TypeError && !e.message.includes('API '))) {
      throw new WarmupError();
    }
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

async function apiFetch(path, opts = {}, { onWarmup } = {}) {
  try {
    return await _doFetch(path, opts, 30_000);
  } catch (e) {
    if (e.isWarmup) {
      onWarmup?.();
      // Server is cold-starting — wait 15s then retry with a longer window
      await new Promise(res => setTimeout(res, 15_000));
      try {
        return await _doFetch(path, opts, 60_000);
      } catch (e2) {
        if (e2.isWarmup) {
          throw new Error('Server is taking too long to start. Please wait 30 seconds and try again.');
        }
        throw e2;
      }
    }
    throw e;
  }
}

/* ============================================================
   LOCAL SYMBOL INDEX — fallback when backend is unreachable
   ============================================================ */
const LOCAL_SYMBOLS = [
  {symbol:'AAPL', name:'Apple Inc.',                          sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'MSFT', name:'Microsoft Corporation',               sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'GOOGL',name:'Alphabet Inc.',                       sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'AMZN', name:'Amazon.com Inc.',                     sector:'Consumer Discretionary', exchange:'NASDAQ'},
  {symbol:'NVDA', name:'NVIDIA Corporation',                  sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'META', name:'Meta Platforms Inc.',                 sector:'Communication Services', exchange:'NASDAQ'},
  {symbol:'TSLA', name:'Tesla Inc.',                          sector:'Consumer Discretionary', exchange:'NASDAQ'},
  {symbol:'BRK.B',name:'Berkshire Hathaway Inc.',             sector:'Financials',             exchange:'NYSE'},
  {symbol:'LLY',  name:'Eli Lilly and Company',               sector:'Health Care',            exchange:'NYSE'},
  {symbol:'JPM',  name:'JPMorgan Chase & Co.',                sector:'Financials',             exchange:'NYSE'},
  {symbol:'V',    name:'Visa Inc.',                           sector:'Financials',             exchange:'NYSE'},
  {symbol:'XOM',  name:'Exxon Mobil Corporation',             sector:'Energy',                 exchange:'NYSE'},
  {symbol:'UNH',  name:'UnitedHealth Group Inc.',             sector:'Health Care',            exchange:'NYSE'},
  {symbol:'JNJ',  name:'Johnson & Johnson',                   sector:'Health Care',            exchange:'NYSE'},
  {symbol:'WMT',  name:'Walmart Inc.',                        sector:'Consumer Staples',       exchange:'NYSE'},
  {symbol:'MA',   name:'Mastercard Inc.',                     sector:'Financials',             exchange:'NYSE'},
  {symbol:'AVGO', name:'Broadcom Inc.',                       sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'HD',   name:'The Home Depot Inc.',                 sector:'Consumer Discretionary', exchange:'NYSE'},
  {symbol:'CVX',  name:'Chevron Corporation',                 sector:'Energy',                 exchange:'NYSE'},
  {symbol:'AMD',  name:'Advanced Micro Devices Inc.',         sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'NFLX', name:'Netflix Inc.',                        sector:'Communication Services', exchange:'NASDAQ'},
  {symbol:'CRM',  name:'Salesforce Inc.',                     sector:'Technology',             exchange:'NYSE'},
  {symbol:'ADBE', name:'Adobe Inc.',                          sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'QCOM', name:'Qualcomm Inc.',                       sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'DIS',  name:'The Walt Disney Company',             sector:'Communication Services', exchange:'NYSE'},
  {symbol:'GS',   name:'The Goldman Sachs Group Inc.',        sector:'Financials',             exchange:'NYSE'},
  {symbol:'BAC',  name:'Bank of America Corporation',         sector:'Financials',             exchange:'NYSE'},
  {symbol:'INTC', name:'Intel Corporation',                   sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'PYPL', name:'PayPal Holdings Inc.',                sector:'Financials',             exchange:'NASDAQ'},
  {symbol:'UBER', name:'Uber Technologies Inc.',              sector:'Industrials',            exchange:'NYSE'},
  {symbol:'COIN', name:'Coinbase Global Inc.',                sector:'Financials',             exchange:'NASDAQ'},
  {symbol:'PLTR', name:'Palantir Technologies Inc.',          sector:'Technology',             exchange:'NYSE'},
  {symbol:'SNOW', name:'Snowflake Inc.',                      sector:'Technology',             exchange:'NYSE'},
  {symbol:'CRWD', name:'CrowdStrike Holdings Inc.',           sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'NET',  name:'Cloudflare Inc.',                     sector:'Technology',             exchange:'NYSE'},
  {symbol:'NOW',  name:'ServiceNow Inc.',                     sector:'Technology',             exchange:'NYSE'},
  {symbol:'PANW', name:'Palo Alto Networks Inc.',             sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'MSTR', name:'MicroStrategy Inc.',                  sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'ARM',  name:'Arm Holdings plc',                    sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'TSM',  name:'Taiwan Semiconductor Manufacturing',  sector:'Technology',             exchange:'NYSE'},
  {symbol:'ASML', name:'ASML Holding N.V.',                   sector:'Technology',             exchange:'NASDAQ'},
  {symbol:'F',    name:'Ford Motor Company',                  sector:'Consumer Discretionary', exchange:'NYSE'},
  {symbol:'GM',   name:'General Motors Company',              sector:'Consumer Discretionary', exchange:'NYSE'},
  {symbol:'BA',   name:'The Boeing Company',                  sector:'Industrials',            exchange:'NYSE'},
  {symbol:'CAT',  name:'Caterpillar Inc.',                    sector:'Industrials',            exchange:'NYSE'},
  {symbol:'LMT',  name:'Lockheed Martin Corporation',         sector:'Industrials',            exchange:'NYSE'},
  {symbol:'GE',   name:'GE Aerospace',                        sector:'Industrials',            exchange:'NYSE'},
  {symbol:'WFC',  name:'Wells Fargo & Company',               sector:'Financials',             exchange:'NYSE'},
  {symbol:'MS',   name:'Morgan Stanley',                      sector:'Financials',             exchange:'NYSE'},
  {symbol:'BLK',  name:'BlackRock Inc.',                      sector:'Financials',             exchange:'NYSE'},
  {symbol:'SCHW', name:'Charles Schwab Corporation',          sector:'Financials',             exchange:'NYSE'},
  {symbol:'SPY',  name:'SPDR S&P 500 ETF Trust',              sector:'ETF',                    exchange:'NYSE'},
  {symbol:'QQQ',  name:'Invesco QQQ Trust',                   sector:'ETF',                    exchange:'NASDAQ'},
  {symbol:'GLD',  name:'SPDR Gold Shares',                    sector:'ETF',                    exchange:'NYSE'},
  {symbol:'TLT',  name:'iShares 20+ Year Treasury Bond ETF',  sector:'ETF',                    exchange:'NASDAQ'},
  {symbol:'BTC-USD',name:'Bitcoin USD',                       sector:'Crypto',                 exchange:'Crypto'},
  {symbol:'ETH-USD',name:'Ethereum USD',                      sector:'Crypto',                 exchange:'Crypto'},
  {symbol:'SOL-USD',name:'Solana USD',                        sector:'Crypto',                 exchange:'Crypto'},
];

const _localSynonyms = {
  apple:'AAPL', microsoft:'MSFT', google:'GOOGL', alphabet:'GOOGL', amazon:'AMZN',
  nvidia:'NVDA', meta:'META', facebook:'META', tesla:'TSLA', berkshire:'BRK.B',
  jpmorgan:'JPM', visa:'V', exxon:'XOM', walmart:'WMT', mastercard:'MA',
  netflix:'NFLX', disney:'DIS', intel:'INTC', paypal:'PYPL', bitcoin:'BTC-USD',
  ethereum:'ETH-USD', solana:'SOL-USD', amd:'AMD', salesforce:'CRM', palantir:'PLTR',
  coinbase:'COIN', snowflake:'SNOW', crowdstrike:'CRWD', cloudflare:'NET', boeing:'BA',
  ford:'F', gold:'GLD', 'morgan stanley':'MS', blackrock:'BLK',
};

function localSearch(q, limit = 8) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const out = [], seen = new Set();
  const add = (item, mt, sc) => {
    if (seen.has(item.symbol)) return;
    seen.add(item.symbol);
    out.push({ ...item, match_type: mt, _sc: sc });
  };
  // exact symbol
  LOCAL_SYMBOLS.forEach(r => { if (r.symbol.toLowerCase() === s) add(r, 'exact_symbol', 100); });
  // synonym
  const syn = _localSynonyms[s];
  if (syn) { const r = LOCAL_SYMBOLS.find(x => x.symbol === syn); if (r) add(r, 'synonym', 90); }
  // prefix symbol
  LOCAL_SYMBOLS.forEach(r => { if (r.symbol.toLowerCase().startsWith(s)) add(r, 'prefix', 80); });
  // name contains
  LOCAL_SYMBOLS.forEach(r => { if (r.name.toLowerCase().includes(s)) add(r, 'fts', 60); });
  out.sort((a, b) => b._sc - a._sc);
  return out.slice(0, limit).map(({ _sc, ...rest }) => rest);
}

/* ============================================================
   SEARCH BAR  — debounced, keyboard navigation, recent cache
   ============================================================ */
const MAX_RECENT = 6;

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SearchBar = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('finsight-recent-searches') || '[]'); }
    catch { return []; }
  });
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); setOpen(!!recent.length); return; }
    setLoading(true);
    apiFetch(`/api/search?q=${encodeURIComponent(debounced)}&limit=8`)
      .then(d => { setResults(d.results || []); setOpen(true); setCursor(-1); })
      .catch(() => {
        // Backend unreachable — fall back to local index
        const fallback = localSearch(debounced, 8);
        setResults(fallback);
        setOpen(true);
        setCursor(-1);
      })
      .finally(() => setLoading(false));
  }, [debounced]);

  const saveRecent = useCallback((item) => {
    const next = [item, ...recent.filter(r => r.symbol !== item.symbol)].slice(0, MAX_RECENT);
    setRecent(next);
    localStorage.setItem('finsight-recent-searches', JSON.stringify(next));
  }, [recent]);

  const handleSelect = useCallback((item) => {
    saveRecent(item);
    setQuery('');
    setOpen(false);
    onSelect?.(item);
  }, [saveRecent, onSelect]);

  const handleKey = (e) => {
    const items = results.length ? results : recent;
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    else if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); handleSelect(items[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); setCursor(-1); }
  };

  const displayItems = results.length ? results : (query ? [] : recent);
  const matchTypeColor = { exact_symbol: C.gold, prefix: C.info, fuzzy: C.textDim, fts: C.pos, synonym: '#a587c1', fallback: C.textFaint };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 px-3 h-9 rounded-lg border"
        style={{ background: C.surface2, borderColor: open ? C.gold : C.border }}>
        <Search size={14} style={{ color: C.textDim, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
          placeholder="Search symbol or company…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: C.text }}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent spin" style={{ borderColor: C.gold + '60', borderTopColor: C.gold }} />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}>
            <X size={12} style={{ color: C.textDim }} />
          </button>
        )}
      </div>

      {open && displayItems.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-50 py-1 scale-in"
          style={{ background: C.surface, borderColor: C.borderL, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          {!results.length && recent.length > 0 && (
            <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider"
              style={{ color: C.textFaint }}>Recent</div>
          )}
          {displayItems.map((item, idx) => (
            <button
              key={item.symbol}
              onMouseDown={() => handleSelect(item)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
              style={{ background: cursor === idx ? C.surface2 : 'transparent' }}>
              <div className="w-10 text-center shrink-0">
                <span className="font-mono text-xs font-semibold" style={{ color: C.gold }}>{item.symbol}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: C.text }}>{item.name}</div>
                <div className="text-xs" style={{ color: C.textDim }}>{item.exchange} · {item.sector}</div>
              </div>
              {item.match_type && (
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: matchTypeColor[item.match_type] + '20', color: matchTypeColor[item.match_type] }}>
                  {item.match_type.replace('_', ' ')}
                </span>
              )}
            </button>
          ))}
          {query && !results.length && !loading && (
            <div className="px-3 py-2 text-sm" style={{ color: C.textDim }}>No results for "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   MARKET REGIME BANNER
   ============================================================ */
const regimePalette = {
  bullish_trend:    { bg: 'rgba(95,168,114,0.12)',  border: '#5fa872', dot: '#5fa872'  },
  bearish_trend:    { bg: 'rgba(201,112,73,0.12)',  border: '#c97049', dot: '#c97049'  },
  range_bound:      { bg: 'rgba(212,169,69,0.12)',  border: '#d4a945', dot: '#d4a945'  },
  high_vol_stress:  { bg: 'rgba(220,80,80,0.18)',   border: '#e05555', dot: '#e05555'  },
};

const MarketRegimeBanner = () => {
  const [regime, setRegime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/regime');
      setRegime(data);
    } catch { /* no-op — banner stays hidden */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 300_000); return () => clearInterval(id); }, [load]);

  if (loading || !regime) return null;
  const pal = regimePalette[regime.regime] || regimePalette.range_bound;

  return (
    <div className="px-8 pt-3">
      <div className="rounded-lg border px-4 py-2.5 fade-in"
        style={{ background: pal.bg, borderColor: pal.border }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <span className="text-base">{regime.emoji}</span>
          <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <span className="text-sm font-semibold" style={{ color: pal.dot }}>
              Market Regime: {regime.label}
            </span>
            <span className="text-xs" style={{ color: C.textDim }}>
              VIX {regime.vix?.toFixed(1)} · Confidence {regime.confidence}%
            </span>
            <span className="hidden md:inline text-xs" style={{ color: C.text }}>
              {regime.risk_environment}
            </span>
          </div>
          <ChevronDown size={14} style={{ color: C.textDim, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        {expanded && (
          <div className="mt-3 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 border-t" style={{ borderColor: pal.border + '40' }}>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: C.textDim }}>Recommended Action</p>
              <p className="text-xs leading-relaxed" style={{ color: C.text }}>{regime.recommended_action}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: C.textDim }}>Strategy Notes</p>
              <ul className="space-y-0.5">
                {regime.strategy_notes?.map((note, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: C.text }}>
                    <span style={{ color: pal.dot }}>·</span>{note}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: C.textDim }}>Position Size Adjustment</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full" style={{ background: C.surface3 }}>
                  <div className="h-full rounded-full" style={{ width: `${(regime.position_size_adj || 1) * 100}%`, background: pal.dot }} />
                </div>
                <span className="text-xs font-mono font-semibold" style={{ color: pal.dot }}>
                  {((regime.position_size_adj || 1) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: C.textDim }}>Preferred Sectors</p>
              <div className="flex flex-wrap gap-1">
                {regime.preferred_sectors?.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: pal.dot + '20', color: pal.dot }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   TRADING TIPS VIEW
   ============================================================ */
const TradingTipsView = ({ portfolio }) => {
  const [symbol, setSymbol] = useState('');
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState(null);

  const portfolioEquity = portfolio?.value || 100_000;

  const fetchTip = useCallback(async (sym) => {
    if (!sym) return;
    setLoading(true); setError(null); setTip(null); setWarmingUp(false);
    try {
      const data = await apiFetch(
        `/api/tips/${sym}?portfolio_equity=${portfolioEquity}`,
        {},
        { onWarmup: () => setWarmingUp(true) }
      );
      setTip(data);
    } catch (e) { setError(e.isWarmup ? 'Server timed out waking up. Please try again.' : e.message); }
    finally { setLoading(false); setWarmingUp(false); }
  }, [portfolioEquity]);

  useEffect(() => {
    const handler = e => { const s = e.detail?.symbol; if (s) { setSymbol(s); fetchTip(s); } };
    window.addEventListener('finsight:prefill', handler);
    return () => window.removeEventListener('finsight:prefill', handler);
  }, [fetchTip]);

  const signalColors = {
    buy_setup: C.pos, neutral: C.gold, no_signal: C.textDim, sell_setup: C.neg,
  };
  const signalLabels = {
    buy_setup: 'Buy Setup', neutral: 'Neutral / Watch', no_signal: 'No Signal', sell_setup: 'Sell Setup',
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Crosshair size={20} style={{ color: C.gold }} />
        <div>
          <h2 className="text-xl font-semibold font-serif" style={{ color: C.text }}>Trading Tips Engine</h2>
          <p className="text-xs" style={{ color: C.textDim }}>ATR-based entry / stop-loss / position sizing · 1% portfolio risk</p>
        </div>
      </div>

      <div className="flex gap-3">
        <SearchBar onSelect={item => { setSymbol(item.symbol); fetchTip(item.symbol); }} />
        <button
          onClick={() => { if (symbol) fetchTip(symbol.toUpperCase()); }}
          disabled={loading || !symbol}
          className="btn-primary px-4 h-9 rounded-lg text-sm font-medium shrink-0">
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {/* Quick picks from holdings */}
      {!tip && !loading && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs" style={{ color: C.textDim }}>Quick analyze:</span>
          {portfolio?.positions?.slice(0, 8).map(p => (
            <button key={p.symbol}
              onClick={() => fetchTip(p.symbol)}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{ borderColor: C.border, color: C.textDim }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              {p.symbol}
            </button>
          ))}
        </div>
      )}

      {warmingUp && (
        <div className="p-4 rounded-lg border flex items-center gap-3" style={{ background: 'rgba(212,169,69,0.08)', borderColor: C.gold }}>
          <RefreshCw size={16} className="spin shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="text-sm font-medium" style={{ color: C.gold }}>Server waking up (free tier)</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>Render free tier sleeps after inactivity. Auto-retrying — this takes up to 60 seconds on first load.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border" style={{ background: 'rgba(201,112,73,0.1)', borderColor: C.neg }}>
          <p className="text-sm" style={{ color: C.neg }}>{error}</p>
          <button onClick={() => symbol && fetchTip(symbol)} className="text-xs mt-2 underline" style={{ color: C.gold }}>Try again</button>
        </div>
      )}

      {loading && !warmingUp && (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl skeleton" />)}
        </div>
      )}

      {tip && (
        <div className="space-y-4 fade-in">
          {/* Signal header */}
          <div className="rounded-xl border p-5" style={{ background: C.surface2, borderColor: C.border }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-mono font-bold" style={{ color: C.gold }}>{tip.symbol}</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide"
                    style={{ background: (signalColors[tip.signal] || C.textDim) + '20', color: signalColors[tip.signal] || C.textDim }}>
                    {signalLabels[tip.signal] || tip.signal}
                  </span>
                  {tip.technicals?.ema_cross === 'golden_cross' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.gold + '25', color: C.gold }}>✦ GOLDEN X</span>
                  )}
                  {tip.technicals?.ema_cross === 'death_cross' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.neg + '25', color: C.neg }}>✕ DEATH X</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: C.textDim }}>VIX {tip.technicals?.vix?.toFixed(1)} · ATR {tip.technicals?.atr14?.toFixed(2)} · Generated {new Date(tip.generated_at).toLocaleTimeString()}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs mb-1" style={{ color: C.textDim }}>Signal Score</div>
                <div className="text-3xl font-serif font-bold" style={{ color: signalColors[tip.signal] || C.text }}>{tip.score}</div>
                <div className="text-xs" style={{ color: C.textFaint }}>/100</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: C.surface3 }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${tip.score}%`, background: signalColors[tip.signal] || C.gold }} />
            </div>
          </div>

          {/* Signals checklist */}
          <div className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Signal Checklist</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tip.signals?.map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: s.active ? C.pos + '25' : C.surface3 }}>
                    <span style={{ color: s.active ? C.pos : C.textFaint, fontSize: 9 }}>{s.active ? '✓' : '○'}</span>
                  </div>
                  <span style={{ color: s.active ? C.text : C.textFaint }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade plan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.info + '20' }}>
                  <Target size={13} style={{ color: C.info }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: C.text }}>Entry Zone</span>
              </div>
              {[
                ['Low',     fmt.dollar(tip.entry_zone?.low),      C.text],
                ['Current',fmt.dollar(tip.entry_zone?.midpoint),  C.gold],
                ['High',   fmt.dollar(tip.entry_zone?.high),      C.text],
              ].map(([l, v, col]) => (
                <div key={l} className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.textDim }}>{l}</span>
                  <span className="font-mono font-semibold" style={{ color: col }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.neg + '20' }}>
                  <Shield size={13} style={{ color: C.neg }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: C.text }}>Stop-Loss</span>
                <span className="text-[10px] ml-auto uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{ background: C.surface3, color: C.textFaint }}>{tip.stop_loss?.method}</span>
              </div>
              {[
                ['Stop',       fmt.dollar(tip.stop_loss?.stop_loss),       C.neg],
                ['ATR Stop',   fmt.dollar(tip.stop_loss?.atr_stop),        C.textDim],
                ['Structural', fmt.dollar(tip.stop_loss?.structural_stop), C.textDim],
              ].map(([l, v, col]) => (
                <div key={l} className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.textDim }}>{l}</span>
                  <span className="font-mono font-semibold" style={{ color: col }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.pos + '20' }}>
                  <TrendingUp size={13} style={{ color: C.pos }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: C.text }}>Take-Profit</span>
                <span className="text-xs ml-auto font-mono" style={{ color: C.gold }}>R:R {tip.targets?.rr_ratio}:1</span>
              </div>
              {[
                ['TP1 (+1R)', fmt.dollar(tip.targets?.tp1)],
                ['TP2 (+2R)', fmt.dollar(tip.targets?.tp2)],
                ['TP3 (+3R)', fmt.dollar(tip.targets?.tp3)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.textDim }}>{l}</span>
                  <span className="font-mono font-semibold" style={{ color: C.pos }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Position size + rationale */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
              <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Position Sizing (1% Risk)</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Shares',     tip.position_size?.shares],
                  ['Value',      fmt.dollar(tip.position_size?.dollar_value, 0)],
                  ['Allocation', `${tip.position_size?.position_pct?.toFixed(1)}%`],
                  ['$ at Risk',  fmt.dollar(tip.position_size?.dollar_risk, 0)],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs mb-0.5" style={{ color: C.textDim }}>{l}</p>
                    <p className="font-mono font-semibold text-sm" style={{ color: C.text }}>{v}</p>
                  </div>
                ))}
              </div>
              {tip.position_size?.capped_by_allocation && (
                <p className="mt-2 text-xs" style={{ color: C.gold }}>⚠ Capped at 5% allocation max</p>
              )}
              <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
                <p className="text-xs mb-1" style={{ color: C.textDim }}>Trailing Stop activates at {fmt.dollar(tip.trailing_stop?.activation_price)}</p>
                <p className="text-xs" style={{ color: C.textFaint }}>{tip.trailing_stop?.rule}</p>
              </div>
            </div>

            <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
              <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Rationale</p>
              <ul className="space-y-1.5">
                {(tip.rationale || []).map((r, i) => (
                  <li key={i} className="text-xs flex items-start gap-2" style={{ color: C.textDim }}>
                    <span className="mt-0.5 shrink-0" style={{ color: C.gold }}>›</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Full technical dashboard */}
          <div className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-sm font-semibold mb-4" style={{ color: C.text }}>Technical Dashboard</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {[
                { label: 'RSI(14)',    val: tip.technicals?.rsi14?.toFixed(1),   color: tip.technicals?.rsi14 > 70 ? C.neg : tip.technicals?.rsi14 < 30 ? C.pos : C.text },
                { label: 'Stoch %K',  val: tip.technicals?.stoch_k?.toFixed(0), color: tip.technicals?.stoch_k > 80 ? C.neg : tip.technicals?.stoch_k < 20 ? C.pos : C.text },
                { label: 'MACD Hist', val: tip.technicals?.macd_hist?.toFixed(3),color: tip.technicals?.macd_hist > 0 ? C.pos : C.neg },
                { label: 'BB %B',     val: tip.technicals?.bb_pct_b?.toFixed(2), color: tip.technicals?.bb_pct_b > 0.85 ? C.neg : C.text },
                { label: 'Vol Ratio', val: `${tip.technicals?.vol_ratio?.toFixed(2)}×`, color: tip.technicals?.vol_ratio > 1.5 ? C.pos : C.text },
                { label: 'VIX',       val: tip.technicals?.vix?.toFixed(1),      color: tip.technicals?.vix > 25 ? C.neg : tip.technicals?.vix < 15 ? C.pos : C.text },
                { label: 'EMA 20',    val: fmt.dollar(tip.technicals?.ema20),    color: C.text },
                { label: 'EMA 50',    val: fmt.dollar(tip.technicals?.ema50),    color: C.text },
                { label: 'EMA 200',   val: fmt.dollar(tip.technicals?.ema200),   color: C.text },
                { label: 'ATR(14)',   val: fmt.dollar(tip.technicals?.atr14),    color: C.text },
                { label: 'OBV',       val: tip.technicals?.obv_trend === 'rising' ? '↑ Rising' : '↓ Falling', color: tip.technicals?.obv_trend === 'rising' ? C.pos : C.neg },
                { label: 'RSI Div',   val: tip.technicals?.rsi_divergence === 'bullish' ? '↑ Bull' : tip.technicals?.rsi_divergence === 'bearish' ? '↓ Bear' : '— None', color: tip.technicals?.rsi_divergence === 'bullish' ? C.pos : tip.technicals?.rsi_divergence === 'bearish' ? C.neg : C.textFaint },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-lg p-2.5 text-center" style={{ background: C.surface2 }}>
                  <p className="text-[9px] mb-1 uppercase tracking-wide" style={{ color: C.textFaint }}>{label}</p>
                  <p className="font-mono text-xs font-bold" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Fibonacci levels */}
            {tip.technicals?.fibonacci && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: C.border }}>
                <p className="text-xs font-medium mb-2" style={{ color: C.textDim }}>Fibonacci Levels (52-week range)</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(tip.technicals.fibonacci).map(([pct, price]) => {
                    const isNear = Math.abs(price - tip.technicals.close) / tip.technicals.close < 0.02;
                    return (
                      <div key={pct} className="rounded px-2 py-1 text-center" style={{ background: isNear ? C.gold + '20' : C.surface2, border: `1px solid ${isNear ? C.gold : C.border}` }}>
                        <div className="text-[9px]" style={{ color: isNear ? C.gold : C.textFaint }}>{pct}%</div>
                        <div className="font-mono text-[10px] font-bold" style={{ color: isNear ? C.gold : C.textDim }}>{fmt.dollar(price)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs" style={{ color: C.textFaint }}>Not financial advice · Statistical model · {tip.generated_at?.slice(0,10)}</p>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   ML PREDICTION VIEW
   ============================================================ */
const PredictionView = ({ portfolio }) => {
  const [symbol, setSymbol] = useState('');
  const [horizon, setHorizon] = useState(7);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrediction = useCallback(async (sym, hor, refresh = false) => {
    if (!sym) return;
    setLoading(true); setError(null); setWarmingUp(false);
    try {
      const data = await apiFetch(
        `/api/predict?symbol=${sym}&horizon=${hor}${refresh ? '&refresh=true' : ''}`,
        {},
        { onWarmup: () => setWarmingUp(true) }
      );
      setPrediction(data);
    } catch (e) { setError(e.isWarmup ? 'Server timed out waking up. Please try again.' : e.message); }
    finally { setLoading(false); setWarmingUp(false); }
  }, []);

  useEffect(() => {
    const handler = e => { const s = e.detail?.symbol; if (s) { setSymbol(s); fetchPrediction(s, horizon); } };
    window.addEventListener('finsight:prefill', handler);
    return () => window.removeEventListener('finsight:prefill', handler);
  }, [fetchPrediction, horizon]);

  const horizonLabels = { 7: '7-Day', 30: '30-Day', 90: '90-Day' };
  const probColors = p => p >= 0.6 ? C.pos : p >= 0.4 ? C.gold : C.neg;

  const chartData = prediction ? [
    { label: 'Current', price: prediction.current_price, lower: prediction.current_price, upper: prediction.current_price },
    { label: `+${horizon}d (Bear)`, price: prediction.scenarios?.find(s => s.label === 'Bear')?.price, lower: prediction.confidence_low, upper: prediction.confidence_low },
    { label: `+${horizon}d (Base)`, price: prediction.target_price, lower: prediction.confidence_low, upper: prediction.confidence_high },
    { label: `+${horizon}d (Bull)`, price: prediction.scenarios?.find(s => s.label === 'Bull')?.price, lower: prediction.confidence_high, upper: prediction.confidence_high },
  ].filter(d => d.price) : [];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Brain size={20} style={{ color: C.gold }} />
        <div>
          <h2 className="text-xl font-semibold font-serif" style={{ color: C.text }}>ML Price Prediction</h2>
          <p className="text-xs" style={{ color: C.textDim }}>XGBoost + LSTM ensemble · Walk-forward validated · 80% confidence intervals</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchBar onSelect={item => { setSymbol(item.symbol); fetchPrediction(item.symbol, horizon); }} />
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: C.surface2 }}>
          {[7, 30, 90].map(h => (
            <button key={h}
              onClick={() => { setHorizon(h); if (symbol) fetchPrediction(symbol, h); }}
              className="px-3 h-7 rounded-md text-xs font-medium transition-colors"
              style={{ background: horizon === h ? C.gold : 'transparent', color: horizon === h ? C.ink : C.textDim }}>
              {horizonLabels[h]}
            </button>
          ))}
        </div>
        {prediction && (
          <button onClick={() => fetchPrediction(symbol || prediction.symbol, horizon, true)}
            disabled={loading}
            className="btn-ghost px-3 h-9 rounded-lg text-xs flex items-center gap-1.5">
            <RefreshCw size={12} className={loading ? 'spin' : ''} />Refresh
          </button>
        )}
      </div>

      {/* Quick picks from portfolio */}
      {!prediction && !loading && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs" style={{ color: C.textDim }}>Quick predict:</span>
          {portfolio?.positions?.slice(0, 6).map(p => (
            <button key={p.symbol}
              onClick={() => { setSymbol(p.symbol); fetchPrediction(p.symbol, horizon); }}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{ borderColor: C.border, color: C.textDim }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              {p.symbol}
            </button>
          ))}
        </div>
      )}

      {warmingUp && (
        <div className="p-4 rounded-lg border flex items-center gap-3" style={{ background: 'rgba(212,169,69,0.08)', borderColor: C.gold }}>
          <RefreshCw size={16} className="spin shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="text-sm font-medium" style={{ color: C.gold }}>Server waking up (free tier)</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>Render free tier sleeps after inactivity. Auto-retrying — this takes up to 60 seconds on first load.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border" style={{ background: 'rgba(201,112,73,0.1)', borderColor: C.neg }}>
          <p className="text-sm" style={{ color: C.neg }}>{error}</p>
          <button onClick={() => symbol && fetchPrediction(symbol, horizon)} className="text-xs mt-2 underline" style={{ color: C.gold }}>Try again</button>
        </div>
      )}

      {loading && !warmingUp && (
        <div className="space-y-4">
          <div className="h-48 rounded-xl skeleton" />
          <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl skeleton" />)}</div>
        </div>
      )}

      {prediction && (
        <div className="space-y-4">
          {/* Hero card */}
          <div className="rounded-xl border p-5" style={{ background: C.surface2, borderColor: C.border }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-mono font-bold" style={{ color: C.text }}>{prediction.symbol}</span>
                  <span className="text-sm px-2 py-0.5 rounded" style={{ background: C.surface3, color: C.textDim }}>
                    {prediction.horizon}d Forecast
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-serif font-bold" style={{ color: (prediction.expected_return_pct ?? 0) >= 0 ? C.pos : C.neg }}>
                    {(prediction.expected_return_pct ?? 0) >= 0 ? '+' : ''}{prediction.expected_return_pct?.toFixed(2)}%
                  </span>
                  <span className="text-lg" style={{ color: C.text }}>${prediction.target_price?.toFixed(2)}</span>
                </div>
                <p className="text-sm mt-0.5" style={{ color: C.textDim }}>from ${prediction.current_price?.toFixed(2)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs mb-1" style={{ color: C.textDim }}>90% CI</p>
                <p className="font-mono font-semibold" style={{ color: C.text }}>${prediction.confidence_low?.toFixed(2)}</p>
                <p className="text-xs" style={{ color: C.textDim }}>to</p>
                <p className="font-mono font-semibold" style={{ color: C.text }}>${prediction.confidence_high?.toFixed(2)}</p>
              </div>
            </div>

            {/* Price bar viz */}
            {(() => {
              const lo = prediction.confidence_low, hi = prediction.confidence_high, base = prediction.current_price, pred = prediction.target_price;
              const range = (hi - lo) || 1;
              const pos = (v) => `${((v - lo) / range * 100).toFixed(1)}%`;
              const isUp = (prediction.expected_return_pct ?? 0) >= 0;
              return (
                <div className="mt-4 relative h-6">
                  <div className="absolute inset-y-0 left-0 right-0 rounded-full" style={{ background: C.surface3 }} />
                  <div className="absolute inset-y-0 rounded-full" style={{ left: pos(lo), right: `${(100 - ((hi - lo) / range * 100)).toFixed(1)}%`, background: isUp ? C.pos + '30' : C.neg + '30' }} />
                  <div className="absolute top-0 bottom-0 w-0.5" style={{ left: pos(base), background: C.textDim }} />
                  <div className="absolute top-0 bottom-0 w-1 rounded-full" style={{ left: `calc(${pos(pred)} - 2px)`, background: isUp ? C.pos : C.neg }} />
                </div>
              );
            })()}
          </div>

          {/* Upside probabilities */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'P(Up > 5%)', val: prediction.prob_up_5pct },
              { label: 'P(Up > 10%)', val: prediction.prob_up_10pct },
              { label: 'P(Up > 15%)', val: prediction.prob_up_15pct },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-xl border p-4 text-center" style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-xs mb-2" style={{ color: C.textDim }}>{label}</p>
                <p className="text-2xl font-serif font-bold" style={{ color: probColors(val / 100) }}>
                  {(val ?? 0).toFixed(0)}%
                </p>
                <div className="mt-2 h-1 rounded-full" style={{ background: C.surface3 }}>
                  <div className="h-full rounded-full" style={{ width: `${val ?? 0}%`, background: probColors(val / 100) }} />
                </div>
              </div>
            ))}
          </div>

          {/* Scenario table */}
          <div className="rounded-xl border" style={{ background: C.surface, borderColor: C.border }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
              <p className="text-sm font-semibold" style={{ color: C.text }}>Scenario Analysis</p>
            </div>
            <div className="divide-y" style={{ borderColor: C.border }}>
              {prediction.scenarios?.map(s => (
                <div key={s.label} className="px-4 py-3 flex items-center gap-4">
                  <span className="w-12 text-xs font-medium" style={{ color: s.label === 'Bull' ? C.pos : s.label === 'Bear' ? C.neg : C.gold }}>{s.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: C.surface3 }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${s.probability ?? 0}%`, background: s.label === 'Bull' ? C.pos : s.label === 'Bear' ? C.neg : C.gold }} />
                  </div>
                  <span className="w-10 text-xs text-right" style={{ color: C.textDim }}>{(s.probability ?? 0).toFixed(0)}%</span>
                  <span className="w-20 font-mono text-sm text-right font-semibold" style={{ color: (s.return_pct ?? 0) >= 0 ? C.pos : C.neg }}>
                    {(s.return_pct ?? 0) >= 0 ? '+' : ''}{s.return_pct?.toFixed(2)}%
                  </span>
                  <span className="w-20 font-mono text-sm text-right" style={{ color: C.text }}>${s.price?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Model meta */}
          {prediction.model_meta && (
            <div className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-medium mb-2" style={{ color: C.textDim }}>Model Information</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Version', val: prediction.model_meta.version || '—' },
                  { label: 'Dir. Accuracy', val: `${(prediction.model_meta.directional_accuracy || 0).toFixed(1)}%` },
                  { label: 'Method', val: prediction.model_meta.method || 'statistical' },
                  { label: 'Ann. Vol', val: `${(prediction.ann_vol_pct || 0).toFixed(1)}%` },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-[10px] mb-0.5" style={{ color: C.textFaint }}>{label}</p>
                    <p className="text-sm font-mono" style={{ color: C.text }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg p-3 border-l-2" style={{ borderColor: C.gold, background: C.surface2 }}>
            <p className="text-xs leading-relaxed" style={{ color: C.textDim }}>
              {prediction.model_meta?.note || 'Statistical model using historical price dynamics. Not financial advice.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   STOCK SEARCH VIEW
   ============================================================ */
const StockSearchView = ({ onAddToWatchlist, onAddToPortfolio, watchlist }) => {
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [fundamentals, setFundamentals] = useState(null);
  const [technicals, setTechnicals] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState(null);

  const loadStock = useCallback(async (item) => {
    setSelected(item); setActiveTab('overview');
    setQuote(null); setHistory([]); setFundamentals(null); setTechnicals(null);
    setError(null); setWarmingUp(false);
    setLoadingQuote(true);
    try {
      const [q, h, f, ta] = await Promise.all([
        apiFetch(`/api/quotes?symbols=${item.symbol}`, {}, { onWarmup: () => setWarmingUp(true) }),
        apiFetch(`/api/history/${item.symbol}?period=3mo`, {}, { onWarmup: () => {} }).catch(() => ({ bars: [] })),
        apiFetch(`/api/fundamentals/${item.symbol}`, {}, { onWarmup: () => {} }).catch(() => null),
        apiFetch(`/api/technicals/${item.symbol}?period=6mo`, {}, { onWarmup: () => {} }).catch(() => null),
      ]);
      setQuote(Array.isArray(q) ? q.find(x => x.symbol === item.symbol) ?? q[0] ?? null : q);
      setHistory(h?.bars || []);
      setFundamentals(f);
      setTechnicals(ta);
    } catch (e) {
      setError(e.isWarmup ? 'Server waking up — please try again in a moment.' : e.message);
    } finally { setLoadingQuote(false); setWarmingUp(false); }
  }, []);

  const inWatchlist = watchlist.includes(selected?.symbol);

  const chartMin = history.length ? Math.min(...history.map(d => d.close ?? d.c ?? 0)) * 0.995 : 0;
  const chartMax = history.length ? Math.max(...history.map(d => d.close ?? d.c ?? 0)) * 1.005 : 0;
  const chartData = history.map(d => ({ date: d.date || d.t, price: d.close ?? d.c }));
  const priceChange = quote ? (quote.change ?? 0) : 0;
  const changePct = quote ? (quote.change_pct ?? 0) : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Search size={20} style={{ color: C.gold }} />
        <div>
          <h2 className="text-xl font-semibold font-serif" style={{ color: C.text }}>Stock Search</h2>
          <p className="text-xs" style={{ color: C.textDim }}>Search any symbol or company name — add to watchlist or portfolio</p>
        </div>
      </div>

      <SearchBar onSelect={loadStock} />

      {/* Sector quick-browse */}
      {!selected && (
        <div className="space-y-4">
          <p className="text-sm font-medium" style={{ color: C.textDim }}>Browse by sector</p>
          {[
            { sector: 'Technology',    symbols: ['AAPL','MSFT','NVDA','GOOGL','META','AMD','ORCL'] },
            { sector: 'Semiconductors',symbols: ['TSM','AVGO','QCOM','INTC','LRCX','AMAT','TXN'] },
            { sector: 'Consumer',      symbols: ['AMZN','COST','WMT','TGT','KO','PEP','BABA'] },
            { sector: 'Healthcare',    symbols: ['JNJ','UNH','PFE','ABBV','MRK','TMO'] },
            { sector: 'Financials',    symbols: ['JPM','BAC','V','MA','GS','MS','BRK-B'] },
            { sector: 'Energy',        symbols: ['XOM','CVX','CL','OXY','SLB'] },
            { sector: 'Industrials',   symbols: ['CAT','HON','BA','GE','MMM','UPS'] },
            { sector: 'Utilities/REIT',symbols: ['NEE','AMT','PLD','DUK','SO'] },
            { sector: 'Crypto ETFs',   symbols: ['COIN','MSTR','IBIT','ARKK','SOUN'] },
          ].map(({ sector, symbols }) => (
            <div key={sector}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.textFaint }}>{sector}</p>
              <div className="flex flex-wrap gap-2">
                {symbols.map(sym => (
                  <button key={sym} onClick={() => loadStock({ symbol: sym, name: sym, exchange: '', sector })}
                    className="text-xs px-3 py-1.5 rounded-full border transition-colors font-mono"
                    style={{ borderColor: C.border, color: C.textDim }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}>
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected stock detail */}
      {selected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-2xl font-bold" style={{ color: C.gold }}>{selected.symbol}</span>
              <span className="ml-3 text-sm" style={{ color: C.textDim }}>{selected.name}</span>
            </div>
            <button onClick={() => { setSelected(null); setQuote(null); setHistory([]); }}
              className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: C.border, color: C.textDim }}>
              ← Back
            </button>
          </div>

          {warmingUp && (
            <div className="p-3 rounded-lg border flex items-center gap-3" style={{ background: 'rgba(212,169,69,0.08)', borderColor: C.gold }}>
              <RefreshCw size={14} className="spin shrink-0" style={{ color: C.gold }} />
              <p className="text-sm" style={{ color: C.gold }}>Server waking up — auto-retrying…</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border" style={{ background: 'rgba(201,112,73,0.1)', borderColor: C.neg }}>
              <p className="text-sm" style={{ color: C.neg }}>{error}</p>
              <button onClick={() => loadStock(selected)} className="text-xs mt-1 underline" style={{ color: C.gold }}>Retry</button>
            </div>
          )}

          {loadingQuote && !warmingUp && (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl skeleton" />)}
            </div>
          )}

          {quote && (
            <>
              {/* Price hero */}
              <div className="rounded-xl border p-5 flex items-start justify-between"
                style={{ background: C.surface2, borderColor: C.border }}>
                <div>
                  <p className="text-xs mb-1" style={{ color: C.textDim }}>{fundamentals?.name || selected.name || selected.symbol}</p>
                  <div className="text-3xl font-mono font-bold" style={{ color: C.text }}>{fmt.dollar(quote.price)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {isUp ? <TrendingUp size={14} style={{ color: C.pos }} /> : <TrendingDown size={14} style={{ color: C.neg }} />}
                    <span className="text-sm font-medium" style={{ color: isUp ? C.pos : C.neg }}>
                      {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% ({fmt.dollar(Math.abs(priceChange))})
                    </span>
                    <span className="text-xs" style={{ color: C.textFaint }}>today</span>
                    {technicals?.outlook && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
                        style={{ background: technicals.outlook === 'bullish' ? C.pos + '20' : technicals.outlook === 'bearish' ? C.neg + '20' : C.gold + '20',
                                 color: technicals.outlook === 'bullish' ? C.pos : technicals.outlook === 'bearish' ? C.neg : C.gold }}>
                        {technicals.tech_score}/100 {technicals.outlook?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => onAddToWatchlist(selected.symbol)} disabled={inWatchlist}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                    style={{ borderColor: inWatchlist ? C.textFaint : C.gold, color: inWatchlist ? C.textFaint : C.gold }}>
                    {inWatchlist ? '✓ Watchlist' : '+ Watchlist'}
                  </button>
                  <button onClick={() => onAddToPortfolio(selected.symbol)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: C.gold, color: C.ink }}>+ Portfolio</button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.surface2 }}>
                {[['overview','Overview'],['fundamentals','Fundamentals'],['technicals','Technical Analysis']].map(([id,label]) => (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: activeTab === id ? C.gold : 'transparent',
                             color: activeTab === id ? C.ink : C.textDim }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ['Mkt Cap',   fmt.big$(quote.market_cap)],
                      ['52W High',  fmt.dollar(quote.fifty_two_week_high)],
                      ['52W Low',   fmt.dollar(quote.fifty_two_week_low)],
                      ['Volume',    fmt.big$(quote.volume)?.replace('$','')],
                      ['P/E (TTM)', fundamentals?.pe_ratio ? fundamentals.pe_ratio.toFixed(1) : '—'],
                      ['EPS (TTM)', fundamentals?.eps_ttm ? fmt.dollar(fundamentals.eps_ttm) : '—'],
                      ['Sector',    fundamentals?.sector || selected.sector || '—'],
                      ['Beta',      fundamentals?.beta?.toFixed(2) || '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-lg border p-3" style={{ background: C.surface2, borderColor: C.border }}>
                        <div className="text-xs mb-1" style={{ color: C.textDim }}>{l}</div>
                        <div className="font-mono text-sm font-semibold" style={{ color: C.text }}>{v ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                  {chartData.length > 0 && (
                    <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
                      <p className="text-xs font-medium mb-3" style={{ color: C.textDim }}>3-Month Price</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="ssvGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isUp ? C.pos : C.neg} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={isUp ? C.pos : C.neg} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide />
                          <YAxis domain={[chartMin, chartMax]} hide />
                          <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}
                            labelStyle={{ color: C.textDim, fontSize: 11 }} formatter={v => [fmt.dollar(v), 'Price']} />
                          <Area type="monotone" dataKey="price" stroke={isUp ? C.pos : C.neg}
                            strokeWidth={2} fill="url(#ssvGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {fundamentals?.description && (
                    <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: C.text }}>About</p>
                      <p className="text-xs leading-relaxed" style={{ color: C.textDim }}>{fundamentals.description}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    {[['Trading Tips →','tips'],['ML Forecast →','predict']].map(([label, v]) => (
                      <button key={v} onClick={() => window.__finsightSetView?.(v, selected.symbol)}
                        className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors"
                        style={{ borderColor: C.border, color: C.textDim }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fundamentals tab */}
              {activeTab === 'fundamentals' && (
                <div className="space-y-4">
                  {!fundamentals ? (
                    <div className="p-4 text-center text-sm" style={{ color: C.textDim }}>Fundamental data unavailable</div>
                  ) : (
                    <>
                      {[
                        { title: 'Valuation', items: [
                          ['P/E (TTM)',      fundamentals.pe_ratio?.toFixed(1)],
                          ['Forward P/E',   fundamentals.forward_pe?.toFixed(1)],
                          ['PEG Ratio',     fundamentals.peg_ratio?.toFixed(2)],
                          ['P/S Ratio',     fundamentals.price_to_sales?.toFixed(2)],
                          ['P/B Ratio',     fundamentals.price_to_book?.toFixed(2)],
                          ['EV/EBITDA',     fundamentals.ev_to_ebitda?.toFixed(1)],
                        ]},
                        { title: 'Profitability', items: [
                          ['Gross Margin',  fundamentals.gross_margins != null ? `${fundamentals.gross_margins.toFixed(1)}%` : null],
                          ['Op Margin',     fundamentals.operating_margins != null ? `${fundamentals.operating_margins.toFixed(1)}%` : null],
                          ['Net Margin',    fundamentals.profit_margins != null ? `${fundamentals.profit_margins.toFixed(1)}%` : null],
                          ['ROE',           fundamentals.roe != null ? `${fundamentals.roe.toFixed(1)}%` : null],
                          ['ROA',           fundamentals.roa != null ? `${fundamentals.roa.toFixed(1)}%` : null],
                          ['Free Cash Flow',fmt.big$(fundamentals.free_cash_flow)],
                        ]},
                        { title: 'Growth', items: [
                          ['Revenue (TTM)',      fmt.big$(fundamentals.revenue_ttm)],
                          ['Revenue Growth YoY',fundamentals.revenue_growth_yoy != null ? `${fundamentals.revenue_growth_yoy > 0 ? '+' : ''}${fundamentals.revenue_growth_yoy.toFixed(1)}%` : null],
                          ['Earnings Growth',   fundamentals.earnings_growth_yoy != null ? `${fundamentals.earnings_growth_yoy > 0 ? '+' : ''}${fundamentals.earnings_growth_yoy.toFixed(1)}%` : null],
                          ['EPS (TTM)',          fmt.dollar(fundamentals.eps_ttm)],
                          ['EPS (Fwd)',          fmt.dollar(fundamentals.eps_forward)],
                          ['Dividend Yield',    fundamentals.dividend_yield ? `${fundamentals.dividend_yield.toFixed(2)}%` : 'None'],
                        ]},
                        { title: 'Balance Sheet & Risk', items: [
                          ['Debt/Equity',  fundamentals.debt_to_equity?.toFixed(2)],
                          ['Current Ratio',fundamentals.current_ratio?.toFixed(2)],
                          ['Beta',         fundamentals.beta?.toFixed(2)],
                          ['Short Ratio',  fundamentals.short_ratio?.toFixed(1)],
                          ['Mkt Cap',      fmt.big$(fundamentals.market_cap)],
                          ['Avg Volume',   fmt.big$(fundamentals.avg_volume)?.replace('$','')],
                        ]},
                      ].map(({ title, items }) => (
                        <div key={title} className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
                          <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>{title}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {items.map(([l, v]) => (
                              <div key={l}>
                                <p className="text-[10px] mb-0.5" style={{ color: C.textFaint }}>{l}</p>
                                <p className="font-mono text-xs font-semibold" style={{ color: v && v !== '0.00' && v !== '$0.00' ? C.text : C.textFaint }}>{v || '—'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Analyst consensus */}
                      {fundamentals.num_analysts > 0 && (
                        <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
                          <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Analyst Consensus ({fundamentals.num_analysts} analysts)</p>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-xs mb-1" style={{ color: C.textDim }}>Rating</p>
                              <p className="font-bold text-sm capitalize" style={{ color: fundamentals.recommendation?.includes('buy') ? C.pos : fundamentals.recommendation?.includes('sell') ? C.neg : C.gold }}>
                                {fundamentals.recommendation?.replace('_',' ') || '—'}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs mb-1" style={{ color: C.textDim }}>Low Target</p>
                              <p className="font-mono font-semibold text-sm" style={{ color: C.text }}>{fmt.dollar(fundamentals.analyst_low)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs mb-1" style={{ color: C.textDim }}>Mean Target</p>
                              <p className="font-mono font-bold text-lg" style={{ color: C.gold }}>{fmt.dollar(fundamentals.analyst_target)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs mb-1" style={{ color: C.textDim }}>High Target</p>
                              <p className="font-mono font-semibold text-sm" style={{ color: C.text }}>{fmt.dollar(fundamentals.analyst_high)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs mb-1" style={{ color: C.textDim }}>Upside</p>
                              <p className="font-bold text-sm" style={{ color: (fundamentals.analyst_target - quote.price) > 0 ? C.pos : C.neg }}>
                                {fundamentals.analyst_target && quote.price ? `${(((fundamentals.analyst_target / quote.price) - 1) * 100).toFixed(1)}%` : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Technicals tab */}
              {activeTab === 'technicals' && (
                <div className="space-y-4">
                  {!technicals ? (
                    <div className="p-4 text-center text-sm" style={{ color: C.textDim }}>Technical data unavailable</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Overall Score', val: `${technicals.tech_score}/100`, color: technicals.tech_score >= 60 ? C.pos : technicals.tech_score < 40 ? C.neg : C.gold },
                          { label: 'Outlook',       val: technicals.outlook?.toUpperCase(), color: technicals.outlook === 'bullish' ? C.pos : technicals.outlook === 'bearish' ? C.neg : C.gold },
                          { label: 'EMA Cross',     val: technicals.moving_averages?.cross?.replace(/_/g,' '), color: technicals.moving_averages?.cross?.includes('golden') ? C.pos : technicals.moving_averages?.cross?.includes('death') ? C.neg : C.text },
                          { label: 'RSI(14)',       val: technicals.momentum?.rsi14?.toFixed(1), color: technicals.momentum?.rsi14 > 70 ? C.neg : technicals.momentum?.rsi14 < 30 ? C.pos : C.text },
                          { label: 'Stoch %K',      val: technicals.momentum?.stoch_k?.toFixed(0), color: technicals.momentum?.stoch_k > 80 ? C.neg : technicals.momentum?.stoch_k < 20 ? C.pos : C.text },
                          { label: 'MACD',          val: technicals.momentum?.macd_hist?.toFixed(3), color: technicals.momentum?.macd_hist > 0 ? C.pos : C.neg },
                          { label: 'BB %B',         val: technicals.volatility?.bb_pct_b?.toFixed(2), color: C.text },
                          { label: 'OBV Trend',     val: technicals.volume?.obv_trend?.toUpperCase(), color: technicals.volume?.obv_trend === 'rising' ? C.pos : C.neg },
                          { label: 'RSI Divergence',val: technicals.momentum?.rsi_divergence?.toUpperCase(), color: technicals.momentum?.rsi_divergence === 'bullish' ? C.pos : technicals.momentum?.rsi_divergence === 'bearish' ? C.neg : C.textFaint },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="rounded-lg border p-3" style={{ background: C.surface2, borderColor: C.border }}>
                            <p className="text-[10px] mb-1" style={{ color: C.textFaint }}>{label}</p>
                            <p className="font-mono text-sm font-bold" style={{ color }}>{val || '—'}</p>
                          </div>
                        ))}
                      </div>
                      {/* Levels */}
                      <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
                        <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Support & Resistance</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            ['Support 20d',    fmt.dollar(technicals.levels?.support_20d)],
                            ['Resistance 20d', fmt.dollar(technicals.levels?.resistance_20d)],
                            ['Support 60d',    fmt.dollar(technicals.levels?.support_60d)],
                            ['Resistance 60d', fmt.dollar(technicals.levels?.resistance_60d)],
                          ].map(([l, v]) => (
                            <div key={l}>
                              <p className="text-[10px] mb-0.5" style={{ color: C.textFaint }}>{l}</p>
                              <p className="font-mono text-sm font-semibold" style={{ color: C.text }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Fibonacci */}
                      {technicals.levels?.fibonacci && (
                        <div className="rounded-xl border p-4" style={{ background: C.surface2, borderColor: C.border }}>
                          <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Fibonacci Retracement (52-week)</p>
                          <p className="text-xs mb-2" style={{ color: C.textDim }}>Nearest: <span style={{ color: C.gold }}>{technicals.levels.nearest_fib?.level}% — {fmt.dollar(technicals.levels.nearest_fib?.price)}</span></p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(technicals.levels.fibonacci).map(([pct, price]) => {
                              const isNear = Math.abs(price - technicals.price) / technicals.price < 0.02;
                              return (
                                <div key={pct} className="rounded px-2.5 py-1.5 text-center"
                                  style={{ background: isNear ? C.gold + '20' : C.surface, border: `1px solid ${isNear ? C.gold : C.border}` }}>
                                  <div className="text-[9px]" style={{ color: isNear ? C.gold : C.textFaint }}>{pct}%</div>
                                  <div className="font-mono text-[10px] font-bold" style={{ color: isNear ? C.gold : C.textDim }}>{fmt.dollar(price)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   AI BRAIN VIEWS — Autonomous Investment Intelligence
   ============================================================ */

// ── AI Brain Report View ──────────────────────────────────────────────────────
const AIBrainView = ({ portfolio }) => {
  const [sym, setSym] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [report, setReport] = useState(null);
  const [forecasts, setForecasts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [brainStatus, setBrainStatus] = useState(null);

  useEffect(() => {
    apiFetch('/api/brain/status').then(setBrainStatus).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.symbol) { setInputVal(e.detail.symbol); fetchReport(e.detail.symbol); }
    };
    window.addEventListener('finsight:prefill', handler);
    return () => window.removeEventListener('finsight:prefill', handler);
  }, []);

  const fetchReport = async (symbol) => {
    const s = (symbol || inputVal).trim().toUpperCase();
    if (!s) return;
    setSym(s); setLoading(true); setError(null); setReport(null); setForecasts(null);
    try {
      const rep = await apiFetch(
        `/api/brain/report/${s}?include_macro=true&use_cache=false`,
        {},
        { onWarmup: () => setError('warming_up') }
      );
      setReport(rep);
      setError(null);
      // Fetch forecasts separately so they don't block the report
      apiFetch(`/api/brain/forecast-all/${s}`, {}, { onWarmup: () => {} })
        .then(fc => setForecasts(fc))
        .catch(() => {});
    } catch (e) {
      if (e.message !== 'warming_up') setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const thesisColor = (t) => t === 'bullish' ? C.pos : t === 'bearish' ? C.neg : C.gold;
  const thesisIcon = (t) => t === 'bullish' ? '▲' : t === 'bearish' ? '▼' : '◆';
  const convColor = (c) => c === 'high' ? C.pos : c === 'medium' ? C.gold : C.textDim;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl" style={{ color: C.text }}>AI Brain</h1>
          <p className="text-sm mt-1" style={{ color: C.textDim }}>
            Institutional-grade analysis powered by {brainStatus?.claude_available ? 'Claude AI' : 'quantitative models'}
          </p>
        </div>
        {brainStatus && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold"
            style={{
              borderColor: brainStatus.claude_available ? C.pos : C.gold,
              color: brainStatus.claude_available ? C.pos : C.gold,
              background: brainStatus.claude_available ? C.pos + '10' : C.gold + '10',
            }}>
            <div className="w-1.5 h-1.5 rounded-full pulse-dot"
              style={{ background: brainStatus.claude_available ? C.pos : C.gold }} />
            {brainStatus.claude_available ? 'Claude AI Active' : 'Statistical Mode'}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="rounded-2xl border p-6" style={{ background: C.surface, borderColor: C.border }}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textFaint }} />
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && fetchReport()}
              placeholder="Enter ticker symbol (e.g. AAPL, NVDA, MSFT)"
              className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm font-mono"
              style={{ background: C.surface2, borderColor: C.border, color: C.text, outline: 'none' }}
            />
          </div>
          <button onClick={() => fetchReport()}
            disabled={loading || !inputVal.trim()}
            className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all"
            style={{ background: C.gold, color: C.ink, opacity: loading || !inputVal.trim() ? 0.5 : 1 }}>
            {loading ? <RefreshCw size={15} className="spin" /> : <Brain size={15} />}
            {loading ? 'Analyzing…' : 'Generate Report'}
          </button>
        </div>

        {/* Quick picks from portfolio */}
        {portfolio?.positions?.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-xs" style={{ color: C.textFaint }}>Your holdings:</span>
            {portfolio.positions.slice(0, 8).map(p => (
              <button key={p.symbol} onClick={() => { setInputVal(p.symbol); fetchReport(p.symbol); }}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all hover:opacity-80"
                style={{ background: C.surface2, color: C.gold, border: `1px solid ${C.border}` }}>
                {p.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Warming up state */}
      {error === 'warming_up' && (
        <div className="rounded-2xl border p-6 flex items-center gap-4"
          style={{ background: C.surface, borderColor: C.gold + '40' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: C.gold + '15' }}>
            <RefreshCw size={18} className="spin" style={{ color: C.gold }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: C.gold }}>Backend warming up…</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>First request wakes the server. Retrying automatically.</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && error !== 'warming_up' && (
        <div className="rounded-2xl border p-5 flex items-center gap-3"
          style={{ background: C.surface, borderColor: C.neg + '40' }}>
          <AlertCircle size={18} style={{ color: C.neg }} />
          <p className="text-sm" style={{ color: C.neg }}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !report && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl border p-6 space-y-3"
              style={{ background: C.surface, borderColor: C.border }}>
              <div className="h-4 rounded-lg w-1/3" style={{ background: C.surface2 }} />
              <div className="h-3 rounded-lg w-full" style={{ background: C.surface2 }} />
              <div className="h-3 rounded-lg w-2/3" style={{ background: C.surface2 }} />
            </div>
          ))}
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-5 fade-in">
          {/* Executive Header */}
          <div className="rounded-2xl border p-6"
            style={{ background: C.surface, borderColor: thesisColor(report.thesis) + '40' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-serif text-2xl" style={{ color: C.text }}>{report.symbol}</h2>
                  {report.name && report.name !== report.symbol && (
                    <span className="text-sm" style={{ color: C.textDim }}>{report.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    style={{ background: thesisColor(report.thesis) + '15', color: thesisColor(report.thesis) }}>
                    {thesisIcon(report.thesis)} {report.thesis}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: convColor(report.conviction) + '15', color: convColor(report.conviction) }}>
                    {report.conviction} conviction
                  </span>
                  {report.claude_powered && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: '#7c3aed20', color: '#a78bfa' }}>
                      ✦ Claude AI
                    </span>
                  )}
                  <span className="text-xs" style={{ color: C.textFaint }}>
                    Score: <span className="font-mono font-bold" style={{ color: C.gold }}>{report.composite_score}/100</span>
                  </span>
                </div>
              </div>
              {report.technicals?.price && (
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold" style={{ color: C.text }}>
                    {fmt.dollar(report.technicals.price, 2)}
                  </div>
                  {report.technicals?.ret_1m !== undefined && (
                    <div className="text-sm font-mono"
                      style={{ color: report.technicals.ret_1m >= 0 ? C.pos : C.neg }}>
                      {report.technicals.ret_1m >= 0 ? '+' : ''}{report.technicals.ret_1m?.toFixed(1)}% (1M)
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm leading-relaxed" style={{ color: C.textDim }}>
              {report.executive_summary}
            </p>

            {report.recommended_action && (
              <div className="mt-4 p-3 rounded-xl"
                style={{ background: thesisColor(report.thesis) + '08', border: `1px solid ${thesisColor(report.thesis)}25` }}>
                <p className="text-xs font-semibold mb-0.5 uppercase tracking-wider"
                  style={{ color: thesisColor(report.thesis) }}>Recommended Action</p>
                <p className="text-sm" style={{ color: C.text }}>{report.recommended_action}</p>
              </div>
            )}
          </div>

          {/* Price Targets + Scores Row */}
          <div className="grid grid-cols-2 gap-5">
            {report.price_targets && (
              <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>Price Targets</p>
                {[
                  ['Bull Case', report.price_targets.bull, C.pos],
                  ['Base Case', report.price_targets.base, C.gold],
                  ['Bear Case', report.price_targets.bear, C.neg],
                ].map(([label, target, color]) => {
                  const ret = report.technicals?.price && target
                    ? ((target / report.technicals.price - 1) * 100).toFixed(1) : null;
                  return (
                    <div key={label} className="flex items-center justify-between py-2 border-b last:border-0"
                      style={{ borderColor: C.border }}>
                      <span className="text-xs" style={{ color: C.textDim }}>{label}</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm" style={{ color }}>{fmt.dollar(target, 2)}</span>
                        {ret !== null && (
                          <span className="ml-2 text-xs font-mono" style={{ color: parseFloat(ret) >= 0 ? C.pos : C.neg }}>
                            {parseFloat(ret) >= 0 ? '+' : ''}{ret}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {report.price_targets.analyst && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs" style={{ color: C.textFaint }}>Analyst Consensus</span>
                    <span className="font-mono text-sm font-bold" style={{ color: C.info }}>
                      {fmt.dollar(report.price_targets.analyst, 2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Intelligence Scores */}
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>Intelligence Scores</p>
              {[
                ['Technical', report.tech_score, C.gold],
                ['Sentiment', report.sentiment_score, C.info],
                ['Macro', report.macro_score, '#a78bfa'],
                ['Composite', report.composite_score, C.pos],
              ].map(([label, score, color]) => score !== undefined && (
                <div key={label} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: C.textDim }}>{label}</span>
                    <span className="font-mono font-bold" style={{ color }}>{Math.round(score)}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round(score)}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catalysts & Risks */}
          <div className="grid grid-cols-2 gap-5">
            {[
              ['Key Catalysts', report.key_catalysts, C.pos, CheckCircle2],
              ['Key Risks', report.key_risks, C.neg, AlertTriangle],
            ].map(([title, items, color, Icon]) => (
              <div key={title} className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: C.textFaint }}>{title}</p>
                <ul className="space-y-2.5">
                  {(items || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Icon size={13} className="mt-0.5 shrink-0" style={{ color }} />
                      <span className="text-sm leading-relaxed" style={{ color: C.textDim }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Context signals row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              ['Macro Context', report.macro_impact],
              ['Sentiment Signal', report.sentiment_read],
              ['Technical Read', report.technical_read],
            ].filter(([,v]) => v).map(([title, text]) => (
              <div key={title} className="rounded-xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.textFaint }}>{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: C.textDim }}>{text}</p>
              </div>
            ))}
          </div>

          {/* ML Forecasts */}
          {forecasts && (
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>ML Price Forecasts (XGBoost)</p>
              <div className="grid grid-cols-3 gap-4">
                {[['7d', '7 Day'], ['30d', '30 Day'], ['90d', '90 Day']].map(([key, label]) => {
                  const fc = forecasts.horizons?.[key];
                  if (!fc?.available) return null;
                  const ret = fc.forecast_return_pct;
                  const color = ret >= 0 ? C.pos : C.neg;
                  return (
                    <div key={key} className="rounded-xl p-4 text-center"
                      style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                      <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.textFaint }}>{label} Forecast</p>
                      <p className="font-mono text-xl font-bold" style={{ color }}>{ret >= 0 ? '+' : ''}{ret?.toFixed(1)}%</p>
                      <p className="font-mono text-sm mt-1" style={{ color: C.text }}>{fmt.dollar(fc.forecast_price, 2)}</p>
                      <p className="text-[10px] mt-2" style={{ color: C.textFaint }}>
                        CI: {fmt.dollar(fc.confidence_low, 2)} – {fmt.dollar(fc.confidence_high, 2)}
                      </p>
                      <p className="text-[10px]" style={{ color: C.textFaint }}>
                        Dir. Accuracy: {Math.round(fc.directional_accuracy * 100)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          {report.disclaimer && (
            <p className="text-[10px] px-1" style={{ color: C.textFaint }}>⚠ {report.disclaimer}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Macro Radar View ─────────────────────────────────────────────────────────
const MacroRadarView = () => {
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMacro = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/api/brain/macro', {}, {
        onWarmup: () => setError('warming_up'),
      });
      setMacro(data);
      setError(null);
    } catch (e) {
      if (e.message !== 'warming_up') setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMacro(); }, []);

  const regimeColor = (r) => r === 'easy' ? C.pos : r === 'restrictive' ? C.neg : C.gold;
  const regimeLabel = (r) => r === 'easy' ? 'Accommodative — Risk-On' : r === 'restrictive' ? 'Restrictive — Defensive' : 'Neutral';

  const indicators = macro ? [
    { label: '10Y Treasury',  value: macro.rate_10y != null ? `${macro.rate_10y?.toFixed(2)}%` : 'N/A',
      note: macro.rate_10y > 4.5 ? 'Elevated — headwind' : macro.rate_10y < 3 ? 'Low — tailwind' : 'Moderate',
      color: macro.rate_10y > 4.5 ? C.neg : macro.rate_10y < 3 ? C.pos : C.gold },
    { label: '2Y Treasury',   value: macro.rate_2y != null ? `${macro.rate_2y?.toFixed(2)}%` : 'N/A',
      note: 'Short-end rate', color: C.textDim },
    { label: 'Yield Curve',   value: macro.yield_curve != null ? `${macro.yield_curve > 0 ? '+' : ''}${macro.yield_curve?.toFixed(2)}%` : 'N/A',
      note: macro.yield_curve < -0.3 ? 'Inverted — recession risk' : macro.yield_curve > 0.5 ? 'Normal — expansion' : 'Flat',
      color: macro.yield_curve < -0.3 ? C.neg : macro.yield_curve > 0.5 ? C.pos : C.gold },
    { label: 'Fed Funds Rate', value: macro.fed_funds != null ? `${macro.fed_funds?.toFixed(2)}%` : 'N/A',
      note: macro.fed_funds > 4.5 ? 'Restrictive policy' : macro.fed_funds < 2 ? 'Accommodative' : 'Neutral',
      color: macro.fed_funds > 4.5 ? C.neg : macro.fed_funds < 2 ? C.pos : C.gold },
    { label: 'Unemployment',   value: macro.unemployment != null ? `${macro.unemployment?.toFixed(1)}%` : 'N/A',
      note: macro.unemployment < 4.5 ? 'Strong labor market' : 'Weakening labor',
      color: macro.unemployment < 4.5 ? C.pos : C.neg },
    { label: 'HY Credit Spread', value: macro.hy_spread != null ? `${macro.hy_spread?.toFixed(2)}%` : 'N/A',
      note: macro.hy_spread > 6 ? 'Wide spreads — risk-off' : macro.hy_spread < 3.5 ? 'Tight — risk-on' : 'Normal range',
      color: macro.hy_spread > 6 ? C.neg : macro.hy_spread < 3.5 ? C.pos : C.gold },
  ] : [];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl" style={{ color: C.text }}>Macro Radar</h1>
          <p className="text-sm mt-1" style={{ color: C.textDim }}>Federal Reserve Economic Data — real-time macro environment</p>
        </div>
        <button onClick={fetchMacro} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all"
          style={{ borderColor: C.border, color: C.textDim, background: C.surface }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {macro && (
        <div className="rounded-2xl border p-5"
          style={{ background: regimeColor(macro.macro_regime) + '08',
                   borderColor: regimeColor(macro.macro_regime) + '40' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: regimeColor(macro.macro_regime) }}>Macro Regime</div>
              <div className="font-serif text-xl" style={{ color: C.text }}>
                {regimeLabel(macro.macro_regime)}
              </div>
              {macro.regime_signals?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {macro.regime_signals.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: regimeColor(macro.macro_regime) + '15',
                               color: regimeColor(macro.macro_regime) }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-4xl font-serif font-bold" style={{ color: regimeColor(macro.macro_regime) }}>
                {macro.macro_score}
              </div>
              <div className="text-xs" style={{ color: C.textFaint }}>Macro Score / 100</div>
            </div>
          </div>
        </div>
      )}

      {loading && !macro && (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-2"
              style={{ background: C.surface, borderColor: C.border }}>
              <div className="h-3 rounded w-1/2" style={{ background: C.surface2 }} />
              <div className="h-6 rounded w-2/3" style={{ background: C.surface2 }} />
              <div className="h-2 rounded w-full" style={{ background: C.surface2 }} />
            </div>
          ))}
        </div>
      )}

      {error === 'warming_up' && (
        <div className="rounded-2xl border p-5 flex items-center gap-4"
          style={{ background: C.surface, borderColor: C.gold + '40' }}>
          <RefreshCw size={18} className="spin shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: C.gold }}>Backend warming up…</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>Render free tier cold start (~30 sec). Retrying automatically.</p>
          </div>
        </div>
      )}
      {error && error !== 'warming_up' && (
        <div className="rounded-xl border p-4 flex items-center gap-2"
          style={{ borderColor: C.neg + '30', color: C.neg }}>
          <AlertCircle size={14} />
          <span className="text-sm">{error}</span>
          <button onClick={fetchMacro} className="ml-auto text-xs px-2 py-1 rounded"
            style={{ background: C.surface2, color: C.gold }}>Retry</button>
        </div>
      )}

      {macro && (
        <div className="grid grid-cols-3 gap-4">
          {indicators.map(ind => (
            <div key={ind.label} className="rounded-2xl border p-5"
              style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.textFaint }}>{ind.label}</p>
              <p className="font-mono text-2xl font-bold" style={{ color: ind.color || C.text }}>{ind.value}</p>
              {ind.note && <p className="text-xs mt-1.5" style={{ color: C.textDim }}>{ind.note}</p>}
            </div>
          ))}
        </div>
      )}

      {macro && (
        <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>Macro Score Breakdown</p>
          <div className="h-3 rounded-full overflow-hidden relative" style={{ background: C.surface2 }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${macro.macro_score}%`,
                background: macro.macro_score >= 60 ? `linear-gradient(90deg, ${C.pos}80, ${C.pos})`
                          : macro.macro_score >= 40 ? `linear-gradient(90deg, ${C.gold}80, ${C.gold})`
                          : `linear-gradient(90deg, ${C.neg}80, ${C.neg})`,
              }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1.5">
            <span style={{ color: C.neg }}>Restrictive (0)</span>
            <span style={{ color: C.gold }}>Neutral (50)</span>
            <span style={{ color: C.pos }}>Accommodative (100)</span>
          </div>
          <p className="text-sm mt-4" style={{ color: C.textDim }}>
            {macro.macro_score >= 60
              ? 'Macro environment supports risk assets. Favor growth exposure, cyclicals, and momentum names.'
              : macro.macro_score >= 40
              ? 'Mixed macro signals. Maintain balanced exposure and tighten stop-losses.'
              : 'Restrictive macro conditions. Reduce equity exposure, favor defensives and cash.'}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Sentiment Intelligence View ───────────────────────────────────────────────
const SentimentView = ({ portfolio }) => {
  const [sym, setSym] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchSentiment = async (symbol) => {
    const s = ((typeof symbol === 'string' ? symbol : '') || inputVal).trim().toUpperCase();
    if (!s) return;
    setSym(s); setLoading(true); setWarmingUp(false); setError(null); setSentiment(null);
    try {
      const data = await apiFetch(`/api/brain/sentiment/${s}`, {}, {
        onWarmup: () => setWarmingUp(true),
      });
      setSentiment(data);
      setWarmingUp(false);
    } catch (e) {
      setWarmingUp(false);
      setError(e.message);
    } finally { setLoading(false); }
  };

  const fetchBatch = async () => {
    if (!portfolio?.positions?.length) return;
    setBatchLoading(true); setBatchResults([]);
    const syms = portfolio.positions.slice(0, 6).map(p => p.symbol);
    const results = await Promise.all(
      syms.map(s => apiFetch(`/api/brain/sentiment/${s}`, {}, { onWarmup: () => {} }).catch(e => ({ symbol: s, error: true })))
    );
    setBatchResults(results);
    setBatchLoading(false);
  };

  const sentColor = (label) => {
    if (!label) return C.textDim;
    if (label.includes('bullish')) return C.pos;
    if (label.includes('bearish')) return C.neg;
    return C.gold;
  };

  const meterWidth = (score) => `${Math.max(2, Math.min(100, score))}%`;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl" style={{ color: C.text }}>Sentiment Intelligence</h1>
          <p className="text-sm mt-1" style={{ color: C.textDim }}>NLP-powered news sentiment analysis via VADER</p>
        </div>
      </div>

      <div className="rounded-2xl border p-6" style={{ background: C.surface, borderColor: C.border }}>
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textFaint }} />
            <input value={inputVal} onChange={e => setInputVal(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter' && inputVal.trim()) fetchSentiment(); }}
              placeholder="Enter symbol (e.g. AAPL, NVDA)"
              className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm font-mono"
              style={{ background: C.surface2, borderColor: C.border, color: C.text, outline: 'none' }} />
          </div>
          <button
            onClick={() => { if (inputVal.trim()) fetchSentiment(); }}
            disabled={loading}
            className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
            style={{ background: C.gold, color: C.ink, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? <RefreshCw size={15} className="spin" /> : <Newspaper size={15} />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          {portfolio?.positions?.length > 0 && (
            <button onClick={fetchBatch} disabled={batchLoading}
              className="px-4 py-3 rounded-xl border text-sm flex items-center gap-2"
              style={{ borderColor: C.border, color: C.textDim, background: C.surface2 }}>
              {batchLoading ? <RefreshCw size={14} className="spin" /> : <Briefcase size={14} />}
              Portfolio Scan
            </button>
          )}
        </div>
        {/* Quick picks */}
        {portfolio?.positions?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: C.textFaint }}>Quick:</span>
            {portfolio.positions.slice(0, 8).map(p => (
              <button key={p.symbol}
                onClick={() => { setInputVal(p.symbol); fetchSentiment(p.symbol); }}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold"
                style={{ background: C.surface2, color: C.gold, border: `1px solid ${C.border}` }}>
                {p.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {warmingUp && (
        <div className="rounded-2xl border p-5 flex items-center gap-4"
          style={{ background: C.surface, borderColor: C.gold + '40' }}>
          <RefreshCw size={18} className="spin shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: C.gold }}>Backend warming up…</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>Render free tier cold start (~30 sec). Retrying automatically.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border p-4 flex items-center gap-2"
          style={{ borderColor: C.neg + '30', color: C.neg }}>
          <AlertCircle size={14} />
          <span className="text-sm">{error}</span>
          <button onClick={() => fetchSentiment()} className="ml-auto text-xs px-2 py-1 rounded"
            style={{ background: C.surface2, color: C.gold }}>Retry</button>
        </div>
      )}

      {/* Single symbol result */}
      {sentiment && (
        <div className="space-y-4 fade-in">
          <div className="rounded-2xl border p-6" style={{ background: C.surface, borderColor: C.border }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-serif text-xl" style={{ color: C.text }}>{sentiment.symbol} Sentiment</h2>
                <p className="text-xs mt-1" style={{ color: C.textFaint }}>{sentiment.article_count} articles analyzed</p>
              </div>
              <div className="text-right">
                <div className="font-serif text-2xl font-bold" style={{ color: sentColor(sentiment.sentiment_label) }}>
                  {sentiment.sentiment_label?.replace(/_/g, ' ')}
                </div>
                <div className="text-xs" style={{ color: C.textFaint }}>Score: {sentiment.sentiment_score}/100</div>
              </div>
            </div>
            {/* Gauge */}
            <div className="mb-5">
              <div className="h-2.5 rounded-full relative overflow-hidden"
                style={{ background: `linear-gradient(90deg, ${C.neg}, ${C.gold}, ${C.pos})` }}>
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow"
                  style={{ left: meterWidth(sentiment.sentiment_score), marginLeft: -8, background: C.surface, transform: 'translateX(-50%) translateY(-50%)' }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1">
                <span style={{ color: C.neg }}>Bearish</span>
                <span style={{ color: C.gold }}>Neutral</span>
                <span style={{ color: C.pos }}>Bullish</span>
              </div>
            </div>
            {/* Counts */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['Bullish', sentiment.bullish_count, C.pos],
                ['Neutral', sentiment.neutral_count, C.gold],
                ['Bearish', sentiment.bearish_count, C.neg],
              ].map(([label, count, color]) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ background: color + '10', border: `1px solid ${color}25` }}>
                  <div className="font-mono text-xl font-bold" style={{ color }}>{count}</div>
                  <div className="text-xs" style={{ color: C.textFaint }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Headlines */}
          {sentiment.top_headlines?.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: C.textFaint }}>Recent Headlines</p>
              <div className="space-y-3">
                {sentiment.top_headlines.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b last:border-0"
                    style={{ borderColor: C.border }}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0`}
                      style={{ background: sentColor(h.label) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-tight" style={{ color: C.text }}>{h.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: C.textFaint }}>
                        {h.publisher} · {h.published}
                      </p>
                    </div>
                    <span className="text-xs font-mono shrink-0 px-2 py-0.5 rounded"
                      style={{ background: sentColor(h.label) + '15', color: sentColor(h.label) }}>
                      {h.compound > 0 ? '+' : ''}{h.compound?.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch portfolio results */}
      {batchResults.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>Portfolio Sentiment Scan</p>
          <div className="space-y-3">
            {batchResults.map(r => !r.error && (
              <div key={r.symbol} className="flex items-center gap-4 py-2 border-b last:border-0"
                style={{ borderColor: C.border }}>
                <span className="font-mono font-bold text-sm w-16" style={{ color: C.gold }}>{r.symbol}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
                  <div className="h-full rounded-full"
                    style={{ width: meterWidth(r.sentiment_score), background: sentColor(r.sentiment_label) }} />
                </div>
                <span className="text-xs font-semibold w-32 text-right"
                  style={{ color: sentColor(r.sentiment_label) }}>
                  {r.sentiment_label?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-mono w-8 text-right" style={{ color: C.textFaint }}>
                  {r.sentiment_score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Portfolio Optimizer View ──────────────────────────────────────────────────
const PortfolioOptimizerView = ({ portfolio }) => {
  const [result, setResult] = useState(null);
  const [corr, setCorr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState(null);

  const CHART_COLORS = ['#d4a945','#5fa872','#6f8fb8','#c97049','#a78bfa','#f472b6','#34d399','#fb923c'];

  const runOptimize = async () => {
    if (!portfolio?.positions?.length) return;
    setLoading(true); setWarmingUp(false); setError(null); setResult(null); setCorr(null);
    const syms = portfolio.positions.map(p => p.symbol);
    const currentWeights = {};
    portfolio.positions.forEach(p => {
      currentWeights[p.symbol] = p.value / (portfolio.value || 1);
    });
    try {
      const opt = await apiFetch('/api/brain/portfolio/optimize', {
        method: 'POST',
        body: JSON.stringify({ symbols: syms, current_weights: currentWeights }),
      }, { onWarmup: () => setWarmingUp(true) });
      setResult(opt);
      setWarmingUp(false);
      // Fetch correlations separately
      apiFetch(`/api/brain/portfolio/correlations?symbols=${syms.join(',')}`, {}, { onWarmup: () => {} })
        .then(c => setCorr(c))
        .catch(() => {});
    } catch (e) {
      setWarmingUp(false);
      setError(e.message);
    } finally { setLoading(false); }
  };

  const corrColor = (v) => {
    if (v >= 0.8) return C.neg;
    if (v >= 0.5) return '#f97316';
    if (v >= 0.2) return C.gold;
    if (v >= -0.2) return C.textDim;
    return C.pos;
  };

  const barData = result?.symbols?.map((s, i) => ({
    symbol: s,
    current: Math.round((result.current_weights[s] || 0) * 100),
    optimal: Math.round((result.optimized_weights[s] || 0) * 100),
  }));

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl" style={{ color: C.text }}>Portfolio Optimizer</h1>
          <p className="text-sm mt-1" style={{ color: C.textDim }}>
            Mean-Variance / Max-Sharpe optimization with Monte Carlo frontier
          </p>
        </div>
        <button onClick={runOptimize} disabled={loading || !portfolio?.positions?.length}
          className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
          style={{ background: C.gold, color: C.ink, opacity: loading ? 0.6 : 1 }}>
          {loading ? <RefreshCw size={15} className="spin" /> : <Target size={15} />}
          {loading ? 'Optimizing…' : 'Run Optimization'}
        </button>
      </div>

      {!portfolio?.positions?.length && (
        <div className="rounded-2xl border p-8 text-center"
          style={{ background: C.surface, borderColor: C.border }}>
          <Briefcase size={32} className="mx-auto mb-3" style={{ color: C.textFaint }} />
          <p style={{ color: C.textDim }}>Add holdings to your portfolio to run optimization</p>
        </div>
      )}

      {warmingUp && (
        <div className="rounded-2xl border p-5 flex items-center gap-4"
          style={{ background: C.surface, borderColor: C.gold + '40' }}>
          <RefreshCw size={18} className="spin shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: C.gold }}>Backend warming up…</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>Render free tier cold start (~30 sec). Retrying — optimization will run automatically.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border p-4 flex items-center gap-3"
          style={{ borderColor: C.neg + '30', color: C.neg }}>
          <AlertCircle size={14} shrink-0 />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={runOptimize} className="text-xs px-3 py-1 rounded shrink-0"
            style={{ background: C.surface2, color: C.gold }}>Retry</button>
        </div>
      )}

      {result?.available && (
        <div className="space-y-5 fade-in">
          {/* Sharpe improvement */}
          <div className="grid grid-cols-3 gap-4">
            {[
              ['Current Sharpe', result.current_sharpe?.toFixed(3), C.textDim, `${result.current_return_pct?.toFixed(1)}% return / ${result.current_vol_pct?.toFixed(1)}% vol`],
              ['Optimized Sharpe', result.optimized_sharpe?.toFixed(3), C.pos, `${result.optimized_return_pct?.toFixed(1)}% return / ${result.optimized_vol_pct?.toFixed(1)}% vol`],
              ['Improvement', `+${result.sharpe_improvement_pct?.toFixed(1)}%`, C.gold, 'Sharpe ratio improvement'],
            ].map(([label, val, color, note]) => (
              <div key={label} className="rounded-2xl border p-5 text-center"
                style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.textFaint }}>{label}</p>
                <p className="font-mono text-2xl font-bold" style={{ color }}>{val}</p>
                <p className="text-xs mt-1" style={{ color: C.textFaint }}>{note}</p>
              </div>
            ))}
          </div>

          {/* Current vs Optimal bar chart */}
          {barData && (
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>
                Current vs. Optimal Allocation
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="symbol" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: C.text }}
                    formatter={(v, n) => [`${v}%`, n === 'current' ? 'Current' : 'Optimal']}
                  />
                  <Bar dataKey="current" name="current" fill={C.textDim + '80'} radius={[4,4,0,0]} />
                  <Bar dataKey="optimal" name="optimal" fill={C.gold} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rebalance suggestions */}
          <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>Rebalance Suggestions</p>
            <div className="space-y-2">
              {result.rebalance_suggestions?.map(s => (
                <div key={s.symbol} className="flex items-center gap-4 py-2.5 border-b last:border-0"
                  style={{ borderColor: C.border }}>
                  <span className="font-mono font-bold text-sm w-14" style={{ color: C.gold }}>{s.symbol}</span>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm font-mono" style={{ color: C.textDim }}>{s.current_pct}%</span>
                    <ArrowRight size={12} style={{ color: C.textFaint }} />
                    <span className="text-sm font-mono font-semibold" style={{ color: C.text }}>{s.optimal_pct}%</span>
                  </div>
                  <span className="text-xs font-mono"
                    style={{ color: s.delta_pct > 2 ? C.pos : s.delta_pct < -2 ? C.neg : C.textFaint }}>
                    {s.delta_pct > 0 ? '+' : ''}{s.delta_pct}%
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full`}
                    style={{
                      background: s.action === 'increase' ? C.pos + '15'
                        : s.action === 'decrease' ? C.neg + '15' : C.surface2,
                      color: s.action === 'increase' ? C.pos
                        : s.action === 'decrease' ? C.neg : C.textFaint,
                    }}>
                    {s.action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation heatmap */}
          {corr?.available && corr.symbols && (
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textFaint }}>
                Correlation Heatmap (1-Year Returns)
              </p>
              <div className="overflow-x-auto">
                <table className="text-[11px] font-mono">
                  <thead>
                    <tr>
                      <th style={{ color: C.textFaint, padding: '4px 8px', textAlign: 'left' }}></th>
                      {corr.symbols.map(s => (
                        <th key={s} style={{ color: C.gold, padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corr.symbols.map((s1, i) => (
                      <tr key={s1}>
                        <td style={{ color: C.gold, padding: '3px 8px', fontWeight: 700 }}>{s1}</td>
                        {corr.matrix[i].map((v, j) => (
                          <td key={j} style={{
                            padding: '3px 8px', textAlign: 'center',
                            background: i === j ? C.surface2
                              : v >= 0.8 ? C.neg + '40'
                              : v >= 0.5 ? '#f9731640'
                              : v >= 0.2 ? C.gold + '25'
                              : v < -0.2 ? C.pos + '25'
                              : 'transparent',
                            color: i === j ? C.textFaint : corrColor(v),
                            borderRadius: 4,
                          }}>
                            {i === j ? '—' : v.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-4 mt-3 text-[10px]">
                {[['≥0.8 High', C.neg], ['0.5-0.8 Moderate', '#f97316'], ['0.2-0.5 Low', C.gold], ['<0.2 Minimal', C.pos]].map(([l,c]) => (
                  <span key={l} className="flex items-center gap-1" style={{ color: C.textFaint }}>
                    <span className="w-2.5 h-2.5 rounded" style={{ background: c + '50', display: 'inline-block' }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Alert Center View ─────────────────────────────────────────────────────────
const AlertCenterView = ({ portfolio, watchlist }) => {
  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState(null);

  const allSymbols = useMemo(() => {
    const syms = new Set([
      ...(portfolio?.positions || []).map(p => p.symbol),
      ...(watchlist || []),
    ]);
    return [...syms].slice(0, 25);
  }, [portfolio, watchlist]);

  const fetchAlerts = async () => {
    if (!allSymbols.length) return;
    setLoading(true); setWarmingUp(false); setError(null);
    try {
      const data = await apiFetch(
        `/api/brain/alerts?symbols=${allSymbols.join(',')}`,
        {},
        { onWarmup: () => setWarmingUp(true) }
      );
      setAlertData(data);
      setWarmingUp(false);
    } catch (e) {
      setWarmingUp(false);
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAlerts(); }, [allSymbols.join(',')]);

  // Auto-refresh every 30 min
  useEffect(() => {
    const id = setInterval(fetchAlerts, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [allSymbols.join(',')]);

  const sevColor = (s) => s === 'high' ? C.neg : s === 'medium' ? C.gold : C.textDim;
  const typeIcon = (t) => {
    switch (t) {
      case 'RSI_OVERBOUGHT':
      case 'RSI_OVERSOLD':    return '◈';
      case 'VOLUME_SPIKE':
      case 'VOLUME_SURGE':    return '▲';
      case 'BB_SQUEEZE':
      case 'BB_BREAKOUT':     return '◆';
      case 'DEATH_CROSS':     return '✕';
      case 'GOLDEN_CROSS':    return '★';
      case 'BEARISH_DIVERGENCE': return '↓';
      case '52W_HIGH':        return '⬆';
      case 'EARNINGS_APPROACHING': return '📅';
      default: return '◉';
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl" style={{ color: C.text }}>Alert Center</h1>
          <p className="text-sm mt-1" style={{ color: C.textDim }}>
            Real-time anomaly detection across {allSymbols.length} symbols
          </p>
        </div>
        <button onClick={fetchAlerts} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm"
          style={{ borderColor: C.border, color: C.textDim, background: C.surface }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      {alertData && (
        <div className="grid grid-cols-4 gap-4">
          {[
            ['Scanned', alertData.scanned, C.textDim],
            ['Total Alerts', alertData.total_alerts, alertData.total_alerts > 0 ? C.gold : C.pos],
            ['High Priority', alertData.alerts?.filter(a => a.severity === 'high').length, C.neg],
            ['Medium Priority', alertData.alerts?.filter(a => a.severity === 'medium').length, C.gold],
          ].map(([label, count, color]) => (
            <div key={label} className="rounded-xl border p-4 text-center"
              style={{ background: C.surface, borderColor: C.border }}>
              <p className="font-mono text-2xl font-bold" style={{ color }}>{count ?? '—'}</p>
              <p className="text-xs mt-1" style={{ color: C.textFaint }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {warmingUp && (
        <div className="rounded-2xl border p-5 flex items-center gap-4"
          style={{ background: C.surface, borderColor: C.gold + '40' }}>
          <RefreshCw size={18} className="spin shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: C.gold }}>Backend warming up…</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>Render free tier cold start (~30 sec). Alert scan will run automatically.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border p-4 flex items-center gap-3"
          style={{ borderColor: C.neg + '30', color: C.neg }}>
          <AlertCircle size={14} className="shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={fetchAlerts} className="text-xs px-3 py-1 rounded shrink-0"
            style={{ background: C.surface2, color: C.gold }}>Retry</button>
        </div>
      )}

      {(loading || warmingUp) && !alertData && !error && (
        <div className="rounded-2xl border p-8 text-center"
          style={{ background: C.surface, borderColor: C.border }}>
          <RefreshCw size={24} className="spin mx-auto mb-3" style={{ color: C.gold }} />
          <p className="text-sm" style={{ color: C.textDim }}>Scanning {allSymbols.length} symbols for anomalies…</p>
        </div>
      )}

      {alertData?.alerts?.length === 0 && (
        <div className="rounded-2xl border p-10 text-center"
          style={{ background: C.surface, borderColor: C.pos + '30' }}>
          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: C.pos }} />
          <p className="font-serif text-lg mb-1" style={{ color: C.pos }}>All Clear</p>
          <p className="text-sm" style={{ color: C.textDim }}>No active alerts detected across your portfolio and watchlist</p>
        </div>
      )}

      {alertData?.alerts?.length > 0 && (
        <div className="space-y-3">
          {alertData.alerts.map((alert, i) => (
            <div key={i} className="rounded-2xl border p-5 flex items-start gap-4 fade-in"
              style={{
                background: C.surface,
                borderColor: sevColor(alert.severity) + '50',
                borderLeftWidth: 3,
                borderLeftColor: sevColor(alert.severity),
              }}>
              <div className="text-xl shrink-0 mt-0.5" style={{ color: sevColor(alert.severity) }}>
                {typeIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono font-bold text-sm" style={{ color: C.gold }}>{alert.symbol}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: sevColor(alert.severity) + '15', color: sevColor(alert.severity) }}>
                    {alert.severity}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: C.surface2, color: C.textFaint }}>
                    {alert.type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm" style={{ color: C.textDim }}>{alert.message}</p>
                <p className="text-[10px] mt-1" style={{ color: C.textFaint }}>
                  {new Date(alert.triggered_at).toLocaleString()}
                </p>
              </div>
              <div className="font-mono font-bold text-sm shrink-0"
                style={{ color: sevColor(alert.severity) }}>
                {typeof alert.value === 'number' ? alert.value.toFixed(2) : alert.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [holdings, setHoldings] = useState(INITIAL_HOLDINGS);
  const [cash, setCash] = useState(INITIAL_CASH);
  const [watchlist, setWatchlist] = useState(INITIAL_WATCHLIST);
  const [transactions, setTransactions] = useState([]);
  const [retirementProfile, setRetirementProfile] = useState(DEFAULT_RETIREMENT_PROFILE);
  const [selectedStock, setSelectedStock] = useState(null);
  const [transactionModal, setTransactionModal] = useState({ open: false, symbol: null, type: null });
  const [notification, setNotification] = useState(null);

  const priceState = usePriceState(holdings, watchlist);
  const { prices, apiKey, setApiKey, apiStatus, lastUpdated, errorMsg, flashes,
          demoMode, setDemoMode, refresh } = priceState;

  const allSymbols = useMemo(() =>
    [...new Set([...holdings.map(h => h.symbol), ...watchlist])],
    [holdings, watchlist]);

  const handleRefresh = () => refresh(allSymbols);

  const portfolio = useMemo(() => computePortfolio(holdings, prices, cash), [holdings, prices, cash]);
  const sectorAlloc = useMemo(() => computeSectorAllocation(portfolio.positions, cash), [portfolio.positions, cash]);
  const risk = useMemo(() => computeRiskMetrics(portfolio.positions, cash), [portfolio.positions, cash]);
  const recs = useMemo(() => generateRecommendations(portfolio, risk, sectorAlloc, retirementProfile, risk.cashRatio),
    [portfolio, risk, sectorAlloc, retirementProfile]);

  // Silently wake the backend on mount so it's warm by the time the user needs it
  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  // Bridge for StockSearchView to switch views with a pre-filled symbol
  useEffect(() => {
    window.__finsightSetView = (v, sym) => {
      setView(v);
      // Views pick up via URL state — use a tiny delay so the view mounts first
      if (sym) setTimeout(() => window.dispatchEvent(new CustomEvent('finsight:prefill', { detail: { symbol: sym } })), 50);
    };
    return () => { delete window.__finsightSetView; };
  }, []);

  const showNotification = (msg, tone = 'pos') => {
    setNotification({ msg, tone });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddTransaction = (txn) => {
    setTransactions(prev => [...prev, txn]);

    setHoldings(prev => {
      const existing = prev.find(h => h.symbol === txn.symbol);
      if (txn.type === 'buy') {
        if (existing) {
          const totalShares = existing.shares + txn.shares;
          const totalCost = (existing.shares * existing.avgCost) + (txn.shares * txn.price);
          return prev.map(h => h.symbol === txn.symbol ?
            { ...h, shares: totalShares, avgCost: totalCost / totalShares } : h);
        } else {
          // New holding - need to seed prices for it
          return [...prev, {
            symbol: txn.symbol, shares: txn.shares, avgCost: txn.price,
            lastPrice: txn.price, prevClose: txn.price * 0.998,
          }];
        }
      } else {
        if (!existing) return prev;
        const newShares = existing.shares - txn.shares;
        if (newShares <= 0.0001) return prev.filter(h => h.symbol !== txn.symbol);
        return prev.map(h => h.symbol === txn.symbol ? { ...h, shares: newShares } : h);
      }
    });

    // Update cash
    const cashDelta = txn.type === 'buy' ? -(txn.shares * txn.price) : (txn.shares * txn.price);
    setCash(prev => ({ ...prev, value: prev.value + cashDelta }));

    showNotification(
      `${txn.type === 'buy' ? 'Bought' : 'Sold'} ${fmt.shares(txn.shares)} ${txn.symbol} @ ${fmt.dollar(txn.price, 2)}`,
      txn.type === 'buy' ? 'pos' : 'neg'
    );
  };

  const handleAddToPortfolio = (symbol) => {
    setTransactionModal({ open: true, symbol, type: 'buy' });
  };

  const handleAddToWatchlist = (symbol) => {
    if (watchlist.includes(symbol)) return;
    setWatchlist(prev => [...prev, symbol]);
    showNotification(`Added ${symbol} to watchlist`, 'pos');
  };

  const handleRemoveFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    showNotification(`Removed ${symbol} from watchlist`, 'neg');
  };

  return (
    <>
      <style>{THEME_CSS}</style>
      {sidebarOpen && <div className="overlay open" onClick={() => setSidebarOpen(false)} />}
      <div className="flex h-screen overflow-hidden" style={{ background: C.ink }}>
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar active={view} setActive={setView}
            apiStatus={apiStatus} lastUpdated={lastUpdated} errorMsg={errorMsg} />
        </div>

        <div className="main flex-1 flex flex-col min-w-0">
          <TopBar
            portfolioValue={portfolio.value}
            dayChange={portfolio.dayChange}
            dayChangePct={portfolio.dayChangePct}
            onAdd={() => setTransactionModal({ open: true, symbol: null, type: 'buy' })}
            onRefresh={handleRefresh}
            apiStatus={apiStatus}
            hasApiKey={!!apiKey}
            onSettings={() => setView('settings')}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          <MarketRegimeBanner />

          <main className="flex-1 overflow-y-auto px-8 py-8">
            <div className="max-w-7xl mx-auto">
              {view === 'dashboard' && (
                <DashboardView portfolio={portfolio} cash={cash} recs={recs}
                  onViewRecs={() => setView('recommendations')} />
              )}
              {view === 'holdings' && (
                <HoldingsView portfolio={portfolio} cash={cash}
                  onSelectStock={setSelectedStock} flashes={flashes} />
              )}
              {view === 'watchlist' && (
                <WatchlistView watchlist={watchlist} prices={prices}
                  onSelectStock={setSelectedStock}
                  onAddToPortfolio={handleAddToPortfolio}
                  onRemove={handleRemoveFromWatchlist}
                  flashes={flashes} />
              )}
              {view === 'search' && (
                <StockSearchView
                  watchlist={watchlist}
                  onAddToWatchlist={handleAddToWatchlist}
                  onAddToPortfolio={handleAddToPortfolio} />
              )}
              {view === 'recommendations' && <RecommendationsView recs={recs} />}
              {view === 'retirement' && (
                <RetirementView portfolioValue={portfolio.value}
                  profile={retirementProfile} setProfile={setRetirementProfile} />
              )}
              {view === 'analytics' && <AnalyticsView portfolio={portfolio} cash={cash} />}
              {view === 'news' && <NewsView portfolio={portfolio} />}
              {view === 'activity' && <ActivityView transactions={transactions} />}
              {view === 'tips' && <TradingTipsView portfolio={portfolio} />}
              {view === 'predict' && <PredictionView portfolio={portfolio} />}
              {view === 'aibrain' && <AIBrainView portfolio={portfolio} />}
              {view === 'macro' && <MacroRadarView />}
              {view === 'sentiment' && <SentimentView portfolio={portfolio} />}
              {view === 'optimizer' && <PortfolioOptimizerView portfolio={portfolio} />}
              {view === 'alerts' && <AlertCenterView portfolio={portfolio} watchlist={watchlist} />}
              {view === 'settings' && (
                <SettingsView
                  apiKey={apiKey} setApiKey={setApiKey}
                  apiStatus={apiStatus} errorMsg={errorMsg}
                  demoMode={demoMode} setDemoMode={setDemoMode}
                  refreshAll={handleRefresh}
                />
              )}
            </div>
          </main>
        </div>

        {selectedStock && (
          <StockDetailPanel symbol={selectedStock} prices={prices} holdings={holdings}
            onClose={() => setSelectedStock(null)}
            onAddTransaction={(symbol, type) => {
              setSelectedStock(null);
              setTransactionModal({ open: true, symbol, type });
            }} />
        )}

        <TransactionModal
          open={transactionModal.open}
          prefilledSymbol={transactionModal.symbol}
          prefilledType={transactionModal.type}
          prices={prices}
          holdings={holdings}
          onClose={() => setTransactionModal({ open: false, symbol: null, type: null })}
          onSubmit={handleAddTransaction}
        />

        {notification && (
          <div className="fixed bottom-6 right-6 px-5 py-3 rounded-lg border flex items-center gap-3 fade-in z-50"
            style={{
              background: C.surface,
              borderColor: notification.tone === 'pos' ? C.pos : C.neg,
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: notification.tone === 'pos' ? 'rgba(95,168,114,0.15)' : 'rgba(201,112,73,0.15)' }}>
              <ArrowRight size={14} style={{ color: notification.tone === 'pos' ? C.pos : C.neg }} />
            </div>
            <span className="text-sm" style={{ color: C.text }}>{notification.msg}</span>
          </div>
        )}
      </div>
    </>
  );
}
