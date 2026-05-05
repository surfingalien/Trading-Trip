'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, DollarSign, RefreshCw,
  BarChart2, Lightbulb, Activity, Globe, AlertTriangle,
  Bell, BellOff, Zap, Target, Shield, Cpu, Brain,
  Bitcoin, Search, Layers, X, Coins, Waves,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  PORTFOLIO, RECOMMENDATIONS, NEW_STOCK_IDEAS,
  CRYPTO_WATCHLIST, CRYPTO_RECOMMENDATIONS,
  ETF_WATCHLIST, ETF_RECOMMENDATIONS,
  WATCHLIST_ALERTS, CRYPTO_ALERTS, ETF_ALERTS, BuyAlert
} from '@/lib/portfolioData';
import { usePortfolio } from '@/lib/usePortfolio';
import { calcRiskMetrics, runMonteCarlo, getMeta } from '@/lib/analytics';
import { API_BASE, fetchCryptoOverview, fetchCryptoResearch } from '@/lib/api';

// ─── Formatting helpers ────────────────────────────────────────────────────
const fmt$ = (n: number, dec = 2) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

const ratingBadge = (r: string) => ({
  STRONG_BUY:  'bg-emerald-700 text-white',
  BUY:         'bg-green-600 text-white',
  HOLD:        'bg-amber-600 text-white',
  SELL:        'bg-orange-600 text-white',
  STRONG_SELL: 'bg-red-700 text-white',
}[r] ?? 'bg-gray-600 text-white');

const actionBadge = (a: string) => ({
  ADD:    'border-emerald-500 text-emerald-300 bg-emerald-900/30',
  HOLD:   'border-blue-500 text-blue-300 bg-blue-900/30',
  REDUCE: 'border-amber-500 text-amber-300 bg-amber-900/30',
  EXIT:   'border-red-500 text-red-300 bg-red-900/30',
  REVIEW: 'border-yellow-500 text-yellow-300 bg-yellow-900/30',
}[a] ?? 'border-gray-500 text-gray-300');

function Delta({ v, suffix = '' }: { v: number; suffix?: string }) {
  return (
    <span className={`flex items-center gap-0.5 ${v >= 0 ? 'text-emerald-400 font-semibold tabular-nums' : 'text-red-400 font-semibold tabular-nums'}`}>
      {v >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {fmtPct(v)}{suffix}
    </span>
  );
}

type Tab = 'overview' | 'analysis' | 'montecarlo' | 'signals' | 'market' | 'recommendations' | 'alerts' | 'crypto' | 'etfs' | 'technicals';

// ─── Live Technical Analysis data (fetched 2025-05-05 via Yahoo Finance) ──
const TA_DATA: Record<string, { price: number; w52hi: number; w52lo: number; rsi14: number; ma50: number; ma200: number; vs50: number; vs200: number; signal: 'Bullish' | 'Bearish' | 'Mixed' }> = {
  NVDA: { price:197.35, w52hi:216.83, w52lo:110.82, rsi14:48.4, ma50:187.44, ma200:184.11, vs50:+5.3,  vs200:+7.2,  signal:'Bullish' },
  AAPL: { price:283.20, w52hi:288.62, w52lo:193.25, rsi14:65.0, ma50:261.80, ma200:255.88, vs50:+8.2,  vs200:+10.7, signal:'Bullish' },
  TSLA: { price:391.67, w52hi:498.83, w52lo:271.00, rsi14:49.8, ma50:383.17, ma200:403.17, vs50:+2.2,  vs200:-2.9,  signal:'Mixed'   },
  GOOG: { price:382.30, w52hi:388.96, w52lo:149.49, rsi14:80.4, ma50:316.93, ma200:283.25, vs50:+20.6, vs200:+35.0, signal:'Bullish' },
  MSFT: { price:410.56, w52hi:555.45, w52lo:356.28, rsi14:49.6, ma50:396.96, ma200:467.01, vs50:+3.4,  vs200:-12.1, signal:'Mixed'   },
  AMD:  { price:356.38, w52hi:362.79, w52lo: 96.88, rsi14:75.5, ma50:241.40, ma200:213.29, vs50:+47.6, vs200:+67.1, signal:'Bullish' },
  ARM:  { price:208.93, w52hi:237.68, w52lo:100.02, rsi14:68.0, ma50:153.09, ma200:141.77, vs50:+36.5, vs200:+47.4, signal:'Bullish' },
  AVGO: { price:432.05, w52hi:432.48, w52lo:195.94, rsi14:66.1, ma50:353.19, ma200:341.48, vs50:+22.3, vs200:+26.5, signal:'Bullish' },
  TSM:  { price:397.39, w52hi:414.50, w52lo:170.59, rsi14:61.4, ma50:361.44, ma200:307.04, vs50:+9.9,  vs200:+29.4, signal:'Bullish' },
  AMZN: { price:273.67, w52hi:278.56, w52lo:183.85, rsi14:82.4, ma50:227.41, ma200:227.86, vs50:+20.3, vs200:+20.1, signal:'Mixed'   },
};

// ─── Inline SVG Sparkline ──────────────────────────────────────────────────
function Sparkline({ data, up, width = 56, height = 22 }: { data: number[]; up: boolean; width?: number; height?: number }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - mn) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      <polyline points={pts} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
        className={up ? 'sparkline-up' : 'sparkline-down'} />
    </svg>
  );
}

// ─── Pre-computed backtest results (backtesting-trading-strategies skill) ──
// Run: python3 skill/scripts/backtest.py --strategy <s> --symbol <sym> --period 1y
const PRECOMPUTED_BT = [
  { symbol: 'BTC-USD', strategy: 'MACD',         total_return_pct:   2.10, sharpe_ratio:  0.14, win_rate_pct: 28.0, max_drawdown_pct: -21.21, total_trades: 25 },
  { symbol: 'BTC-USD', strategy: 'RSI Reversal',  total_return_pct:   1.50, sharpe_ratio:  0.12, win_rate_pct: 54.2, max_drawdown_pct: -25.10, total_trades: 24 },
  { symbol: 'ETH-USD', strategy: 'Momentum',      total_return_pct: -11.91, sharpe_ratio: -0.17, win_rate_pct: 26.7, max_drawdown_pct: -45.11, total_trades: 15 },
  { symbol: 'ETH-USD', strategy: 'MACD',          total_return_pct: -37.85, sharpe_ratio: -0.49, win_rate_pct: 19.2, max_drawdown_pct: -66.49, total_trades: 26 },
  { symbol: 'SOL-USD', strategy: 'MACD',          total_return_pct: -14.54, sharpe_ratio:  0.01, win_rate_pct: 34.6, max_drawdown_pct: -57.23, total_trades: 26 },
  { symbol: 'SOL-USD', strategy: 'RSI Reversal',  total_return_pct: -38.90, sharpe_ratio: -0.38, win_rate_pct: 47.4, max_drawdown_pct: -60.19, total_trades: 19 },
] as const;

