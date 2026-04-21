export interface Position {
  symbol: string;
  description: string;
  qty: number;
  avgCost: number;
  lastPrice: number;
  currentValue: number;
  totalGainDollar: number;
  totalGainPct: number;
  todayGainDollar: number;
  todayGainPct: number;
  accountPct: number;
  costBasisTotal: number;
  sector: string;
  rating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  cashValue: number;
  positions: Position[];
  asOf: string;
}

export const PORTFOLIO: PortfolioSummary = {
  asOf: '2026-04-21',
  cashValue: 5049.55,
  totalValue: 0,   // computed below
  totalCost: 0,    // computed below
  totalGain: 0,    // computed below
  totalGainPct: 0, // computed below
  positions: [
    { symbol: 'AAPL',  description: 'Apple Inc',                qty: 10,  avgCost: 150.46, lastPrice: 273.05, currentValue: 2730.50,  totalGainDollar:  1225.95, totalGainPct:  81.48, todayGainDollar:  28.20, todayGainPct:  1.04, accountPct: 3.95, costBasisTotal: 1504.55, sector: 'Technology',    rating: 'BUY' },
    { symbol: 'ADSK',  description: 'Autodesk Inc',             qty: 10,  avgCost: 256.17, lastPrice: 245.31, currentValue: 2453.10,  totalGainDollar:  -108.61, totalGainPct:  -4.24, todayGainDollar:  32.90, todayGainPct:  1.35, accountPct: 3.55, costBasisTotal: 2561.71, sector: 'Technology',    rating: 'HOLD' },
    { symbol: 'AMD',   description: 'Advanced Micro Devices',   qty: 10,  avgCost: 131.19, lastPrice: 274.95, currentValue: 2749.50,  totalGainDollar:  1437.60, totalGainPct: 109.58, todayGainDollar: -34.40, todayGainPct: -1.24, accountPct: 3.98, costBasisTotal: 1311.90, sector: 'Technology',    rating: 'BUY' },
    { symbol: 'AMZN',  description: 'Amazon.com Inc',           qty: 10,  avgCost: 166.61, lastPrice: 248.28, currentValue: 2482.80,  totalGainDollar:   816.70, totalGainPct:  49.01, todayGainDollar: -22.80, todayGainPct: -0.91, accountPct: 3.59, costBasisTotal: 1666.10, sector: 'Technology',    rating: 'BUY' },
    { symbol: 'AVGO',  description: 'Broadcom Inc',             qty: 10,  avgCost: 177.54, lastPrice: 399.63, currentValue: 3996.30,  totalGainDollar:  2220.90, totalGainPct: 125.09, todayGainDollar: -69.10, todayGainPct: -1.70, accountPct: 5.78, costBasisTotal: 1775.40, sector: 'Technology',    rating: 'STRONG_BUY' },
    { symbol: 'BABA',  description: 'Alibaba Group',            qty: 10,  avgCost: 188.38, lastPrice: 140.17, currentValue: 1401.70,  totalGainDollar:  -482.10, totalGainPct: -25.60, todayGainDollar:  -8.40, todayGainPct: -0.60, accountPct: 2.03, costBasisTotal: 1883.80, sector: 'Technology',    rating: 'SELL' },
    { symbol: 'BROS',  description: 'Dutch Bros Inc',           qty: 15,  avgCost:  63.48, lastPrice:  54.62, currentValue:  819.30,  totalGainDollar:  -132.83, totalGainPct: -13.96, todayGainDollar:  17.70, todayGainPct:  2.20, accountPct: 1.18, costBasisTotal:  952.13, sector: 'Consumer',      rating: 'HOLD' },
    { symbol: 'CL',    description: 'Colgate-Palmolive Co',     qty: 15,  avgCost:  94.64, lastPrice:  83.53, currentValue: 1252.95,  totalGainDollar:  -166.65, totalGainPct: -11.74, todayGainDollar: -26.25, todayGainPct: -2.06, accountPct: 1.81, costBasisTotal: 1419.60, sector: 'Consumer',      rating: 'HOLD' },
    { symbol: 'COIN',  description: 'Coinbase Global',          qty: 15,  avgCost: 257.11, lastPrice: 211.63, currentValue: 3174.45,  totalGainDollar:  -682.15, totalGainPct: -17.69, todayGainDollar:  79.50, todayGainPct:  2.56, accountPct: 4.59, costBasisTotal: 3856.60, sector: 'Finance',       rating: 'SELL' },
    { symbol: 'GOOG',  description: 'Alphabet Inc',             qty: 10,  avgCost: 165.77, lastPrice: 335.40, currentValue: 3354.00,  totalGainDollar:  1696.30, totalGainPct: 102.32, todayGainDollar: -40.00, todayGainPct: -1.18, accountPct: 4.85, costBasisTotal: 1657.70, sector: 'Technology',    rating: 'STRONG_BUY' },
    { symbol: 'INTC',  description: 'Intel Corp',               qty: 25,  avgCost:  19.54, lastPrice:  65.70, currentValue: 1642.50,  totalGainDollar:  1154.12, totalGainPct: 236.31, todayGainDollar: -70.00, todayGainPct: -4.09, accountPct: 2.38, costBasisTotal:  488.38, sector: 'Technology',    rating: 'HOLD' },
    { symbol: 'MSFT',  description: 'Microsoft Corp',           qty: 10,  avgCost: 400.57, lastPrice: 418.07, currentValue: 4180.70,  totalGainDollar:   175.00, totalGainPct:   4.36, todayGainDollar: -47.20, todayGainPct: -1.12, accountPct: 6.05, costBasisTotal: 4005.70, sector: 'Technology',    rating: 'BUY' },
    { symbol: 'NVDA',  description: 'NVIDIA Corporation',       qty: 50,  avgCost: 112.07, lastPrice: 202.06, currentValue: 10103.00, totalGainDollar:  4499.73, totalGainPct:  80.30, todayGainDollar:  19.00, todayGainPct:  0.18, accountPct:14.61, costBasisTotal: 5603.27, sector: 'Technology',    rating: 'STRONG_BUY' },
    { symbol: 'ORCL',  description: 'Oracle Corp',              qty: 15,  avgCost: 265.80, lastPrice: 177.58, currentValue: 2663.70,  totalGainDollar: -1323.36, totalGainPct: -33.20, todayGainDollar:  37.80, todayGainPct:  1.43, accountPct: 3.85, costBasisTotal: 3987.06, sector: 'Technology',    rating: 'SELL' },
    { symbol: 'PG',    description: 'Procter & Gamble Co',      qty: 10,  avgCost: 157.15, lastPrice: 144.49, currentValue: 1444.90,  totalGainDollar:  -126.60, totalGainPct:  -8.06, todayGainDollar: -24.40, todayGainPct: -1.67, accountPct: 2.09, costBasisTotal: 1571.50, sector: 'Consumer',      rating: 'HOLD' },
    { symbol: 'QCOM',  description: 'Qualcomm Inc',             qty: 10,  avgCost: 163.21, lastPrice: 137.52, currentValue: 1375.20,  totalGainDollar:  -256.88, totalGainPct: -15.74, todayGainDollar:  13.20, todayGainPct:  0.96, accountPct: 1.99, costBasisTotal: 1632.08, sector: 'Technology',    rating: 'SELL' },
    { symbol: 'SOUN',  description: 'SoundHound AI Inc',        qty: 150, avgCost:  15.45, lastPrice:   8.32, currentValue: 1248.00,  totalGainDollar: -1068.79, totalGainPct: -46.14, todayGainDollar:  36.00, todayGainPct:  2.97, accountPct: 1.80, costBasisTotal: 2316.79, sector: 'Technology',    rating: 'STRONG_SELL' },
    { symbol: 'TSLA',  description: 'Tesla Inc',                qty: 15,  avgCost: 216.75, lastPrice: 392.50, currentValue: 5887.50,  totalGainDollar:  2636.30, totalGainPct:  81.08, todayGainDollar:-121.80, todayGainPct: -2.03, accountPct: 8.51, costBasisTotal: 3251.20, sector: 'Consumer',      rating: 'HOLD' },
    { symbol: 'TSM',   description: 'Taiwan Semiconductor',     qty: 20,  avgCost: 180.51, lastPrice: 366.24, currentValue: 7324.80,  totalGainDollar:  3714.60, totalGainPct: 102.89, todayGainDollar: -85.20, todayGainPct: -1.15, accountPct:10.59, costBasisTotal: 3610.20, sector: 'Technology',    rating: 'STRONG_BUY' },
    { symbol: 'TXN',   description: 'Texas Instruments Inc',    qty: 10,  avgCost: 207.26, lastPrice: 233.70, currentValue: 2337.00,  totalGainDollar:   264.40, totalGainPct:  12.75, todayGainDollar:  38.80, todayGainPct:  1.68, accountPct: 3.38, costBasisTotal: 2072.60, sector: 'Technology',    rating: 'HOLD' },
    { symbol: 'XOM',   description: 'Exxon Mobil Corp',         qty: 10,  avgCost: 147.72, lastPrice: 147.68, currentValue: 1476.80,  totalGainDollar:    -0.35, totalGainPct:  -0.03, todayGainDollar:  12.40, todayGainPct:  0.84, accountPct: 2.14, costBasisTotal: 1477.15, sector: 'Energy',        rating: 'HOLD' },
  ],
};

