"""
Trading-Trip patch script
Run from: /Users/SurfingAlien/TradingAnalysis/
Usage: python3 apply_changes.py
"""

import re, sys
from pathlib import Path

ROOT = Path(__file__).parent

# ─────────────────────────────────────────────────────────────────────────────
# 1. portfolioData.ts — add CRYPTO_ALERTS + ETF_ALERTS
# ─────────────────────────────────────────────────────────────────────────────
PORT_FILE = ROOT / "frontend/lib/portfolioData.ts"
assert PORT_FILE.exists(), f"Not found: {PORT_FILE}"

ALERTS_BLOCK = '''
// ─── Price-Target Buy-Zone Alerts ───────────────────────────────────────────

export interface BuyAlert {
  symbol:      string;
  name:        string;
  assetType:   'crypto' | 'etf' | 'stock';
  alertType:   'below';
  threshold:   number;
  entryZone:   string;
  targetAlloc: string;
  note:        string;
  thesis:      string;
}

export const CRYPTO_ALERTS: BuyAlert[] = [
  {
    symbol: 'BTC-USD', name: 'Bitcoin', assetType: 'crypto', alertType: 'below',
    threshold: 75000, entryZone: '$72k–$75k', targetAlloc: '5–8%',
    note: 'ACCUMULATION ZONE',
    thesis: 'Post-halving demand + institutional ETF floor. $72k is the breakout-retest of the 2021 ATH. Historical: every cycle sees 20–30% pullback after halving before resuming uptrend.',
  },
  {
    symbol: 'ETH-USD', name: 'Ethereum', assetType: 'crypto', alertType: 'below',
    threshold: 1600, entryZone: '$1,500–$1,600', targetAlloc: '3–5%',
    note: 'MULTI-YEAR SUPPORT',
    thesis: '$1,500–$1,600 has been major demand since the 2022 merge. ETH staking yield (3–4%) provides baseline floor. Pectra upgrade + restaking (EigenLayer) are 2025–26 tailwinds.',
  },
  {
    symbol: 'SOL-USD', name: 'Solana', assetType: 'crypto', alertType: 'below',
    threshold: 110, entryZone: '$100–$110', targetAlloc: '2–4%',
    note: 'BREAKOUT RETEST',
    thesis: '$100–$110 is the breakout level from Nov 2023. Solana DEX volume > Ethereum + all L2s combined in Q1 2025. Network revenue growing 4× YoY. Strong DePIN and consumer app traction.',
  },
  {
    symbol: 'XRP-USD', name: 'XRP / Ripple', assetType: 'crypto', alertType: 'below',
    threshold: 1.80, entryZone: '$1.70–$1.80', targetAlloc: '1–2%',
    note: 'PRE-BREAKOUT BASE',
    thesis: 'SEC lawsuit resolved. ODL (On-Demand Liquidity) cross-border volumes growing with bank partnerships. RLUSD stablecoin launch adds utility. Regulatory clarity = re-rating catalyst.',
  },
  {
    symbol: 'AVAX-USD', name: 'Avalanche', assetType: 'crypto', alertType: 'below',
    threshold: 18, entryZone: '$16–$18', targetAlloc: '1–2%',
    note: 'DEMAND ZONE',
    thesis: 'Avalanche L1s (formerly subnets) attracting institutional chains: BlackRock BUIDL, JPMorgan Onyx. $16–$18 is the 2023 accumulation base. Lower risk / lower reward vs SOL.',
  },
];

export const ETF_ALERTS: BuyAlert[] = [
  {
    symbol: 'QQQ', name: 'Invesco QQQ', assetType: 'etf', alertType: 'below',
    threshold: 420, entryZone: '$415–$420', targetAlloc: '5–10%',
    note: 'DIP TO BUY ZONE',
    thesis: 'QQQ at $420 implies ~15% pullback from ATH — historically a high-probability entry for 12-month holds. Top 10 holdings = Mag-7 + AVGO + COST. AI capex cycle still early.',
  },
  {
    symbol: 'VGT', name: 'Vanguard IT ETF', assetType: 'etf', alertType: 'below',
    threshold: 540, entryZone: '$530–$540', targetAlloc: '3–5%',
    note: 'TECH SECTOR FLOOR',
    thesis: 'VGT at $540 = 14% off ATH. 0.10% expense ratio (cheapest tech ETF). 60%+ weight in semiconductors + software. Preferred to QQQ for pure tech exposure without Amazon/Alphabet.',
  },
];
'''

src = PORT_FILE.read_text()
if 'CRYPTO_ALERTS' in src:
    print("⏭  portfolioData.ts — CRYPTO_ALERTS already present, skipping")
