'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, DollarSign, RefreshCw,
  BarChart2, Lightbulb, Activity, Globe, AlertTriangle,
  Bell, BellOff, Zap, Target, Shield, Cpu, Brain,
  Bitcoin, Search, Layers, X, Coins,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  PORTFOLIO, RECOMMENDATIONS, NEW_STOCK_IDEAS,
  CRYPTO_WATCHLIST, CRYPTO_RECOMMENDATIONS,
  ETF_WATCHLIST, ETF_RECOMMENDATIONS,
} from '@/lib/portfolioData';
import { usePortfolio } from '@/lib/usePortfolio';
import { calcRiskMetrics, runMonteCarlo, getMeta } from '@/lib/analytics';
import { API_BASE } from '@/lib/api';

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
    <span className={`flex items-center gap-0.5 ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {v >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {fmtPct(v)}{suffix}
    </span>
  );
}

type Tab = 'overview' | 'analysis' | 'montecarlo' | 'signals' | 'market' | 'recommendations' | 'alerts' | 'crypto' | 'etfs';

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
  const [snapshot, setSnapshot]   = useState<{ indices: { symbol: string; price: number; change_pct: number }[]; crypto: { symbol: string; price: number; change_pct: number }[]; etfs: { symbol: string; price: number; change_pct: number }[] } | null>(null);
  const [newAlertSym, setNewAlertSym] = useState('NVDA');
  const [newAlertThreshold, setNewAlertThreshold] = useState('');
  const [newAlertType, setNewAlertType] = useState<'above' | 'below' | 'change_pct'>('above');
  const [monteCarlo, setMonteCarlo] = useState<ReturnType<typeof runMonteCarlo> | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, { price: number; change_pct: number }>>({});
  const [etfPrices, setEtfPrices]     = useState<Record<string, { price: number; change_pct: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);

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
        const r = await fetch(`${API_BASE}/api/backtest/${sym}?strategy=rsi&period=1y`);
        if (r.ok) res[sym] = await r.json();
      } catch { /* skip */ }
    }));
    setBacktests(res);
    setLoadingBT(false);
  }, []);

  // ── Snapshot ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/snapshot`).then(r => r.ok ? r.json() : null).then(d => d && setSnapshot(d));
  }, []);

  useEffect(() => {
    if (tab === 'montecarlo' && !monteCarlo) computeMonteCarlo();
  }, [tab, monteCarlo, computeMonteCarlo]);

  // ── Crypto / ETF live prices ──────────────────────────────────────────────
  useEffect(() => {
    const fetchPrices = async (symbols: string[], setter: (m: Record<string, { price: number; change_pct: number }>) => void) => {
      try {
        const res = await fetch(`${API_BASE}/api/prices?symbols=${symbols.join(',')}`);
        if (!res.ok) return;
        const data: Array<{ symbol: string; price: number; change_pct: number; error?: string }> = await res.json();
        const map: Record<string, { price: number; change_pct: number }> = {};
        data.forEach(d => { if (!d.error) map[d.symbol] = d; });
        setter(map);
      } catch { /* silent */ }
    };
    if (tab === 'crypto') fetchPrices(CRYPTO_WATCHLIST.map(c => c.symbol), setCryptoPrices);
    if (tab === 'etfs')   fetchPrices(ETF_WATCHLIST.map(e => e.symbol),   setEtfPrices);
  }, [tab]);

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

  const sortedEnriched = [...enriched].sort((a, b) => b.liveValue - a.liveValue);

  const TABS: { id: Tab; label: string; icon: typeof DollarSign }[] = [
    { id: 'overview',        label: 'Portfolio',       icon: DollarSign },
    { id: 'analysis',        label: 'Risk & Analysis', icon: Shield },
    { id: 'signals',         label: 'Backtest',        icon: Activity },
    { id: 'montecarlo',      label: '6-Month Outlook', icon: Target },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
    { id: 'crypto',          label: 'Crypto',          icon: Bitcoin },
    { id: 'etfs',            label: 'ETFs',            icon: Layers },
    { id: 'market',          label: 'Markets',         icon: Globe },
    { id: 'alerts',          label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}`, icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-3 sticky top-0 z-30 bg-gray-950/95 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-6 w-6 text-emerald-400 flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold leading-tight">Trading Analysis Dashboard</h1>
              <p className="text-xs text-gray-500">{PORTFOLIO.positions.length} positions · {PORTFOLIO.asOf}</p>
            </div>
          </div>

          {/* Day P&L quick stat */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500 mr-1">Portfolio</span>
              <span className="font-bold text-white">{fmt$(totalWithCash, 0)}</span>
            </div>
            <div>
              <span className="text-gray-500 mr-1">Total G/L</span>
              <span className={`font-bold ${totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt$(totals.gain, 0)} ({fmtPct((totals.gain / totals.cost) * 100)})
              </span>
            </div>
            <div>
              <span className="text-gray-500 mr-1">Today</span>
              <span className={`font-bold ${totals.dayGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt$(totals.dayGain, 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search stocks, crypto, ETFs…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-7 py-1.5 text-sm text-gray-100 placeholder-gray-500 w-52 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-gray-500 hover:text-gray-300" />
                </button>
              )}
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 right-0 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.symbol + r.type} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 text-left transition-colors"
                      onMouseDown={() => { setTab(r.tab); setSearchQuery(''); setSearchOpen(false); }}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${r.type === 'Crypto' ? 'bg-orange-900' : r.type === 'ETF' ? 'bg-violet-900' : 'bg-blue-900'}`}>
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
              <Badge className="bg-red-700 text-white animate-pulse flex items-center gap-1">
                <Bell className="h-3 w-3" /> {triggeredAlerts.length} alert{triggeredAlerts.length > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge className={connected ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-800 text-gray-400'}>
              {connected ? '● Live WS' : lastUpdate ? `REST · ${lastUpdate.toLocaleTimeString()}` : 'Connecting…'}
            </Badge>
            <Button size="sm" variant="outline" className="border-gray-700 bg-gray-800 hover:bg-gray-700" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Triggered alert banner */}
      {triggeredAlerts.length > 0 && (
        <div className="bg-red-950 border-b border-red-800 px-6 py-2">
          {triggeredAlerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center justify-between text-sm text-red-300">
              <span>
                <Bell className="inline h-3 w-3 mr-1" />
                <strong>{a.symbol}</strong> {a.type === 'above' ? 'crossed above' : a.type === 'below' ? 'dropped below' : 'moved'} {a.threshold}{a.type === 'change_pct' ? '%' : ` (${fmt$(a.threshold)})`}
              </span>
              <button onClick={() => dismissAlert(a.id)} className="text-red-500 hover:text-red-300 ml-4 text-xs">dismiss</button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-6 py-4 space-y-4">

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t transition-colors
                ${tab === t.id
                  ? 'bg-gray-800 text-white border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'}`}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* ────────────────────────────────────────────────────────────────
            TAB: PORTFOLIO OVERVIEW
        ─────────────────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Value', value: fmt$(totalWithCash, 0), sub: fmt$(totals.gain, 0) + ' total gain', color: 'text-white', icon: DollarSign },
                { label: 'Today\'s P&L',  value: fmt$(totals.dayGain, 0), sub: fmtPct((totals.dayGain / totals.cost) * 100), color: totals.dayGain >= 0 ? 'text-emerald-400' : 'text-red-400', icon: totals.dayGain >= 0 ? TrendingUp : TrendingDown },
                { label: 'Cash Reserve', value: fmt$(PORTFOLIO.cashValue, 0), sub: ((PORTFOLIO.cashValue / totalWithCash) * 100).toFixed(1) + '% of portfolio', color: 'text-sky-400', icon: DollarSign },
                { label: 'Total Return', value: fmtPct((totals.gain / totals.cost) * 100), sub: `cost basis ${fmt$(totals.cost, 0)}`, color: totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400', icon: BarChart2 },
              ].map(k => (
                <Card key={k.label} className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{k.label}</span>
                      <k.icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                    <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Positions table */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base">Positions</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
                      {['Symbol','Qty','Avg Cost','Live Price','Value','Today','Total G/L','Total %','Wt%','Rating'].map(h => (
                        <th key={h} className={`py-2 px-3 ${h === 'Symbol' ? 'text-left' : 'text-right'} ${h === 'Rating' ? '!text-center' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEnriched.map(pos => (
                      <tr key={pos.symbol} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-white">{pos.symbol}</div>
                          <div className="text-xs text-gray-500 max-w-[120px] truncate">{pos.description}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-300">{pos.qty}</td>
                        <td className="py-2.5 px-3 text-right text-gray-400">{fmt$(pos.avgCost)}</td>
                        <td className="py-2.5 px-3 text-right text-white font-medium">
                          {fmt$(pos.livePrice)}
                          {prices[pos.symbol] && <div className="text-xs"><Delta v={prices[pos.symbol].change_pct} /></div>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white">{fmt$(pos.liveValue, 0)}</td>
                        <td className="py-2.5 px-3 text-right"><Delta v={pos.livePct} /></td>
                        <td className={`py-2.5 px-3 text-right font-medium ${pos.liveGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt$(pos.liveGain, 0)}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${pos.liveGainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtPct(pos.liveGainPct)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400">
                          {((pos.liveValue / (totalWithCash - PORTFOLIO.cashValue)) * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${ratingBadge(pos.rating)}`}>
                            {pos.rating.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                { label: 'Sharpe Ratio',   value: risk.sharpe.toFixed(2), sub: risk.sharpe > 1 ? 'Good risk-adjusted return' : 'Below target (>1)', icon: Target, color: risk.sharpe >= 1 ? 'text-emerald-400' : 'text-yellow-400' },
                { label: '1-Day VaR 95%', value: `-${risk.var95.toFixed(2)}%`, sub: `~${fmt$(totalWithCash * risk.var95 / 100, 0)} worst day`, icon: Shield, color: 'text-red-400' },
                { label: 'Annual Alpha',   value: `${risk.alpha >= 0 ? '+' : ''}${risk.alpha.toFixed(1)}%`, sub: 'vs SPY benchmark', icon: TrendingUp, color: risk.alpha >= 0 ? 'text-emerald-400' : 'text-red-400' },
              ].map(k => (
                <Card key={k.label} className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{k.label}</span>
                      <k.icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                    <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base">Sector Allocation</CardTitle>
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
            <Card className="bg-gray-900 border-gray-800">
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">RSI Mean-Reversion strategy · 1-year backtest · daily candles</p>
              <Button size="sm" className="bg-emerald-800 hover:bg-emerald-700" onClick={runBacktests} disabled={loadingBT}>
                <Activity className={`h-4 w-4 mr-2 ${loadingBT ? 'animate-spin' : ''}`} />
                {loadingBT ? 'Running…' : 'Run All Backtests'}
              </Button>
            </div>

            {Object.keys(backtests).length === 0 && !loadingBT && (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-16 text-center text-gray-500">
                  Click &quot;Run All Backtests&quot; to analyse your top holdings via the trading API
                </CardContent>
              </Card>
            )}

            {loadingBT && (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-16 text-center text-gray-400 animate-pulse">
                  Running backtests via trading API…
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.values(backtests).map(bt => (
                <Card key={bt.total_trades} className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-lg">{(bt as {symbol?: string}).symbol ?? '—'}</span>
                        <p className="text-xs text-gray-500">RSI · 1Y · Daily</p>
                      </div>
                      <span className={`text-xl font-bold ${(bt.total_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtPct(bt.total_return_pct ?? 0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ['Win Rate',     `${(bt.win_rate_pct ?? 0).toFixed(0)}%`,          (bt.win_rate_pct ?? 0) >= 55 ? 'text-emerald-400' : 'text-yellow-400'],
                        ['Sharpe',       (bt.sharpe_ratio ?? 0).toFixed(2),                (bt.sharpe_ratio ?? 0) >= 1 ? 'text-emerald-400' : 'text-yellow-400'],
                        ['Max Drawdown', `${(bt.max_drawdown_pct ?? 0).toFixed(1)}%`,       'text-red-400'],
                        ['Trades',       String(bt.total_trades ?? 0),                     'text-white'],
                      ].map(([label, val, col]) => (
                        <div key={label} className="bg-gray-800 rounded p-2">
                          <div className="text-xs text-gray-500">{label}</div>
                          <div className={`font-semibold ${col}`}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                    { label: 'Bear Case (10th pct)', value: fmt$(monteCarlo.p10, 0), change: fmtPct(((monteCarlo.p10 - totals.value) / totals.value) * 100), color: 'text-red-400' },
                    { label: 'Median Outcome',        value: fmt$(monteCarlo.median, 0), change: fmtPct(((monteCarlo.median - totals.value) / totals.value) * 100), color: 'text-white' },
                    { label: 'Bull Case (90th pct)', value: fmt$(monteCarlo.p90, 0), change: fmtPct(((monteCarlo.p90 - totals.value) / totals.value) * 100), color: 'text-emerald-400' },
                  ].map(c => (
                    <Card key={c.label} className="bg-gray-900 border-gray-800">
                      <CardContent className="pt-4">
                        <div className="text-xs text-gray-400 mb-1">{c.label}</div>
                        <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                        <div className={`text-sm ${c.color}`}>{c.change} from today</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Path chart */}
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-gray-100 text-base">Portfolio Value Distribution (6 Months)</CardTitle>
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
              <Card className="bg-gray-900 border-gray-800">
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base flex items-center gap-2">
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
                          <div className={`text-xs font-medium ${rec.risk === 'Low' ? 'text-green-400' : rec.risk === 'Medium' ? 'text-yellow-400' : 'text-red-400'}`}>{rec.risk} risk</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{rec.thesis}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* New ideas */}
            <Card className="bg-gray-900 border-gray-800">
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
                  <Card key={group.title} className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-2"><CardTitle className="text-gray-100 text-base">{group.title}</CardTitle></CardHeader>
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base flex items-center gap-2">
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base">Active Alerts ({alerts.length})</CardTitle>
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

            {/* Pre-built stop-loss suggestions */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base">Suggested Stop-Losses (15% trailing)</CardTitle>
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
            {/* Top 5 Recommendations */}
            <Card className="bg-gray-900 border-gray-800">
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
                          <span className={`text-xs font-medium ${rec.risk === 'Medium' ? 'text-yellow-400' : rec.risk === 'High' ? 'text-red-400' : 'text-green-400'}`}>{rec.risk} risk</span>
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base flex items-center gap-2">
                  <Coins className="h-4 w-4 text-orange-400" /> Crypto Watchlist — Live Prices
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
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
                        <tr key={c.symbol} className={`border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors ${isTop5 ? 'bg-orange-950/10' : ''}`}>
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
            <Card className="bg-gray-900 border-gray-800">
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
                          <span className={`text-xs font-medium ${rec.risk === 'Low' ? 'text-green-400' : rec.risk.includes('Medium') ? 'text-yellow-400' : 'text-red-400'}`}>{rec.risk}</span>
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-100 text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" /> ETF Watchlist — Live Prices
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
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
                        <tr key={etf.symbol} className={`border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors ${isTop5 ? 'bg-violet-950/10' : ''}`}>
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