// Compute derived totals
PORTFOLIO.totalValue = PORTFOLIO.positions.reduce((s, p) => s + p.currentValue, 0) + PORTFOLIO.cashValue;
PORTFOLIO.totalCost  = PORTFOLIO.positions.reduce((s, p) => s + p.costBasisTotal, 0);
PORTFOLIO.totalGain  = PORTFOLIO.positions.reduce((s, p) => s + p.totalGainDollar, 0);
PORTFOLIO.totalGainPct = (PORTFOLIO.totalGain / PORTFOLIO.totalCost) * 100;

export const PORTFOLIO_SYMBOLS = PORTFOLIO.positions.map(p => p.symbol);

export const RECOMMENDATIONS: Array<{
  symbol: string; action: string; thesis: string; horizon: string; risk: string;
}> = [
  { symbol: 'NVDA',  action: 'ADD',     thesis: 'AI infrastructure backbone — data center demand is accelerating, Blackwell GPU cycle just starting.',                          horizon: '6–12 months', risk: 'Medium' },
  { symbol: 'TSM',   action: 'HOLD',    thesis: 'Only foundry capable of 2nm production. Every AI chip runs through TSMC. Taiwan risk is real but priced in.',               horizon: '6 months',    risk: 'Medium' },
  { symbol: 'AVGO',  action: 'ADD',     thesis: 'Custom AI ASICs (Google TPUs, Meta) + networking silicon. Revenue visibility through 2027.',                                 horizon: '6–12 months', risk: 'Medium' },
  { symbol: 'GOOG',  action: 'ADD',     thesis: 'AI Search + Gemini monetization + YouTube undervalued. Cheapest mega-cap on P/E. Cloud re-acceleration.',                    horizon: '6 months',    risk: 'Low' },
  { symbol: 'MSFT',  action: 'HOLD',    thesis: 'Copilot revenue ramping, Azure growth. Already near full valuation at $400 avg cost.',                                       horizon: '6 months',    risk: 'Low' },
  { symbol: 'AAPL',  action: 'HOLD',    thesis: 'Apple Intelligence cycle could drive iPhone upgrade supercycle. Services margins expanding.',                                 horizon: '6 months',    risk: 'Low' },
  { symbol: 'TSLA',  action: 'HOLD',    thesis: 'FSD + Robotaxi narrative supports premium. EV margins recovering. High beta — volatile.',                                    horizon: '6 months',    risk: 'High' },
  { symbol: 'AMD',   action: 'ADD',     thesis: 'MI300X gaining datacenter share vs NVIDIA. EPYC server CPUs taking Intel share. Undervalued AI play.',                       horizon: '6 months',    risk: 'Medium' },
  { symbol: 'AMZN',  action: 'HOLD',    thesis: 'AWS AI services growing 30%+. Advertising business overlooked. FCF acceleration.',                                           horizon: '6 months',    risk: 'Low' },
  { symbol: 'TXN',   action: 'HOLD',    thesis: 'Analog cycle bottoming, industrial recovery 2026. Defensive semiconductor with 3% dividend.',                                horizon: '6 months',    risk: 'Low' },
  { symbol: 'INTC',  action: 'REDUCE',  thesis: 'Massive unrealized gain (+236%). Intel losing data center to AMD/NVDA. Foundry turnaround uncertain. Lock in some profits.', horizon: 'Now',         risk: 'High' },
  { symbol: 'SOUN',  action: 'EXIT',    thesis: '-46% loss. Speculative micro-cap with no clear path to profitability. Capital better deployed elsewhere.',                   horizon: 'Now',         risk: 'Very High' },
  { symbol: 'ORCL',  action: 'REVIEW',  thesis: '-33% loss. Cloud database business solid but stock expensive. Wait for earnings catalyst or cut the loss.',                  horizon: '3 months',    risk: 'High' },
  { symbol: 'BABA',  action: 'EXIT',    thesis: '-25% loss. China regulatory risk + US geopolitical tensions persist. No near-term catalyst.',                                horizon: 'Now',         risk: 'Very High' },
  { symbol: 'QCOM',  action: 'REVIEW',  thesis: '-15% loss. Smartphone cycle recovery in 2026. AI-on-device story emerging but limited upside.',                              horizon: '3 months',    risk: 'Medium' },
  { symbol: 'COIN',  action: 'REVIEW',  thesis: '-17% loss. Crypto regulatory clarity improving but stock richly valued vs fundamentals.',                                    horizon: '3 months',    risk: 'High' },
];