// ─── Main Component ────────────────────────────────────────────────────────
export default function TradingDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const {
    prices, enriched, totals, totalWithCash,
    connected, lastUpdate,
    alerts, triggeredAlerts, addAlert, removeAlert, dismissAlert,
    refresh,
  } = usePortfolio();

  const [backtests, setBacktests] = useState<Record<string, { total_return_pct: number; win_rate_pct: number; sharpe_ratio: number; max_drawdown_pct: number; total_trades: number }>>({});
  const [loadingBT, setLoadingBT] = useState(false);
  const [cryptoOverview, setCryptoOverview] = useState<{
    btc_price?: { symbol: string; price: number; change_pct: number; currency?: string; source?: string };
    bitcoin_dominance_pct?: number;
    fear_greed_index?: number;
    exchange_flows?: { inflow_24h: number; outflow_24h: number; net_flow_24h: number; source: string };
    large_transactions?: Array<{ hash: string; value_btc: number; timestamp: string; from_address: string; to_address: string }>;
    top_cryptos?: Array<{ symbol: string; name: string; price: number; market_cap: number; volume_24h: number; change_24h: number }>;
  } | null>(null);
  const [cryptoResearch, setCryptoResearch] = useState<{ winner?: string; ranking?: Array<{ strategy: string; strategy_label: string; total_return_pct: number; rank?: number }> } | null>(null);
  const [btcHistory, setBtcHistory] = useState<Array<{ time: string; price: number }>>([]);
  const [snapshot, setSnapshot]   = useState<{ indices: { symbol: string; price: number; change_pct: number }[]; crypto: { symbol: string; price: number; change_pct: number }[]; etfs: { symbol: string; price: number; change_pct: number }[] } | null>(null);
  const [newAlertSym, setNewAlertSym] = useState('NVDA');
  const [newAlertThreshold, setNewAlertThreshold] = useState('');
  const [newAlertType, setNewAlertType] = useState<'above' | 'below' | 'change_pct'>('above');
  const [monteCarlo, setMonteCarlo] = useState<ReturnType<typeof runMonteCarlo> | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, { price: number; change_pct: number }>>({});
  const [etfPrices, setEtfPrices]     = useState<Record<string, { price: number; change_pct: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);

  // ── Server wake-up state ────────────────────────────────────────────────
  const [serverStatus, setServerStatus] = useState<'unknown' | 'warming' | 'online'>('unknown');

  // ── Smart Money Signals (Binance on-chain, browser-side) ────────────────
  type SmartSignal = {
    signalId: number; ticker: string; direction: string; smartMoneyCount: number;
    maxGain: string; exitRate: number; status: string; alertPrice: string;
    currentPrice: string; signalTriggerTime: number; launchPlatform?: string;
  };
  const [smartSignals, setSmartSignals] = useState<{ sol: SmartSignal[]; bsc: SmartSignal[] } | null>(null);
  const [loadingSignals, setLoadingSignals] = useState(false);

  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };


  // Market Pulse — Fear & Greed
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string } | null>(null);
  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => r.json())
      .then(d => {
        const v = parseInt(d.data[0].value);
        setFearGreed({ value: v, label: d.data[0].value_classification });
      })
      .catch(() => {});
  }, []);


  // ── Risk metrics ─────────────────────────────────────────────────────────
  const risk = useMemo(() => {
    if (!enriched.length) return null;
    return calcRiskMetrics(enriched, totalWithCash - PORTFOLIO.cashValue);
  }, [enriched, totalWithCash]);

  // ── Monte Carlo ───────────────────────────────────────────────────────────
  const computeMonteCarlo = useCallback(() => {
    if (!enriched.length) return;
    const res = runMonteCarlo(enriched, totalWithCash - PORTFOLIO.cashValue);
    setMonteCarlo(res);
  }, [enriched, totalWithCash]);

  // ── Backtest runner ───────────────────────────────────────────────────────
  const runBacktests = useCallback(async () => {
    setLoadingBT(true);
    const syms = ['NVDA', 'TSM', 'AVGO', 'GOOG', 'TSLA', 'AMD', 'AAPL', 'MSFT', 'AMZN', 'INTC'];
    const res: typeof backtests = {};
    await Promise.all(syms.map(async sym => {
      try {
        const r = await fetch(`${API_BASE}/api/backtest/${sym}?strategy=rsi&period=1y`, { signal: AbortSignal.timeout(5000) });
        if (r.ok) res[sym] = await r.json();
      } catch { /* skip */ }
    }));
    setBacktests(res);
    setLoadingBT(false);
  }, []);

  // ── Snapshot ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/snapshot`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setSnapshot(d); setServerStatus('online'); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'montecarlo' && !monteCarlo) computeMonteCarlo();
  }, [tab, monteCarlo, computeMonteCarlo]);

  // ── Crypto / ETF live prices ──────────────────────────────────────────────
  useEffect(() => {
    const fetchPrices = async (symbols: string[], setter: (m: Record<string, { price: number; change_pct: number }>) => void) => {
      try {
        const res = await fetch(`${API_BASE}/api/prices?symbols=${symbols.join(',')}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data: Array<{ symbol: string; price: number; change_pct: number; error?: string }> = await res.json();
        const map: Record<string, { price: number; change_pct: number }> = {};
        data.forEach(d => { if (!d.error) map[d.symbol] = d; });
        setter(map);
        setServerStatus('online');
      } catch { /* silent */ }
    };
    if (tab === 'crypto') fetchPrices(CRYPTO_WATCHLIST.map(c => c.symbol), setCryptoPrices);
    if (tab === 'etfs')   fetchPrices(ETF_WATCHLIST.map(e => e.symbol),   setEtfPrices);
  }, [tab]);

  useEffect(() => {
    const loadCrypto = async () => {
      if (tab !== 'crypto') return;
      try {
        const overview = await fetchCryptoOverview(8);
        setCryptoOverview(overview);
        if (overview?.btc_price?.price != null) {
          setBtcHistory(prev => {
            const next = [...prev, { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), price: overview.btc_price.price }];
            return next.slice(-16);
          });
        }
      } catch {
        setCryptoOverview(null);
      }
      try {
        const research = await fetchCryptoResearch('1y');
        setCryptoResearch(research);
      } catch {
        setCryptoResearch(null);
      }
    };

    loadCrypto();
  }, [tab]);

  useEffect(() => {
    if (tab !== 'crypto') return;
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/price/BTC-USD`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data: { symbol: string; price: number; change_pct: number } = await res.json();
        setCryptoOverview(prev => prev ? { ...prev, btc_price: data } : { btc_price: data });
        setBtcHistory(prev => {
          if (!data || data.price == null) return prev;
          const next = [...prev, { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), price: data.price }];
          return next.slice(-16);
        });
      } catch {
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [tab]);

  // ── Server wake-up ping ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
        if (!cancelled) setServerStatus('online');
      } catch {
        if (!cancelled) {
          setServerStatus('warming');
          setTimeout(ping, 15000);
        }
      }
    };
    ping();
    return () => { cancelled = true; };
  }, []);

  // ── Smart Money Signals (Binance public API — no auth, CORS-safe) ─────────
  const fetchSmartSignals = useCallback(async () => {
    setLoadingSignals(true);
    const call = (chainId: string) =>
      fetch('https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/web/signal/smart-money/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'binance-web3/1.1 (Skill)' },
        body: JSON.stringify({ smartSignalType: '', page: 1, pageSize: 20, chainId }),
        signal: AbortSignal.timeout(12000),
      });
    try {
      const [s, b] = await Promise.all([call('CT_501'), call('56')]);
      const parse = async (r: Response) => {
        if (!r.ok) return [];
        const d = await r.json();
        return (d.data ?? []) as SmartSignal[];
      };
      const [sol, bsc] = await Promise.all([parse(s), parse(b)]);
      setSmartSignals({
        sol: sol.filter(x => x.status === 'active').slice(0, 6),
        bsc: bsc.filter(x => x.status === 'active').slice(0, 6),
      });
    } catch {
      setSmartSignals({ sol: [], bsc: [] });
    }
    setLoadingSignals(false);
  }, []);

  useEffect(() => {
    if (tab === 'signals') fetchSmartSignals();
  }, [tab, fetchSmartSignals]);

  // ── Search across all assets ──────────────────────────────────────────────
  const allAssets = useMemo(() => [
    ...PORTFOLIO.positions.map(p => ({ symbol: p.symbol, name: p.description, type: 'Stock' as const,  tab: 'overview' as Tab })),
    ...CRYPTO_WATCHLIST.map(c =>    ({ symbol: c.symbol, name: c.name,        type: 'Crypto' as const, tab: 'crypto'   as Tab })),
    ...ETF_WATCHLIST.map(e =>       ({ symbol: e.symbol, name: e.name,        type: 'ETF' as const,    tab: 'etfs'     as Tab })),
  ], []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allAssets.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, allAssets]);

  // ── MC chart data ──────────────────────────────────────────────────────────
  const mcChartData = useMemo(() => {
    if (!monteCarlo) return [];
    const days = monteCarlo.simulations[0]?.length ?? 126;
    return Array.from({ length: days }, (_, i) => {
      const vals = monteCarlo.simulations.map(s => s[i]);
      vals.sort((a, b) => a - b);
      return {
        day: i,
        p10:    vals[Math.floor(vals.length * 0.1)],
        median: vals[Math.floor(vals.length * 0.5)],
        p90:    vals[Math.floor(vals.length * 0.9)],
      };
    });
  }, [monteCarlo]);

  // ── Sector allocation ──────────────────────────────────────────────────────
  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    enriched.forEach(p => { map[p.sector] = (map[p.sector] || 0) + p.liveValue; });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [enriched]);

  const sortedEnriched = useMemo(() => {
    let sortableItems = [...enriched];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof typeof a];
        let bVal: any = b[sortConfig.key as keyof typeof b];
        
        // Handle mapped column names
        if (sortConfig.key === 'Value') { aVal = a.liveValue; bVal = b.liveValue; }
        if (sortConfig.key === 'Today') { aVal = a.livePct; bVal = b.livePct; }
        if (sortConfig.key === 'Total G/L') { aVal = a.liveGain; bVal = b.liveGain; }
        if (sortConfig.key === 'Total %') { aVal = a.liveGainPct; bVal = b.liveGainPct; }
        if (sortConfig.key === 'Avg Cost') { aVal = a.avgCost; bVal = b.avgCost; }
        if (sortConfig.key === 'Live Price') { aVal = a.livePrice; bVal = b.livePrice; }
        if (sortConfig.key === 'Qty') { aVal = a.qty; bVal = b.qty; }
        if (sortConfig.key === 'Symbol') { aVal = a.symbol; bVal = b.symbol; }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      sortableItems.sort((a, b) => b.liveValue - a.liveValue); // Default
    }
    return sortableItems;
  }, [enriched, sortConfig]);

  const TABS: { id: Tab; label: string; icon: typeof DollarSign }[] = [
    { id: 'overview',        label: 'Portfolio',       icon: DollarSign },
    { id: 'technicals',      label: 'Technicals',      icon: BarChart2   },
    { id: 'analysis',        label: 'Risk',            icon: Shield },
    { id: 'signals',         label: 'Signals',         icon: Zap },
    { id: 'montecarlo',      label: 'Outlook',         icon: Target },
    { id: 'recommendations', label: 'Ideas',           icon: Lightbulb },
    { id: 'crypto',          label: 'Crypto',          icon: Bitcoin },
    { id: 'etfs',            label: 'ETFs',            icon: Layers },
    { id: 'market',          label: 'Markets',         icon: Globe },
    { id: 'alerts',          label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}`, icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black text-gray-100 selection:bg-emerald-500/30">

      {/* ── Server wake-up banner ──────────────────────────────────────── */}
      {serverStatus === 'warming' && (
        <div className="bg-amber-950/60 border-b border-amber-700/40 px-6 py-2 text-sm text-amber-200 flex items-center gap-2 z-50 relative">
          <RefreshCw className="h-3.5 w-3.5 animate-spin flex-shrink-0 text-amber-400" />
          <span><strong className="text-amber-300">Backend warming up</strong> on Render (~30 s) — live prices &amp; backtests load automatically once online.</span>
          <span className="ml-auto text-amber-500 text-xs tabular-nums">Auto-retry every 15 s</span>
        </div>
      )}
      {serverStatus === 'online' && (
        <div className="bg-emerald-950/40 border-b border-emerald-800/30 px-6 py-1.5 text-xs text-emerald-400 flex items-center gap-2 z-50 relative">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Backend online — live data active
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-2xl border-b border-transparent [border-image:linear-gradient(to_right,transparent,rgba(52,211,153,0.3),rgba(34,211,238,0.2),transparent)_1]">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400/20 rounded-xl blur-lg" aria-hidden="true" />
              <div className="relative bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 rounded-xl p-2">
                <Waves className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-none bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                FinSurfing
              </h1>
              <p className="text-[10px] text-gray-500 mt-0.5">{PORTFOLIO.positions.length}&nbsp;positions&nbsp;·&nbsp;{PORTFOLIO.asOf}</p>
            </div>
          </div>

          {/* P&L strip */}
          <div className="hidden lg:flex items-center gap-5 text-sm">
            {[
              { label: 'Portfolio',  val: fmt$(totalWithCash, 0),              cls: 'bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent font-extrabold' },
              { label: 'Total G/L',  val: `${fmt$(totals.gain, 0)} (${fmtPct((totals.gain / totals.cost) * 100)})`, cls: totals.gain >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold' },
              { label: 'Today',      val: fmt$(totals.dayGain, 0),             cls: totals.dayGain >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-end">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                <span className={`tabular-nums ${s.cls}`}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <label htmlFor="global-search" className="sr-only">Search stocks, crypto, ETFs</label>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" aria-hidden="true" />
              <input
                id="global-search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search stocks, crypto, ETFs…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                className="bg-gray-800/80 border border-gray-700/60 rounded-xl pl-8 pr-7 py-1.5 text-sm text-gray-100 placeholder-gray-500 w-52 focus-visible:outline-none focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  aria-label="Clear search"
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-gray-100 text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {searchOpen && searchResults.length > 0 && (
                <div role="listbox" aria-label="Search results"
                  className="absolute top-full mt-1 right-0 w-72 bg-gray-900/95 backdrop-blur-xl border border-gray-700/60 rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/5 z-50 overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.symbol + r.type} role="option" aria-selected={false}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/80 text-left transition-colors focus-visible:outline-none focus-visible:bg-gray-800"
                      onMouseDown={() => { setTab(r.tab); setSearchQuery(''); setSearchOpen(false); }}>
                      <div aria-hidden="true" className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${r.type === 'Crypto' ? 'bg-orange-900/60' : r.type === 'ETF' ? 'bg-violet-900/60' : 'bg-blue-900/60'}`}>
                        {r.type === 'Crypto' ? <Bitcoin className="h-3.5 w-3.5 text-orange-300" /> : r.type === 'ETF' ? <Layers className="h-3.5 w-3.5 text-violet-300" /> : <BarChart2 className="h-3.5 w-3.5 text-blue-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">{r.symbol.replace('-USD', '')}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.type === 'Crypto' ? 'bg-orange-900/60 text-orange-300' : r.type === 'ETF' ? 'bg-violet-900/60 text-violet-300' : 'bg-blue-900/60 text-blue-300'}`}>{r.type}</span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">{r.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {triggeredAlerts.length > 0 && (
              <Badge className="bg-red-700 text-white animate-pulse flex items-center gap-1" aria-live="polite">
                <Bell className="h-3 w-3" aria-hidden="true" />
                {triggeredAlerts.length}&nbsp;alert{triggeredAlerts.length > 1 ? 's' : ''}
              </Badge>
            )}

            {/* Live status */}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${connected ? 'border-emerald-700/50 bg-emerald-950/50 text-emerald-400' : 'border-gray-700 bg-gray-800/50 text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 live-dot' : 'bg-gray-500'}`} aria-hidden="true" />
              {connected ? 'Live' : lastUpdate ? lastUpdate.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Connecting…'}
            </div>

            <button
              aria-label="Refresh portfolio data"
              onClick={refresh}
              className="p-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 hover:border-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500">
              <RefreshCw className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Scrolling ticker strip ──────────────────────────────────── */}
        <div className="border-t border-gray-800/60 bg-gray-950/50 overflow-hidden py-1.5" aria-hidden="true">
          <div className="ticker-track text-xs text-gray-400 gap-8 flex">
            {[...Object.entries(TA_DATA), ...Object.entries(TA_DATA)].map(([sym, d], i) => (
              <span key={`${sym}-${i}`} className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-semibold text-white">{sym}</span>
                <span className={d.signal === 'Bullish' ? 'text-emerald-400' : d.signal === 'Bearish' ? 'text-red-400' : 'text-yellow-400'}>
                  {fmt$(d.price, 2)}
                </span>
                <span className={d.vs50 >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  {d.vs50 >= 0 ? '▲' : '▼'}{Math.abs(d.vs50).toFixed(1)}%&nbsp;vs&nbsp;50d
                </span>
                <span className="text-gray-700">|</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Triggered alert banner */}
      {triggeredAlerts.length > 0 && (
        <div className="bg-red-950/80 border-b border-red-800/60 px-6 py-2" role="alert" aria-live="assertive">
          {triggeredAlerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center justify-between text-sm text-red-300">
              <span>
                <Bell className="inline h-3 w-3 mr-1" aria-hidden="true" />
                <strong>{a.symbol}</strong> {a.type === 'above' ? 'crossed above' : a.type === 'below' ? 'dropped below' : 'moved'}&nbsp;
                {a.threshold}{a.type === 'change_pct' ? '%' : ` (${fmt$(a.threshold)})`}
              </span>
              <button onClick={() => dismissAlert(a.id)}
                className="text-red-500 hover:text-red-200 ml-4 text-xs focus-visible:outline-none focus-visible:underline">
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-6 py-4 space-y-4">

        {/* ── Pill Tab Bar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 p-1 bg-gray-900/50 rounded-xl border border-gray-800/60 backdrop-blur-sm" role="tablist" aria-label="Dashboard sections">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={active} aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70
                  ${active
                    ? 'bg-gradient-to-r from-emerald-600/80 to-teal-600/60 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-500/40'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'}`}>
                <t.icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ────────────────────────────────────────────────────────────────
            TAB: PORTFOLIO OVERVIEW
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* KPI row — gradient border glass cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Value',  value: fmt$(totalWithCash, 0), sub: fmt$(totals.gain, 0) + ' total gain',
                  icon: DollarSign, grad: 'from-emerald-500/15 to-teal-500/5', border: 'border-emerald-800/40', val_cls: 'bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent' },
                { label: "Today's P&L", value: fmt$(totals.dayGain, 0), sub: fmtPct((totals.dayGain / totals.cost) * 100) + ' of cost',
                  icon: totals.dayGain >= 0 ? TrendingUp : TrendingDown,
                  grad: totals.dayGain >= 0 ? 'from-emerald-500/10 to-green-500/5' : 'from-red-500/10 to-rose-500/5',
                  border: totals.dayGain >= 0 ? 'border-emerald-800/40' : 'border-red-800/40',
                  val_cls: totals.dayGain >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Cash Reserve', value: fmt$(PORTFOLIO.cashValue, 0), sub: ((PORTFOLIO.cashValue / totalWithCash) * 100).toFixed(1) + '% of portfolio',
                  icon: Shield, grad: 'from-sky-500/10 to-blue-500/5', border: 'border-sky-800/40', val_cls: 'text-sky-400' },
                { label: 'Total Return', value: fmtPct((totals.gain / totals.cost) * 100), sub: 'cost basis ' + fmt$(totals.cost, 0),
                  icon: BarChart2, grad: totals.gain >= 0 ? 'from-emerald-500/10 to-teal-500/5' : 'from-red-500/10 to-rose-500/5',
                  border: totals.gain >= 0 ? 'border-emerald-800/40' : 'border-red-800/40',
                  val_cls: totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400' },
              ].map(k => (
                <div key={k.label} className={`relative rounded-xl bg-gradient-to-br ${k.grad} border ${k.border} backdrop-blur-xl p-4 card-glow`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">{k.label}</span>
                    <k.icon className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
                  </div>
                  <div className={`text-2xl font-extrabold tabular-nums ${k.val_cls}`}>{k.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Fear & Greed inline */}
            {fearGreed && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-900/50 border border-gray-800/60 text-sm">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Fear&nbsp;&amp;&nbsp;Greed</span>
                <div className="flex-1 max-w-48">
                  <div className="rsi-bar-track">
                    <div className="rsi-thumb" style={{ left: `${fearGreed.value}%` }} />
                  </div>
                </div>
                <span className="font-bold text-white tabular-nums">{fearGreed.value}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${fearGreed.value >= 60 ? 'signal-bull' : fearGreed.value <= 40 ? 'signal-bear' : 'signal-neut'}`}>
                  {fearGreed.label}
                </span>
              </div>
            )}

            {/* Positions table with sparklines */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 card-glow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">
                  Positions
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-gray-700/40 text-gray-400 text-xs bg-gray-900/60 backdrop-blur-sm">
                      {['Symbol','Trend','Qty','Avg Cost','Live Price','Value','Today','Total G/L','Total %','Wt%','Rating'].map(h => (
                        <th key={h}
                            onClick={() => h !== 'Trend' && requestSort(h)}
                            className={`py-2 px-3 font-medium ${h === 'Trend' ? '' : 'cursor-pointer hover:text-white transition-colors'} ${h === 'Symbol' ? 'text-left' : 'text-right'} ${h === 'Rating' ? '!text-center' : ''} ${h === 'Trend' ? 'text-center' : ''}`}>
                          <div className={`flex items-center gap-1 ${h === 'Symbol' ? 'justify-start' : h === 'Rating' || h === 'Trend' ? 'justify-center' : 'justify-end'}`}>
                            {h}
                            {sortConfig?.key === h && <span className="text-emerald-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEnriched.map(pos => {
                      const ta = TA_DATA[pos.symbol];
                      const up = pos.liveGainPct >= 0;
                      // mini fake sparkline based on cost vs live price
                      const spk = ta
                        ? [ta.w52lo, ta.ma200, ta.ma50, ta.price * 0.97, ta.price]
                        : [pos.avgCost * 0.9, pos.avgCost, (pos.avgCost + pos.livePrice) / 2, pos.livePrice * 0.99, pos.livePrice];
                      return (
                        <tr key={pos.symbol} className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{pos.symbol}</div>
                            <div className="text-xs text-gray-500 max-w-[110px] truncate">{pos.description}</div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Sparkline data={spk} up={up} width={52} height={20} />
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-300 tabular-nums">{pos.qty}</td>
                          <td className="py-2.5 px-3 text-right text-gray-400 tabular-nums">{fmt$(pos.avgCost)}</td>
                          <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                            <div className="text-white">{fmt$(pos.livePrice)}</div>
                            {prices[pos.symbol] && <div className="text-xs"><Delta v={prices[pos.symbol].change_pct} /></div>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-white tabular-nums">{fmt$(pos.liveValue, 0)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums"><Delta v={pos.livePct} /></td>
                          <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${pos.liveGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt$(pos.liveGain, 0)}
                          </td>
                          <td className={`py-2.5 px-3 text-right tabular-nums ${pos.liveGainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtPct(pos.liveGainPct)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-400 tabular-nums">
                            {((pos.liveValue / (totalWithCash - PORTFOLIO.cashValue)) * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${ratingBadge(pos.rating)}`}>
                              {pos.rating.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: TECHNICAL ANALYSIS
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'technicals' && (
          <div className="space-y-5">
            {/* Header context */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Technical Analysis Dashboard</h2>
                <p className="text-xs text-gray-500 mt-0.5">RSI · Moving Averages · 52-Week Range · Signal — Live via Yahoo Finance · Updated {PORTFOLIO.asOf}</p>
              </div>
              <div className="text-xs text-gray-600 hidden md:block">us-stock-analysis skill · backtesting-trading-strategies skill</div>
            </div>

            {/* Signal summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {(['Bullish','Mixed','Bearish'] as const).map(sig => {
                const count = Object.values(TA_DATA).filter(d => d.signal === sig).length;
                return (
                  <div key={sig} className={`rounded-xl p-3 text-center border ${sig === 'Bullish' ? 'bg-emerald-950/40 border-emerald-800/40' : sig === 'Bearish' ? 'bg-red-950/40 border-red-800/40' : 'bg-amber-950/30 border-amber-800/40'}`}>
                    <div className={`text-2xl font-extrabold tabular-nums ${sig === 'Bullish' ? 'text-emerald-400' : sig === 'Bearish' ? 'text-red-400' : 'text-amber-400'}`}>{count}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{sig}</div>
                  </div>
                );
              })}
            </div>

            {/* Per-stock TA cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(TA_DATA).map(([sym, d]) => {
                const rsiColor = d.rsi14 >= 70 ? 'text-red-400' : d.rsi14 <= 30 ? 'text-emerald-400' : 'text-yellow-300';
                const rsiLabel = d.rsi14 >= 70 ? 'Overbought' : d.rsi14 <= 30 ? 'Oversold' : 'Neutral';
                const rangePct = ((d.price - d.w52lo) / (d.w52hi - d.w52lo)) * 100;
                const sigCls = d.signal === 'Bullish' ? 'signal-bull' : d.signal === 'Bearish' ? 'signal-bear' : 'signal-neut';
                return (
                  <div key={sym} className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/60 rounded-xl p-4 card-glow space-y-3">
                    {/* Symbol + signal */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-white text-lg">{sym}</div>
                        <div className="text-xs text-gray-500 tabular-nums">{fmt$(d.price, 2)}</div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${sigCls}`}>{d.signal}</span>
                    </div>

                    {/* 52-week range bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>52W Lo {fmt$(d.w52lo, 0)}</span>
                        <span className="text-gray-400 font-semibold">{rangePct.toFixed(0)}% of range</span>
                        <span>Hi {fmt$(d.w52hi, 0)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-800 relative overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-400"
                          style={{ width: `${Math.min(100, rangePct)}%` }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-gray-900 shadow"
                          style={{ left: `calc(${Math.min(98, rangePct)}% - 4px)` }} />
                      </div>
                    </div>

                    {/* RSI gauge */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">RSI 14</span>
                        <span className={`text-xs font-bold ${rsiColor}`}>{d.rsi14} — {rsiLabel}</span>
                      </div>
                      <div className="rsi-bar-track">
                        <div className="rsi-thumb" style={{ left: `${d.rsi14}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                        <span>30 Oversold</span><span>70 Overbought</span>
                      </div>
                    </div>

                    {/* MA signals */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'vs 50-day MA', val: d.vs50, ma: d.ma50 },
                        { label: 'vs 200-day MA', val: d.vs200, ma: d.ma200 },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-800/60 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-gray-500 mb-0.5">{m.label}</div>
                          <div className={`font-bold tabular-nums text-sm ${m.val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {m.val >= 0 ? '+' : ''}{m.val.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-gray-600 tabular-nums">{fmt$(m.ma, 0)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Action hint from us-stock-analysis framework */}
                    <div className={`text-xs rounded-lg px-3 py-2 ${
                      d.rsi14 >= 75 ? 'bg-red-950/50 text-red-300 border border-red-900/40' :
                      d.rsi14 <= 35 ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-900/40' :
                      d.vs50 < 0 && d.vs200 < 0 ? 'bg-red-950/30 text-red-400 border border-red-900/30' :
                      'bg-gray-800/50 text-gray-400 border border-gray-700/40'
                    }`}>
                      {d.rsi14 >= 75 ? `⚠ RSI overbought (${d.rsi14}) — consider trimming or waiting for pullback` :
                       d.rsi14 <= 35 ? `✦ RSI oversold (${d.rsi14}) — potential accumulation zone` :
                       d.vs50 < 0 && d.vs200 < 0 ? '↓ Below both MAs — downtrend confirmed, avoid adding' :
                       d.signal === 'Bullish' ? `↑ Price > 50d > 200d MA — uptrend intact` :
                       'Mixed signals — watch for MA crossover confirmation'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Backtest insight from backtesting-trading-strategies skill */}
            <Card className="bg-gray-900/40 border-gray-800/60 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  Strategy Backtest Context (1Y · Daily · backtesting-trading-strategies skill)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PRECOMPUTED_BT.map((bt, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2.5 text-xs">
                      <div>
                        <span className="font-bold text-white">{bt.symbol.replace('-USD','')}</span>
                        <span className="text-gray-500 ml-1.5">{bt.strategy}</span>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold tabular-nums ${bt.total_return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {bt.total_return_pct >= 0 ? '+' : ''}{bt.total_return_pct.toFixed(1)}%
                        </div>
                        <div className="text-gray-600">Sharpe {bt.sharpe_ratio.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Key finding: Buy-and-hold outperforms all active strategies for trending tech/crypto. Use RSI &lt;35 as accumulation signal, &gt;75 as trim signal.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: RISK & ANALYSIS
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'analysis' && risk && (
          <div className="space-y-4">
            {/* Risk KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Portfolio Beta', value: risk.beta.toFixed(2), sub: risk.beta > 1.2 ? 'High volatility vs market' : 'Near-market volatility', icon: Activity, color: risk.beta > 1.5 ? 'text-orange-400' : 'text-white' },
                { label: 'Sharpe Ratio',   value: risk.sharpe.toFixed(2), sub: risk.sharpe > 1 ? 'Good risk-adjusted return' : 'Below target (>1)', icon: Target, color: risk.sharpe >= 1 ? 'text-emerald-400 font-semibold tabular-nums' : 'text-yellow-400' },
                { label: '1-Day VaR 95%', value: `-${risk.var95.toFixed(2)}%`, sub: `~${fmt$(totalWithCash * risk.var95 / 100, 0)} worst day`, icon: Shield, color: 'text-red-400 font-semibold tabular-nums' },
                { label: 'Annual Alpha',   value: `${risk.alpha >= 0 ? '+' : ''}${risk.alpha.toFixed(1)}%`, sub: 'vs SPY benchmark', icon: TrendingUp, color: risk.alpha >= 0 ? 'text-emerald-400 font-semibold tabular-nums' : 'text-red-400 font-semibold tabular-nums' },
              ].map(k => (
                <Card key={k.label} className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{k.label}</span>
                      <k.icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                    <div className={`text-2xl font-extrabold tabular-nums ${k.color}`}>{k.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Custom metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'AI Exposure', value: risk.aiExposurePct, icon: Brain, description: 'Positions with AI-score ≥ 60%', warn: risk.aiExposurePct > 70 ? 'Highly concentrated in AI theme' : undefined },
                { label: 'Semiconductor %', value: risk.semiconductorPct, icon: Cpu, description: 'NVDA, TSM, AVGO, AMD, INTC, QCOM, TXN', warn: risk.semiconductorPct > 40 ? 'High sector concentration' : undefined },
                { label: 'China Risk', value: risk.chinaRiskPct, icon: AlertTriangle, description: 'BABA + TSM Taiwan exposure', warn: risk.chinaRiskPct > 15 ? 'Geopolitical exposure elevated' : undefined },
              ].map(m => (
                <Card key={m.label} className={`bg-gray-900 border-gray-800 ${m.warn ? 'border-yellow-700' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <m.icon className="h-5 w-5 text-violet-400" />
                      <span className="font-semibold text-white">{m.label}</span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-3xl font-bold text-white">{m.value}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                      <div className={`h-2 rounded-full ${m.value > 60 ? 'bg-red-500' : m.value > 40 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(m.value, 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-400">{m.description}</p>
                    {m.warn && <p className="text-xs text-yellow-400 mt-1">⚠ {m.warn}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sector allocation chart */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sectorData} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tickFormatter={v => fmt$(v, 0)} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 12 }} width={90} />
                    <Tooltip formatter={(v: number) => fmt$(v, 0)} contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Concentration warnings */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-yellow-400 text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Concentration & Risk Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  {enriched.filter(p => (p.liveValue / (totalWithCash - PORTFOLIO.cashValue)) > 0.10).map(p => (
                    <li key={p.symbol} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-white">{p.symbol}</strong> is {((p.liveValue / (totalWithCash - PORTFOLIO.cashValue)) * 100).toFixed(1)}% of portfolio — above 10% threshold</span>
                    </li>
                  ))}
                  {enriched.filter(p => getMeta(p.symbol).beta > 1.8).length > 3 && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span>Multiple high-beta positions (TSLA, COIN, SOUN, NVDA) — portfolio volatility is elevated</span>
                    </li>
                  )}
                  {risk.chinaRiskPct > 10 && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span>China/Taiwan geopolitical exposure: {risk.chinaRiskPct}% — BABA + TSM combined</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: BACKTEST / SIGNALS
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'signals' && (
          <div className="space-y-6">

            {/* ── Section 1: Smart Money Signals (Binance on-chain) ──────── */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                      Smart Money Signals
                    </span>
                    <span className="text-xs font-normal text-gray-500 ml-1">via Binance on-chain · public API · no auth</span>
                  </CardTitle>
                  <Button size="sm" variant="outline" className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-xs"
                    onClick={fetchSmartSignals} disabled={loadingSignals}>
                    <RefreshCw className={`h-3 w-3 mr-1.5 ${loadingSignals ? 'animate-spin' : ''}`} />
                    {loadingSignals ? 'Loading…' : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSignals && (
                  <div className="py-10 text-center text-gray-400 animate-pulse text-sm">Fetching on-chain signals from Binance…</div>
                )}
                {!loadingSignals && smartSignals && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {[
                      { chain: 'Solana', signals: smartSignals.sol, color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-800/40' },
                      { chain: 'BSC',    signals: smartSignals.bsc, color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-800/40' },
                    ].map(({ chain, signals, color, bg, border }) => (
                      <div key={chain}>
                        <div className={`text-xs font-semibold uppercase tracking-wider ${color} mb-3 flex items-center gap-2`}>
                          <span className={`w-2 h-2 rounded-full inline-block ${color.replace('text-', 'bg-')} animate-pulse`} />
                          {chain} — Active Smart Money Buys
                        </div>
                        {signals.length === 0 ? (
                          <div className="text-gray-600 text-sm py-4 text-center">No active signals right now</div>
                        ) : (
                          <div className="space-y-2">
                            {signals.map(sig => {
                              const gain = parseFloat(sig.maxGain ?? '0');
                              const alertP = parseFloat(sig.alertPrice ?? '0');
                              const curP   = parseFloat(sig.currentPrice ?? '0');
                              const pct    = alertP > 0 ? ((curP - alertP) / alertP) * 100 : 0;
                              return (
                                <div key={sig.signalId} className={`flex items-center gap-3 rounded-lg border ${border} ${bg} px-3 py-2.5`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-white text-sm truncate">{sig.ticker || '—'}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${sig.direction === 'buy' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
                                        {sig.direction?.toUpperCase()}
                                      </span>
                                      {sig.launchPlatform && (
                                        <span className="text-xs text-gray-500 hidden sm:inline">{sig.launchPlatform}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                      <span>Smart wallets: <span className="text-white font-medium">{sig.smartMoneyCount}</span></span>
                                      <span>Exit rate: <span className={`font-medium ${sig.exitRate >= 70 ? 'text-red-400 font-semibold tabular-nums' : 'text-gray-300'}`}>{sig.exitRate}%</span></span>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className={`text-sm font-bold tabular-nums ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      +{gain.toFixed(1)}% max
                                    </div>
                                    <div className={`text-xs tabular-nums ${pct >= 0 ? 'text-gray-400' : 'text-emerald-400'}`}>
                                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs trigger
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!loadingSignals && !smartSignals && (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    Click <strong>Refresh</strong> to load on-chain smart money signals
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-4">Source: Binance Web3 Smart Money API · Solana (CT_501) &amp; BSC (56) · Active signals only · Not financial advice</p>
              </CardContent>
            </Card>

            {/* ── Section 2: Pre-computed Strategy Backtests ─────────────── */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" /> Strategy Analysis — 1-Year Backtest
                  <span className="text-xs font-normal text-gray-500">· backtesting-trading-strategies skill · yfinance · daily candles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
                  <Brain className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
                  <div>
                    <strong className="text-amber-300">Key insight (us-stock-analysis skill):</strong> Buy &amp; Hold dominates active strategies for high-beta crypto — BTC +82%+ (1Y) vs MACD +2.1%, RSI +1.5%.
                    Active strategies consistently underperform during strong trending markets. Use signals as confirmation, not entry triggers.
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {PRECOMPUTED_BT.map((bt, i) => (
                    <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-white">{bt.symbol.replace('-USD', '')}</div>
                          <div className="text-xs text-gray-500">{bt.strategy} · 1Y · Daily</div>
                        </div>
                        <span className={`text-lg font-bold tabular-nums ${bt.total_return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {bt.total_return_pct >= 0 ? '+' : ''}{bt.total_return_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {([
                          ['Win Rate',  `${bt.win_rate_pct.toFixed(0)}%`,       bt.win_rate_pct >= 55 ? 'text-emerald-400' : 'text-yellow-400'],
                          ['Sharpe',    bt.sharpe_ratio.toFixed(2),              bt.sharpe_ratio >= 1 ? 'text-emerald-400' : bt.sharpe_ratio >= 0 ? 'text-yellow-400' : 'text-red-400'],
                          ['Max DD',    `${bt.max_drawdown_pct.toFixed(1)}%`,    'text-red-400'],
                          ['Trades',   String(bt.total_trades),                 'text-white'],
                        ] as [string, string, string][]).map(([label, val, col]) => (
                          <div key={label} className="bg-gray-900/60 rounded p-2">
                            <div className="text-gray-500 mb-0.5">{label}</div>
                            <div className={`font-semibold ${col}`}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Section 3: Live Backtest Engine (Render API) ───────────── */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-400" /> Live Backtest Engine
                    <span className="text-xs font-normal text-gray-500">· RSI strategy · top 10 holdings · Render API</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {serverStatus === 'warming' && (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Server warming up…
                      </span>
                    )}
                    <Button size="sm" className="bg-emerald-800 hover:bg-emerald-700 text-xs" onClick={runBacktests} disabled={loadingBT || serverStatus === 'warming'}>
                      <Activity className={`h-3.5 w-3.5 mr-1.5 ${loadingBT ? 'animate-spin' : ''}`} />
                      {loadingBT ? 'Running…' : 'Run Live Backtests'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {serverStatus === 'warming' && Object.keys(backtests).length === 0 && !loadingBT && (
                  <div className="py-8 text-center text-amber-400/70 text-sm">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                    Waiting for backend server to come online…
                  </div>
                )}
                {serverStatus !== 'warming' && Object.keys(backtests).length === 0 && !loadingBT && (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    Click <strong className="text-gray-300">Run Live Backtests</strong> to run RSI strategy against your top 10 holdings via the Render backend
                  </div>
                )}
                {loadingBT && (
                  <div className="py-8 text-center text-gray-400 animate-pulse text-sm">Running backtests via Render API…</div>
                )}
                {Object.keys(backtests).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Object.values(backtests).map(bt => (
                      <div key={(bt as any).symbol ?? bt.total_trades} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-bold text-white">{(bt as any).symbol ?? '—'}</div>
                            <div className="text-xs text-gray-500">RSI · 1Y · Daily</div>
                          </div>
                          <span className={`text-lg font-bold tabular-nums ${(bt.total_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtPct(bt.total_return_pct ?? 0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {([
                            ['Win Rate',  `${(bt.win_rate_pct ?? 0).toFixed(0)}%`,       (bt.win_rate_pct ?? 0) >= 55 ? 'text-emerald-400' : 'text-yellow-400'],
                            ['Sharpe',    (bt.sharpe_ratio ?? 0).toFixed(2),              (bt.sharpe_ratio ?? 0) >= 1 ? 'text-emerald-400' : 'text-yellow-400'],
                            ['Max DD',    `${(bt.max_drawdown_pct ?? 0).toFixed(1)}%`,    'text-red-400'],
                            ['Trades',   String(bt.total_trades ?? 0),                   'text-white'],
                          ] as [string, string, string][]).map(([label, val, col]) => (
                            <div key={label} className="bg-gray-900/60 rounded p-2">
                              <div className="text-gray-500 mb-0.5">{label}</div>
                              <div className={`font-semibold ${col}`}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: MONTE CARLO 6-MONTH
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'montecarlo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">1,000 simulations · 126 trading days (~6 months) · GBM with per-stock drift/vol estimates</p>
              <Button size="sm" className="bg-violet-800 hover:bg-violet-700" onClick={computeMonteCarlo}>
                <Zap className="h-4 w-4 mr-2" /> Re-run Simulation
              </Button>
            </div>

            {monteCarlo && (
              <>
                {/* Outcome summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Bear Case (10th pct)', value: fmt$(monteCarlo.p10, 0), change: fmtPct(((monteCarlo.p10 - totals.value) / totals.value) * 100), color: 'text-red-400 font-semibold tabular-nums' },
                    { label: 'Median Outcome',        value: fmt$(monteCarlo.median, 0), change: fmtPct(((monteCarlo.median - totals.value) / totals.value) * 100), color: 'text-white' },
                    { label: 'Bull Case (90th pct)', value: fmt$(monteCarlo.p90, 0), change: fmtPct(((monteCarlo.p90 - totals.value) / totals.value) * 100), color: 'text-emerald-400 font-semibold tabular-nums' },
                  ].map(c => (
                    <Card key={c.label} className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
                      <CardContent className="pt-4">
                        <div className="text-xs text-gray-400 mb-1">{c.label}</div>
                        <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                        <div className={`text-sm ${c.color}`}>{c.change} from today</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Path chart */}
                <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Portfolio Value Distribution (6 Months)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={mcChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="day" tickFormatter={d => `Day ${d}`} tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis tickFormatter={v => fmt$(v, 0)} tick={{ fill: '#6b7280', fontSize: 11 }} width={80} />
                        <Tooltip formatter={(v: number) => fmt$(v, 0)} contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                        <ReferenceLine y={totals.value} stroke="#4b5563" strokeDasharray="4 4" label={{ value: 'Today', fill: '#9ca3af', fontSize: 11 }} />
                        <Area type="monotone" dataKey="p90"    stroke="#10b981" strokeWidth={1.5} fill="#10b981" fillOpacity={0.08} dot={false} name="Bull (P90)" />
                        <Area type="monotone" dataKey="median" stroke="#6366f1" strokeWidth={2}   fill="#6366f1" fillOpacity={0.15} dot={false} name="Median" />
                        <Area type="monotone" dataKey="p10"    stroke="#ef4444" strokeWidth={1.5} fill="#ef4444" fillOpacity={0.08} dot={false} name="Bear (P10)" />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-600 mt-2">
                      ⚠️ Monte Carlo simulation uses historical volatility estimates. Not financial advice.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {!monteCarlo && (
              <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
                <CardContent className="py-16 text-center text-gray-500">
                  Running simulation… (auto-starts when tab opens)
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: RECOMMENDATIONS
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'recommendations' && (
          <div className="space-y-4">
            {/* Priority actions */}
            <Card className="bg-gray-900 border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-400 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" /> Immediate Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  {[
                    { n: 1, color: 'bg-red-700', text: <><strong className="text-white">Exit SOUN</strong> — -46% unrealized loss ({fmt$(enriched.find(p => p.symbol === 'SOUN')?.liveGain ?? 0, 0)}). No clear path to profitability. Redeploy into META or PLTR.</> },
                    { n: 2, color: 'bg-red-700', text: <><strong className="text-white">Exit BABA</strong> — -25.6% with structural China headwinds. US ADR delisting risk persists.</> },
                    { n: 3, color: 'bg-orange-700', text: <><strong className="text-white">Review ORCL</strong> — -33% loss. Set 3-month target $220. Exit if not reached by Q3 2026.</> },
                    { n: 4, color: 'bg-amber-700', text: <><strong className="text-white">Trim INTC</strong> — Your +236% gain on $19.54 avg is exceptional. Intel is losing datacenter share. Partial profit-taking is prudent.</> },
                    { n: 5, color: 'bg-blue-700', text: <><strong className="text-white">Redeploy proceeds</strong> → META, PLTR, ARM (2-3% each). AI leaders with better competitive positioning.</> },
                  ].map(item => (
                    <li key={item.n} className="flex gap-3 items-start">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full ${item.color} text-white flex items-center justify-center text-xs font-bold`}>{item.n}</span>
                      <span className="text-gray-300">{item.text}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* All holdings recs */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-400" /> 6-Month Action Plan — All Holdings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {RECOMMENDATIONS.map(rec => (
                    <div key={rec.symbol} className={`border rounded-lg p-3 ${actionBadge(rec.action)}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{rec.symbol}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${actionBadge(rec.action)}`}>{rec.action}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-gray-500">{rec.horizon}</div>
                          <div className={`text-xs font-medium ${rec.risk === 'Low' ? 'text-green-400' : rec.risk === 'Medium' ? 'text-yellow-400' : 'text-red-400 font-semibold tabular-nums'}`}>{rec.risk} risk</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{rec.thesis}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* New ideas */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-400 text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> New Positions for 6-Month Horizon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  {NEW_STOCK_IDEAS.map(idea => (
                    <div key={idea.symbol} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white">{idea.symbol}</span>
                        <span className="text-xs text-emerald-400">{idea.targetAlloc}</span>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">{idea.name}</div>
                      <p className="text-xs text-gray-300 leading-relaxed">{idea.thesis}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: MARKETS
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'market' && (
          <div className="space-y-4">
            {!snapshot && <p className="text-gray-500 text-center py-12">Loading market data…</p>}
            {snapshot && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'US Indices', data: snapshot.indices },
                  { title: 'Crypto',     data: snapshot.crypto },
                  { title: 'ETFs',       data: snapshot.etfs },
                ].map(group => (
                  <Card key={group.title} className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
                    <CardHeader className="pb-2"><CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">{group.title}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {group.data.map(item => (
                        <div key={item.symbol} className="flex items-center justify-between py-1 border-b border-gray-800 last:border-0">
                          <span className="text-gray-300 text-sm font-medium">{item.symbol}</span>
                          <div className="text-right">
                            <div className="text-white text-sm">{item.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                            <Delta v={item.change_pct} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: ALERTS
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'alerts' && (
          <div className="space-y-4">
            {/* New alert form */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Bell className="h-4 w-4 text-yellow-400" /> Create Price Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Symbol</label>
                    <select value={newAlertSym} onChange={e => setNewAlertSym(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
                      {PORTFOLIO.positions.map(p => <option key={p.symbol}>{p.symbol}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Condition</label>
                    <select value={newAlertType} onChange={e => setNewAlertType(e.target.value as typeof newAlertType)}
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
                      <option value="above">Price above</option>
                      <option value="below">Price below</option>
                      <option value="change_pct">Change % exceeds</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Threshold</label>
                    <input type="number" value={newAlertThreshold} onChange={e => setNewAlertThreshold(e.target.value)}
                      placeholder={newAlertType === 'change_pct' ? '5 (%)' : '200 ($)'}
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm w-32" />
                  </div>
                  <Button size="sm" className="bg-yellow-700 hover:bg-yellow-600"
                    onClick={() => {
                      if (!newAlertThreshold) return;
                      addAlert({ symbol: newAlertSym, type: newAlertType, threshold: parseFloat(newAlertThreshold) });
                      setNewAlertThreshold('');
                    }}>
                    <Bell className="h-4 w-4 mr-1" /> Add Alert
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Active alerts */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Active Alerts ({alerts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No alerts set. Create one above.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.map(a => {
                      const live = prices[a.symbol]?.price;
                      return (
                        <div key={a.id} className={`flex items-center justify-between p-3 rounded border ${a.triggered ? 'border-red-700 bg-red-950/30' : 'border-gray-700 bg-gray-800'}`}>
                          <div className="text-sm">
                            <span className="font-bold text-white">{a.symbol}</span>
                            <span className="text-gray-400 ml-2">
                              {a.type === 'above' ? 'above' : a.type === 'below' ? 'below' : 'change >'}{' '}
                              <strong>{a.threshold}{a.type === 'change_pct' ? '%' : ''}</strong>
                            </span>
                            {live && <span className="text-gray-500 ml-3 text-xs">Current: {fmt$(live)}</span>}
                            {a.triggered && <Badge className="ml-2 bg-red-700 text-white text-xs">TRIGGERED</Badge>}
                          </div>
                          <button onClick={() => removeAlert(a.id)} className="text-gray-600 hover:text-red-400">
                            <BellOff className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Watchlist buy-zone alerts */}
            <Card className="bg-gray-900 border-emerald-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-400 text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" /> Watchlist Buy-Zone Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
              {/* ── Crypto Buy-Zone Alerts ────────────────────────────────── */}
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 backdrop-blur-md p-5 mb-6 ring-1 ring-inset ring-white/5 hover:border-zinc-700/60 transition-all duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <Bitcoin className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Crypto Buy-Zone Alerts</h3>
                </div>
                <div className="grid gap-3">
                  {CRYPTO_ALERTS.map(alert => {
                    const isActive = alerts.some(a => a.symbol === alert.symbol && a.threshold === alert.threshold);
                    return (
                      <div key={alert.symbol} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-zinc-100 text-sm">{alert.name}</span>
                            <span className="text-xs text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded">{alert.note}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-zinc-500">
                            <span>Entry: <span className="text-zinc-300">{alert.entryZone}</span></span>
                            <span>Alloc: <span className="text-zinc-300">{alert.targetAlloc}</span></span>
                          </div>
                          <p className="text-xs text-zinc-600 mt-1 truncate max-w-md" title={alert.thesis}>{alert.thesis.slice(0, 90)}…</p>
                        </div>
                        <button
                          onClick={() => !isActive && addAlert({ symbol: alert.symbol, type: alert.alertType, threshold: alert.threshold })}
                          disabled={isActive}
                          className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
                              : 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer'
                          }`}
                        >
                          {isActive ? '✓ Alert active' : `Alert < $${alert.threshold.toLocaleString()}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── ETF Buy-Zone Alerts ───────────────────────────────────── */}
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 backdrop-blur-md p-5 mb-6 ring-1 ring-inset ring-white/5 hover:border-zinc-700/60 transition-all duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">ETF Dip-Buy Alerts</h3>
                </div>
                <div className="grid gap-3">
                  {ETF_ALERTS.map(alert => {
                    const isActive = alerts.some(a => a.symbol === alert.symbol && a.threshold === alert.threshold);
                    return (
                      <div key={alert.symbol} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-zinc-100 text-sm">{alert.name} <span className="text-zinc-500 font-normal">({alert.symbol})</span></span>
                            <span className="text-xs text-violet-400 bg-violet-900/30 px-1.5 py-0.5 rounded">{alert.note}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-zinc-500">
                            <span>Entry: <span className="text-zinc-300">{alert.entryZone}</span></span>
                            <span>Alloc: <span className="text-zinc-300">{alert.targetAlloc}</span></span>
                          </div>
                          <p className="text-xs text-zinc-600 mt-1 truncate max-w-md" title={alert.thesis}>{alert.thesis.slice(0, 90)}…</p>
                        </div>
                        <button
                          onClick={() => !isActive && addAlert({ symbol: alert.symbol, type: alert.alertType, threshold: alert.threshold })}
                          disabled={isActive}
                          className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
                              : 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer'
                          }`}
                        >
                          {isActive ? '✓ Alert active' : `Alert < $${alert.threshold.toLocaleString()}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {WATCHLIST_ALERTS.map(wa => {
                  const livePrice = prices[wa.symbol]?.price ?? null;
                  const pctAbove  = livePrice ? ((livePrice - wa.threshold) / wa.threshold) * 100 : null;
                  const alreadySet = alerts.some(a => a.symbol === wa.symbol && a.type === 'below' && Math.abs(a.threshold - wa.threshold) < 1);
                  return (
                    <div key={wa.symbol} className="bg-gray-800 border border-emerald-900/40 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{wa.symbol}</span>
                            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-900 text-emerald-300">{wa.note}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{wa.name}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {livePrice ? (
                            <>
                              <div className="text-white font-bold">{fmt$(livePrice)}</div>
                              <div className="text-xs text-gray-500">
                                {pctAbove !== null && pctAbove > 0
                                  ? <span className="text-orange-400">{pctAbove.toFixed(1)}% above target</span>
                                  : <span className="text-emerald-400 animate-pulse">In buy zone!</span>}
                              </div>
                            </>
                          ) : <div className="text-gray-600 text-xs">No live price</div>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                        <div className="bg-gray-900/60 rounded p-2">
                          <div className="text-gray-500">Entry Zone</div>
                          <div className="text-emerald-400 font-semibold">{wa.entryZone}</div>
                        </div>
                        <div className="bg-gray-900/60 rounded p-2">
                          <div className="text-gray-500">Alert Trigger</div>
                          <div className="text-white font-semibold">{fmt$(wa.threshold)}</div>
                        </div>
                        <div className="bg-gray-900/60 rounded p-2">
                          <div className="text-gray-500">Target Alloc</div>
                          <div className="text-violet-400 font-semibold">{wa.targetAlloc}</div>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed mb-3">{wa.thesis}</p>

                      <Button
                        size="sm"
                        className={alreadySet ? 'bg-gray-700 text-gray-400 cursor-default w-full' : 'bg-emerald-800 hover:bg-emerald-700 w-full'}
                        disabled={alreadySet}
                        onClick={() => {
                          if (!alreadySet) addAlert({ symbol: wa.symbol, type: wa.alertType, threshold: wa.threshold });
                        }}>
                        <Bell className="h-3.5 w-3.5 mr-1.5" />
                        {alreadySet ? `Alert active — notifies below ${fmt$(wa.threshold)}` : `Set alert: notify when ${wa.symbol} drops below ${fmt$(wa.threshold)}`}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Pre-built stop-loss suggestions */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Suggested Stop-Losses (15% trailing)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  {enriched.filter(p => p.totalGainPct > 20).map(p => (
                    <div key={p.symbol} className="flex items-center justify-between bg-gray-800 rounded p-2">
                      <span className="font-bold text-white">{p.symbol}</span>
                      <div className="text-right">
                        <div className="text-gray-300">{fmt$(p.livePrice * 0.85)} stop</div>
                        <div className="text-xs text-emerald-400">{fmt$(p.livePrice)} now</div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-yellow-500 hover:text-yellow-300 text-xs"
                        onClick={() => addAlert({ symbol: p.symbol, type: 'below', threshold: Math.round(p.livePrice * 0.85 * 100) / 100 })}>
                        Set
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: CRYPTO
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'crypto' && (
          <div className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-orange-400 text-base flex items-center gap-2">
                  <Bitcoin className="h-4 w-4" /> Bitcoin Intelligence & Crypto Macro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-gray-800 rounded-2xl p-4 border border-orange-900/30">
                        <div className="text-xs uppercase text-gray-500 mb-2">BTC-USD price</div>
                        <div className="text-3xl font-semibold text-white">
                          {cryptoOverview?.btc_price?.price != null ? (cryptoOverview.btc_price.price >= 1000 ? fmt$(cryptoOverview.btc_price.price, 0) : fmt$(cryptoOverview.btc_price.price, 2)) : 'Loading…'}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {typeof cryptoOverview?.btc_price?.change_pct === 'number' ? `${cryptoOverview.btc_price.change_pct >= 0 ? '+' : ''}${cryptoOverview.btc_price.change_pct.toFixed(2)}%` : ''}
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-2xl p-4 border border-orange-900/30">
                        <div className="text-xs uppercase text-gray-500 mb-2">Bitcoin dominance</div>
                        <div className="text-3xl font-semibold text-white">
                          {cryptoOverview?.bitcoin_dominance_pct != null ? `${cryptoOverview.bitcoin_dominance_pct}%` : '—'}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Market share of total crypto market cap</div>
                      </div>
                      <div className="bg-gray-800 rounded-2xl p-4 border border-orange-900/30">
                        <div className="text-xs uppercase text-gray-500 mb-2">Fear & Greed</div>
                        <div className="text-3xl font-semibold text-white">
                          {cryptoOverview?.fear_greed_index != null ? cryptoOverview.fear_greed_index : '—'}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Sentiment gauge for BTC traders</div>
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-3xl p-4 border border-orange-900/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm uppercase text-gray-500">BTC Price History</div>
                          <div className="text-xs text-gray-400">Updated every 10 seconds</div>
                        </div>
                        <div className="text-sm font-semibold text-white">{btcHistory.length} points</div>
                      </div>
                      {btcHistory.length ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={btcHistory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fill: '#aaa', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#aaa', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} labelStyle={{ color: '#fff' }} />
                            <Line type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-56 flex items-center justify-center text-gray-500">Loading historical BTC data…</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-3xl p-4 border border-orange-900/30">
                      <div className="text-sm uppercase text-gray-500 mb-3">Exchange flow snapshot</div>
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <div className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
                          <div className="text-gray-400 text-xs uppercase">Inflow 24h</div>
                          <div className="text-lg font-semibold text-white">{cryptoOverview?.exchange_flows?.inflow_24h ?? '—'} BTC</div>
                        </div>
                        <div className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
                          <div className="text-gray-400 text-xs uppercase">Outflow 24h</div>
                          <div className="text-lg font-semibold text-white">{cryptoOverview?.exchange_flows?.outflow_24h ?? '—'} BTC</div>
                        </div>
                        <div className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
                          <div className="text-gray-400 text-xs uppercase">Net flow</div>
                          <div className="text-lg font-semibold text-white">{cryptoOverview?.exchange_flows?.net_flow_24h ?? '—'} BTC</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">Source: {cryptoOverview?.exchange_flows?.source ?? 'CoinGecko / mock data'}</div>
                      {cryptoOverview?.large_transactions?.length ? (
                        <div className="mt-4 space-y-3">
                          <div className="text-sm font-semibold text-white">Large BTC transactions</div>
                          {cryptoOverview.large_transactions.slice(0, 2).map(tx => (
                            <div key={tx.hash} className="rounded-2xl bg-gray-900 p-3 border border-gray-800">
                              <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                                <span>{tx.timestamp.replace('T', ' ').replace('Z', '')}</span>
                                <span>{tx.value_btc.toFixed(0)} BTC</span>
                              </div>
                              <div className="mt-2 text-sm text-white">{tx.from_address} → {tx.to_address}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="bg-gray-800 rounded-3xl p-4 border border-orange-900/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm uppercase text-gray-500">BTC strategy research</div>
                          <div className="text-xs text-gray-400">Best performing strategy over 1 year</div>
                        </div>
                        <Badge className="bg-emerald-700 text-white">{cryptoResearch?.winner?.replace('_', ' ').toUpperCase() ?? 'Loading'}</Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {cryptoResearch?.ranking?.slice(0, 3).map(item => (
                          <div key={item.strategy} className="rounded-2xl bg-gray-900 p-3 border border-gray-800">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs text-gray-400 uppercase">{item.strategy_label}</div>
                                <div className="font-semibold text-white">{item.strategy.replace('_', ' ').toUpperCase()}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-white font-semibold">{item.total_return_pct?.toFixed(2)}%</div>
                                <div className="text-xs text-gray-500">Rank {item.rank}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {!cryptoResearch?.ranking?.length && (
                          <div className="text-sm text-gray-500">Research data is loading or unavailable.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top 5 Recommendations */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-orange-400 text-base flex items-center gap-2">
                  <Bitcoin className="h-4 w-4" /> Top 5 Cryptos for Long-Term Investment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {CRYPTO_RECOMMENDATIONS.map((rec, i) => {
                    const live = cryptoPrices[rec.symbol];
                    return (
                      <div key={rec.symbol} className="bg-gray-800 border border-orange-900/40 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-orange-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                            <div>
                              <div className="font-bold text-white">{rec.name}</div>
                              <div className="text-xs text-gray-500">{rec.symbol.replace('-USD', '')}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            {live ? (
                              <>
                                <div className="text-white font-bold text-sm">
                                  {live.price >= 1000 ? fmt$(live.price, 0) : live.price >= 1 ? fmt$(live.price, 2) : `$${live.price.toFixed(4)}`}
                                </div>
                                <Delta v={live.change_pct} />
                              </>
                            ) : <div className="text-gray-600 text-xs animate-pulse">Loading…</div>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 rounded border font-semibold border-emerald-500 text-emerald-300 bg-emerald-900/30">{rec.action}</span>
                          <span className="text-xs text-gray-500">{rec.horizon}</span>
                          <span className={`text-xs font-medium ${rec.risk === 'Medium' ? 'text-yellow-400' : rec.risk === 'High' ? 'text-red-400 font-semibold tabular-nums' : 'text-green-400'}`}>{rec.risk} risk</span>
                          <span className="text-xs text-orange-400 ml-auto font-medium">{rec.targetAlloc}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{rec.thesis}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Full watchlist table */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Coins className="h-4 w-4 text-orange-400" /> Crypto Watchlist — Live Prices
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/40 text-gray-400 text-xs bg-gray-900/60 backdrop-blur-sm sticky top-[4rem] z-10 shadow-sm">
                      {['Asset', 'Tags', 'Price', '24h Change', 'Rating'].map(h => (
                        <th key={h} className={`py-2 px-3 ${h === 'Asset' || h === 'Tags' ? 'text-left' : 'text-right'} ${h === 'Rating' ? '!text-center' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CRYPTO_WATCHLIST.map(c => {
                      const live = cryptoPrices[c.symbol];
                      const isTop5 = CRYPTO_RECOMMENDATIONS.some(r => r.symbol === c.symbol);
                      return (
                        <tr key={c.symbol} className={`border-b border-gray-800/40 hover:bg-gray-800/40 transition-all duration-300 group ${isTop5 ? 'bg-orange-950/10' : ''}`}>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {isTop5
                                ? <Bitcoin className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                                : <div className="w-3.5 h-3.5 flex-shrink-0" />
                              }
                              <div>
                                <div className="font-semibold text-white">{c.name}</div>
                                <div className="text-xs text-gray-500">{c.symbol.replace('-USD', '')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {c.tags.map(tag => <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{tag}</span>)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-white font-medium">
                            {live
                              ? live.price >= 1000 ? fmt$(live.price, 0)
                                : live.price >= 1 ? fmt$(live.price, 2)
                                : `$${live.price.toFixed(4)}`
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {live ? <Delta v={live.change_pct} /> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${ratingBadge(c.rating)}`}>
                              {c.rating.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            TAB: ETFs
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'etfs' && (
          <div className="space-y-4">
            {/* Top 5 Recommendations */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-violet-400 text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Top 5 ETFs for Long-Term Investment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ETF_RECOMMENDATIONS.map((rec, i) => {
                    const live = etfPrices[rec.symbol];
                    return (
                      <div key={rec.symbol} className="bg-gray-800 border border-violet-900/40 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-violet-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                            <div>
                              <div className="font-bold text-white">{rec.symbol}</div>
                              <div className="text-xs text-gray-500 max-w-[140px] truncate">{rec.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            {live ? (
                              <>
                                <div className="text-white font-bold text-sm">{fmt$(live.price, 2)}</div>
                                <Delta v={live.change_pct} />
                              </>
                            ) : <div className="text-gray-600 text-xs animate-pulse">Loading…</div>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 rounded border font-semibold border-emerald-500 text-emerald-300 bg-emerald-900/30">{rec.action}</span>
                          <span className="text-xs text-gray-500">{rec.horizon}</span>
                          <span className={`text-xs font-medium ${rec.risk === 'Low' ? 'text-green-400' : rec.risk.includes('Medium') ? 'text-yellow-400' : 'text-red-400 font-semibold tabular-nums'}`}>{rec.risk}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2 text-xs">
                          <span className="text-gray-500">Expense: <span className="text-gray-300 font-medium">{rec.expenseRatio}</span></span>
                          <span className="text-violet-400 font-medium">{rec.targetAlloc}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{rec.thesis}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Full watchlist table */}
            <Card className="bg-gray-900/40 backdrop-blur-xl border-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-emerald-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" /> ETF Watchlist — Live Prices
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/40 text-gray-400 text-xs bg-gray-900/60 backdrop-blur-sm sticky top-[4rem] z-10 shadow-sm">
                      {['Fund', 'Sector', 'Tags', 'Price', '24h', 'Expense', 'Rating'].map(h => (
                        <th key={h} className={`py-2 px-3 ${['Fund', 'Sector', 'Tags'].includes(h) ? 'text-left' : 'text-right'} ${h === 'Rating' ? '!text-center' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ETF_WATCHLIST.map(etf => {
                      const live = etfPrices[etf.symbol];
                      const isTop5 = ETF_RECOMMENDATIONS.some(r => r.symbol === etf.symbol);
                      const rec = ETF_RECOMMENDATIONS.find(r => r.symbol === etf.symbol);
                      return (
                        <tr key={etf.symbol} className={`border-b border-gray-800/40 hover:bg-gray-800/40 transition-all duration-300 group ${isTop5 ? 'bg-violet-950/10' : ''}`}>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {isTop5
                                ? <Layers className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                                : <div className="w-3.5 h-3.5 flex-shrink-0" />
                              }
                              <div>
                                <div className="font-semibold text-white">{etf.symbol}</div>
                                <div className="text-xs text-gray-500 max-w-[130px] truncate">{etf.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 text-xs">{etf.sector}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {etf.tags.map(tag => <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{tag}</span>)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-white font-medium">
                            {live ? fmt$(live.price, 2) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {live ? <Delta v={live.change_pct} /> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-400 text-xs">{rec?.expenseRatio ?? '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${ratingBadge(etf.rating)}`}>
                              {etf.rating.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      <footer className="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-700 mt-8">
        ⚠️ For informational purposes only. Not financial advice. Past performance ≠ future results.
        Backend: <code>bash ~/TradingAnalysis/api/start.sh</code>
      </footer>
    </div>
  );
}