else:
    src += "\n" + ALERTS_BLOCK
    PORT_FILE.write_text(src)
    print("✅  portfolioData.ts — added CRYPTO_ALERTS + ETF_ALERTS + BuyAlert interface")

# ─────────────────────────────────────────────────────────────────────────────
# 2. page.tsx — import new alert data + Market Pulse widget + Alerts tab additions
# ─────────────────────────────────────────────────────────────────────────────
PAGE_FILE = ROOT / "frontend/app/page.tsx"
assert PAGE_FILE.exists(), f"Not found: {PAGE_FILE}"

page = PAGE_FILE.read_text()

# 2a. Add imports
OLD_IMPORT = "import { CRYPTO_WATCHLIST, CRYPTO_RECOMMENDATIONS, ETF_WATCHLIST, ETF_RECOMMENDATIONS, WATCHLIST_ALERTS }"
NEW_IMPORT = "import { CRYPTO_WATCHLIST, CRYPTO_RECOMMENDATIONS, ETF_WATCHLIST, ETF_RECOMMENDATIONS, WATCHLIST_ALERTS, CRYPTO_ALERTS, ETF_ALERTS, BuyAlert }"

if 'CRYPTO_ALERTS' not in page:
    if OLD_IMPORT in page:
        page = page.replace(OLD_IMPORT, NEW_IMPORT)
        print("✅  page.tsx — updated import to include CRYPTO_ALERTS + ETF_ALERTS")
    else:
        print("⚠️   page.tsx — could not find import line to patch; add manually:")
        print(f"     Replace:\n     {OLD_IMPORT}\n     With:\n     {NEW_IMPORT}")
else:
    print("⏭  page.tsx — CRYPTO_ALERTS import already present, skipping")

# 2b. Add fearGreed state + fetch after existing state declarations
FG_STATE = '''
  // Market Pulse — Fear & Greed
  const [fearGreed, setFearGreed] = React.useState<{ value: number; label: string } | null>(null);
  React.useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => r.json())
      .then(d => {
        const v = parseInt(d.data[0].value);
        setFearGreed({ value: v, label: d.data[0].value_classification });
      })
      .catch(() => {});
  }, []);
'''

if 'fearGreed' not in page:
    # Insert after the first useState block (after etfPrices state)
    INSERT_AFTER = "const [searchOpen, setSearchOpen] = React.useState(false);"
    if INSERT_AFTER in page:
        page = page.replace(INSERT_AFTER, INSERT_AFTER + "\n" + FG_STATE)
        print("✅  page.tsx — added fearGreed state + Fear & Greed fetch")
    else:
        print("⚠️   page.tsx — could not find searchOpen state; add fearGreed state manually")
else:
    print("⏭  page.tsx — fearGreed state already present, skipping")

# 2c. Add Market Pulse widget JSX — insert into Overview tab
MARKET_PULSE_JSX = '''
              {/* ── Market Pulse ───────────────────────────────────────────── */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">Market Pulse</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Fear & Greed */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Fear & Greed</span>
                    {fearGreed ? (
                      <>
                        <span className={`text-2xl font-bold ${
                          fearGreed.value >= 75 ? 'text-red-400' :
                          fearGreed.value >= 55 ? 'text-orange-400' :
                          fearGreed.value >= 45 ? 'text-yellow-400' :
                          fearGreed.value >= 25 ? 'text-emerald-400' : 'text-green-400'
                        }`}>{fearGreed.value}</span>
                        <span className="text-xs text-zinc-400">{fearGreed.label}</span>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1">
                          <div className={`h-1.5 rounded-full transition-all ${
                            fearGreed.value >= 75 ? 'bg-red-400' :
                            fearGreed.value >= 55 ? 'bg-orange-400' :
                            fearGreed.value >= 45 ? 'bg-yellow-400' :
                            fearGreed.value >= 25 ? 'bg-emerald-400' : 'bg-green-400'
                          }`} style={{ width: `${fearGreed.value}%` }} />
                        </div>
                      </>
                    ) : (
                      <span className="text-zinc-500 text-sm animate-pulse">Loading…</span>
                    )}
                  </div>
                  {/* Signal */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Sentiment Signal</span>
                    {fearGreed ? (
                      <span className={`text-sm font-semibold px-2 py-1 rounded-md w-fit ${
                        fearGreed.value >= 75 ? 'bg-red-900/40 text-red-300' :
                        fearGreed.value >= 55 ? 'bg-orange-900/40 text-orange-300' :
                        fearGreed.value >= 45 ? 'bg-yellow-900/40 text-yellow-300' :
                        fearGreed.value >= 25 ? 'bg-emerald-900/40 text-emerald-300' :
                        'bg-green-900/40 text-green-300'
                      }`}>
                        {fearGreed.value >= 75 ? '⚠ Extreme Greed — Caution' :
                         fearGreed.value >= 55 ? '📈 Greed — Trim / Hold' :
                         fearGreed.value >= 45 ? '➡ Neutral — Hold' :
                         fearGreed.value >= 25 ? '💚 Fear — Accumulate' :
                         '🟢 Extreme Fear — Buy Aggressively'}
                      </span>
                    ) : <span className="text-zinc-500 text-sm animate-pulse">—</span>}
                  </div>
                  {/* Active Alerts */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Active Alerts</span>
                    <span className="text-2xl font-bold text-blue-400">{alerts.length}</span>
                    <span className="text-xs text-zinc-400">price triggers set</span>
                  </div>
                  {/* Watchlist */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Watchlist</span>
                    <span className="text-2xl font-bold text-violet-400">{CRYPTO_WATCHLIST.length + ETF_WATCHLIST.length + stockWatchlist.length}</span>
                    <span className="text-xs text-zinc-400">assets tracked</span>
                  </div>
                </div>
              </div>
'''