export const NEW_STOCK_IDEAS: Array<{
  symbol: string; name: string; thesis: string; targetAlloc: string; risk: string;
}> = [
  { symbol: 'META',  name: 'Meta Platforms',       thesis: 'AI-driven ad targeting + Llama models + Reality Labs optionality. Best FCF in mega-cap.',          targetAlloc: '3–4%',  risk: 'Medium' },
  { symbol: 'PLTR',  name: 'Palantir Technologies', thesis: 'AIP government contracts + enterprise AI platform. US GAAP profitable. High-conviction AI play.',   targetAlloc: '2–3%',  risk: 'High' },
  { symbol: 'ARM',   name: 'Arm Holdings',          thesis: 'Every AI device runs ARM architecture. Royalty model scales with AI chip proliferation.',            targetAlloc: '2%',    risk: 'Medium' },
  { symbol: 'SNOW',  name: 'Snowflake',             thesis: 'AI data platform — Cortex AI revenue growing. Customer count expanding. Recovering from selloff.',   targetAlloc: '2%',    risk: 'High' },
  { symbol: 'CRWD',  name: 'CrowdStrike',           thesis: 'AI-native cybersecurity leader. Falcon platform consolidating security spend. High NRR.',            targetAlloc: '2%',    risk: 'Medium' },
];

