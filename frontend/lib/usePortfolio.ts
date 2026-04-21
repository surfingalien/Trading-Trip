'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PORTFOLIO, PORTFOLIO_SYMBOLS } from './portfolioData';
import { API_BASE, WS_BASE } from './api';

export interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  '52w_high': number;
  '52w_low': number;
  timestamp?: string;
  error?: string;
}

export interface Alert {
  id: string;
  symbol: string;
  type: 'above' | 'below' | 'change_pct';
  threshold: number;
  triggered: boolean;
  createdAt: Date;
}

export function usePortfolio() {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<Alert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── REST fallback ────────────────────────────────────────────────────────
  const fetchPricesRest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/prices?symbols=${PORTFOLIO_SYMBOLS.join(',')}`);
      if (!res.ok) return;
      const data: LivePrice[] = await res.json();
      const map: Record<string, LivePrice> = {};
      data.forEach(d => { if (!d.error) map[d.symbol] = d; });
      setPrices(prev => ({ ...prev, ...map }));
      setLastUpdate(new Date());
    } catch { /* silent */ }
  }, []);

  // ── WebSocket connection ─────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/prices`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'prices') {
          const map: Record<string, LivePrice> = {};
          (msg.data as LivePrice[]).forEach(d => { if (!d.error) map[d.symbol] = d; });
          setPrices(prev => {
            const next = { ...prev, ...map };
            return next;
          });
          setLastUpdate(new Date());
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // fallback to REST polling
        if (!pollRef.current) {
          fetchPricesRest();
          pollRef.current = setInterval(fetchPricesRest, 30_000);
        }
      };

      ws.onerror = () => ws.close();
    } catch {
      fetchPricesRest();
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchPricesRest, 30_000);
      }
    }
  }, [fetchPricesRest]);

  useEffect(() => {
    // Try WS first; REST poll is fallback
    fetchPricesRest(); // immediate
    connectWs();
    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connectWs, fetchPricesRest]);

  // ── Alert checking ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!alerts.length) return;
    const fired: Alert[] = [];
    alerts.forEach(alert => {
      const p = prices[alert.symbol];
      if (!p || alert.triggered) return;
      let hit = false;
      if (alert.type === 'above' && p.price >= alert.threshold) hit = true;
      if (alert.type === 'below' && p.price <= alert.threshold) hit = true;
      if (alert.type === 'change_pct' && Math.abs(p.change_pct) >= alert.threshold) hit = true;
      if (hit) fired.push({ ...alert, triggered: true });
    });
    if (fired.length) {
      setAlerts(prev => prev.map(a => fired.find(f => f.id === a.id) || a));
      setTriggeredAlerts(prev => [...fired, ...prev]);
    }
  }, [prices, alerts]);

  // ── Derived portfolio data ───────────────────────────────────────────────
  const enriched = PORTFOLIO.positions.map(pos => {
    const live = prices[pos.symbol];
    const livePrice = live?.price ?? pos.lastPrice;
    const livePct   = live?.change_pct ?? pos.todayGainPct;
    const liveValue = pos.qty * livePrice;
    const liveGain  = liveValue - pos.costBasisTotal;
    const liveGainPct = (liveGain / pos.costBasisTotal) * 100;
    return { ...pos, livePrice, livePct, liveValue, liveGain, liveGainPct };
  });

  const totals = enriched.reduce(
    (acc, p) => ({
      value: acc.value + p.liveValue,
      cost:  acc.cost  + p.costBasisTotal,
      gain:  acc.gain  + p.liveGain,
      dayGain: acc.dayGain + (p.liveValue * (p.livePct / 100)),
    }),
    { value: 0, cost: 0, gain: 0, dayGain: 0 }
  );

  const totalWithCash = totals.value + PORTFOLIO.cashValue;

  const addAlert = (alert: Omit<Alert, 'id' | 'triggered' | 'createdAt'>) => {
    setAlerts(prev => [...prev, {
      ...alert, id: Math.random().toString(36).slice(2),
      triggered: false, createdAt: new Date(),
    }]);
  };

  const removeAlert = (id: string) =>
    setAlerts(prev => prev.filter(a => a.id !== id));

  const dismissAlert = (id: string) =>
    setTriggeredAlerts(prev => prev.filter(a => a.id !== id));

  return {
    prices, enriched, totals, totalWithCash,
    connected, lastUpdate,
    alerts, triggeredAlerts, addAlert, removeAlert, dismissAlert,
    refresh: fetchPricesRest,
  };
}