if 'Market Pulse' not in page:
    # Find the overview tab opening and insert the widget at the top
    # Look for a common pattern in the overview tab
    OVERVIEW_ANCHOR = "tab === 'overview' && ("
    if OVERVIEW_ANCHOR in page:
        # Find the position after the opening of the overview tab section
        idx = page.index(OVERVIEW_ANCHOR)
        # Find the next JSX div after this
        next_div = page.index('<div', idx + len(OVERVIEW_ANCHOR))
        # Insert before the first div in overview
        page = page[:next_div] + MARKET_PULSE_JSX + "\n              " + page[next_div:]
        print("✅  page.tsx — inserted Market Pulse widget into Overview tab")
    else:
        print("⚠️   page.tsx — could not auto-insert Market Pulse; look for 'tab === overview' section")
        print("     Copy the MARKET_PULSE_JSX block from the comments in apply_changes.py and insert manually")
else:
    print("⏭  page.tsx — Market Pulse already present, skipping")

# 2d. Add crypto + ETF alert cards into the Alerts tab
CRYPTO_ETF_ALERT_JSX = '''
              {/* ── Crypto Buy-Zone Alerts ────────────────────────────────── */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bitcoin className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">Crypto Buy-Zone Alerts</h3>
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
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">ETF Dip-Buy Alerts</h3>
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
'''

if 'Crypto Buy-Zone Alerts' not in page:
    # Insert before the ARM WATCHLIST_ALERTS section in the Alerts tab
    ARM_ANCHOR = '/* ARM / Watchlist alert cards */'
    FALLBACK_ANCHOR = 'WATCHLIST_ALERTS.map'
    if ARM_ANCHOR in page:
        page = page.replace(ARM_ANCHOR, CRYPTO_ETF_ALERT_JSX + "\n              " + ARM_ANCHOR)
        print("✅  page.tsx — inserted Crypto + ETF alert cards into Alerts tab")
    elif FALLBACK_ANCHOR in page:
        page = page.replace(FALLBACK_ANCHOR, CRYPTO_ETF_ALERT_JSX + "\n              {" + FALLBACK_ANCHOR, 1)
        # Fix the accidental double-brace
        page = page.replace("              {" + FALLBACK_ANCHOR, "              {" + FALLBACK_ANCHOR, 1)
        print("✅  page.tsx — inserted Crypto + ETF alert cards (via WATCHLIST_ALERTS anchor)")
    else:
        print("⚠️   page.tsx — could not find Alerts tab anchor.")
        print("     Search for 'Watchlist Buy-Zone Alerts' section and paste CRYPTO_ETF_ALERT_JSX before it.")
else:
    print("⏭  page.tsx — Crypto/ETF alert cards already present, skipping")

# 2e. Ensure Activity icon is imported from lucide-react
if "'Activity'" not in page and '"Activity"' not in page and 'Activity,' not in page:
    page = re.sub(
        r'(import \{[^}]*)(Bitcoin)',
        r'\1Activity, \2',
        page, count=1
    )
    print("✅  page.tsx — added Activity icon import")
else:
    print("⏭  page.tsx — Activity icon already imported")

# Write page.tsx
PAGE_FILE.write_text(page)
print("\n✅  All patches applied. Now run:\n")
print("    cd /Users/SurfingAlien/TradingAnalysis/frontend")
print("    npm run build")
print("    # Then commit + push to trigger GitHub Actions deploy\n")