// ── Crypto & ETF Watchlists ────────────────────────────────────────────────

export interface WatchlistItem {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  rating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  tags: string[];
}

export const CRYPTO_WATCHLIST: WatchlistItem[] = [
  { symbol: 'BTC-USD',  name: 'Bitcoin',   description: 'Digital gold, institutional store of value',    sector: 'Crypto', rating: 'STRONG_BUY', tags: ['L1', 'Store of Value'] },
  { symbol: 'ETH-USD',  name: 'Ethereum',  description: 'Smart contract platform, DeFi backbone',         sector: 'Crypto', rating: 'STRONG_BUY', tags: ['L1', 'DeFi'] },
  { symbol: 'SOL-USD',  name: 'Solana',    description: 'High-throughput L1, fastest growing DeFi',       sector: 'Crypto', rating: 'BUY',         tags: ['L1', 'DeFi'] },
  { symbol: 'XRP-USD',  name: 'XRP',       description: 'Cross-border payments, 75+ central banks',       sector: 'Crypto', rating: 'BUY',         tags: ['Payments', 'Regulated'] },
  { symbol: 'BNB-USD',  name: 'BNB',       description: 'Binance ecosystem token, BNB Chain L1',          sector: 'Crypto', rating: 'HOLD',        tags: ['Exchange', 'L1'] },
  { symbol: 'AVAX-USD', name: 'Avalanche', description: 'Institutional subnets, BlackRock tokenization',  sector: 'Crypto', rating: 'BUY',         tags: ['L1', 'Enterprise'] },
  { symbol: 'DOGE-USD', name: 'Dogecoin',  description: 'Meme coin with payment utility',                 sector: 'Crypto', rating: 'HOLD',        tags: ['Meme', 'Payments'] },
  { symbol: 'ADA-USD',  name: 'Cardano',   description: 'Peer-reviewed PoS blockchain',                   sector: 'Crypto', rating: 'HOLD',        tags: ['L1', 'PoS'] },
  { symbol: 'LINK-USD', name: 'Chainlink', description: 'Decentralized oracle network, DeFi infra',       sector: 'Crypto', rating: 'BUY',         tags: ['Oracle', 'DeFi'] },
  { symbol: 'DOT-USD',  name: 'Polkadot',  description: 'Cross-chain interoperability, parachain L0',     sector: 'Crypto', rating: 'HOLD',        tags: ['L0', 'Interop'] },
];

export const CRYPTO_RECOMMENDATIONS: Array<{
  symbol: string; name: string; action: string; horizon: string; risk: string; thesis: string; targetAlloc: string;
}> = [
  {
    symbol: 'BTC-USD', name: 'Bitcoin', action: 'BUY', horizon: '2–4 years', risk: 'Medium', targetAlloc: '5–10%',
    thesis: 'BlackRock & Fidelity ETFs pulling institutional capital. Post-halving supply shock (Apr 2024) + growing demand historically drives 18-month bull cycles. Digital gold with $1T+ market cap floor and sovereign adoption accelerating.',
  },
  {
    symbol: 'ETH-USD', name: 'Ethereum', action: 'BUY', horizon: '2–3 years', risk: 'Medium', targetAlloc: '3–5%',
    thesis: 'Foundation of tokenized finance — RWAs, DeFi, and stablecoins all run on Ethereum. ETF approval + 3.5% staking yield makes ETH a productive asset. EIP-4844 cut L2 fees 90%, driving mass adoption.',
  },
  {
    symbol: 'SOL-USD', name: 'Solana', action: 'BUY', horizon: '1–2 years', risk: 'High', targetAlloc: '2–3%',
    thesis: 'Fastest growing DeFi and consumer crypto ecosystem. Sub-cent transactions enable apps impossible on Ethereum. Developer activity and DEX volumes at all-time highs. Solana ETF expected 2026.',
  },
  {
    symbol: 'XRP-USD', name: 'XRP', action: 'BUY', horizon: '1–2 years', risk: 'Medium', targetAlloc: '2%',
    thesis: 'SEC lawsuit fully resolved. 75+ central banks piloting XRP for CBDC corridors. RLUSD stablecoin launched Q1 2026. XRP ETF approval imminent — Grayscale & Bitwise filed. Regulatory clarity is the catalyst.',
  },
  {
    symbol: 'AVAX-USD', name: 'Avalanche', action: 'BUY', horizon: '1–2 years', risk: 'High', targetAlloc: '1–2%',
    thesis: 'Institutional blockchain of choice — BlackRock tokenized funds and JP Morgan Onyx run on Avalanche subnets. Gaming (Beam) and enterprise chain deployment driving ecosystem growth. Under the radar vs SOL.',
  },
];

export const ETF_WATCHLIST: WatchlistItem[] = [
  { symbol: 'QQQ',  name: 'Invesco QQQ Trust',         description: 'Nasdaq-100 index — top 100 non-financial US stocks',  sector: 'Large Cap Tech', rating: 'STRONG_BUY', tags: ['Index', 'Nasdaq-100'] },
  { symbol: 'VOO',  name: 'Vanguard S&P 500 ETF',       description: 'S&P 500 index, 0.03% expense ratio',                  sector: 'Broad Market',   rating: 'STRONG_BUY', tags: ['Index', 'S&P 500'] },
  { symbol: 'VGT',  name: 'Vanguard Information Tech',  description: 'Pure-play technology sector ETF',                     sector: 'Technology',     rating: 'BUY',         tags: ['Sector', 'Tech'] },
  { symbol: 'SOXX', name: 'iShares Semiconductor ETF',  description: '30 global semiconductor companies',                   sector: 'Semiconductors', rating: 'BUY',         tags: ['Sector', 'Chips'] },
  { symbol: 'SPY',  name: 'SPDR S&P 500 ETF Trust',     description: 'Largest ETF by AUM, S&P 500 tracker',                 sector: 'Broad Market',   rating: 'STRONG_BUY', tags: ['Index', 'S&P 500'] },
  { symbol: 'ARKK', name: 'ARK Innovation ETF',          description: 'Disruptive tech — AI, genomics, robotics (active)',   sector: 'Innovation',     rating: 'HOLD',        tags: ['Active', 'Disruptive'] },
  { symbol: 'IWM',  name: 'iShares Russell 2000 ETF',   description: 'Small-cap US stocks, domestic economy exposure',       sector: 'Small Cap',      rating: 'HOLD',        tags: ['Index', 'Small Cap'] },
  { symbol: 'GLD',  name: 'SPDR Gold Shares',            description: 'Physical gold-backed ETF, inflation hedge',           sector: 'Commodities',    rating: 'BUY',         tags: ['Commodity', 'Hedge'] },
];

export const ETF_RECOMMENDATIONS: Array<{
  symbol: string; name: string; action: string; horizon: string; risk: string; thesis: string; expenseRatio: string; targetAlloc: string;
}> = [
  {
    symbol: 'QQQ', name: 'Invesco QQQ Trust', action: 'BUY', horizon: '3–5 years', risk: 'Medium', expenseRatio: '0.20%', targetAlloc: '10–15%',
    thesis: 'Heaviest AI weighting of any major index — NVDA, MSFT, AAPL, GOOG, META represent ~45%. Tech earnings growing 20%+ YoY. Historical 17% annual return over 10 years. Core portfolio holding for tech-focused investors.',
  },
  {
    symbol: 'VOO', name: 'Vanguard S&P 500', action: 'BUY', horizon: '5–10 years', risk: 'Low', expenseRatio: '0.03%', targetAlloc: '20–30%',
    thesis: "Warren Buffett's recommended vehicle for most investors. 500-company diversification, near-zero fees, 10.5% historical CAGR. Beats 90%+ of actively managed funds over 10 years. Core long-term wealth building.",
  },
  {
    symbol: 'VGT', name: 'Vanguard IT ETF', action: 'BUY', horizon: '3–5 years', risk: 'Medium', expenseRatio: '0.10%', targetAlloc: '5–10%',
    thesis: 'Pure-play on the AI infrastructure build-out. Top holdings mirror your portfolio: AAPL, MSFT, NVDA. Outperforms QQQ in tech bull markets. Near-passive with active sector focus at 0.10% expense ratio.',
  },
  {
    symbol: 'SOXX', name: 'iShares Semiconductor ETF', action: 'BUY', horizon: '2–4 years', risk: 'Medium-High', expenseRatio: '0.35%', targetAlloc: '5%',
    thesis: 'AI compute super-cycle needs chips. SOXX covers the entire value chain — NVDA, AVGO, TSM, AMD, INTC — stocks you already own — in one diversified vehicle. Ideal for increasing semiconductor exposure with single-stock risk managed.',
  },
  {
    symbol: 'GLD', name: 'SPDR Gold Shares', action: 'BUY', horizon: '1–3 years', risk: 'Low', expenseRatio: '0.40%', targetAlloc: '5%',
    thesis: 'Gold at all-time highs driven by central bank de-dollarization (China, Russia, India). Portfolio hedge against geopolitical risk and inflation. Negative correlation to equities in downturns — essential for risk management.',
  },
];
