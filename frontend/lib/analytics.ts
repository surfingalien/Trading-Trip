/**
 * Advanced portfolio analytics: Sharpe, Beta, VaR, correlation, Monte Carlo.
 * All calculations are client-side using snapshot data.
 */

export interface RiskMetrics {
  sharpe: number;
  beta: number;
  alpha: number;
  stdDev: number;
  var95: number;   // 95% Value at Risk (1-day, as % of portfolio)
  maxDrawdown: number;
  aiExposurePct: number;
  semiconductorPct: number;
  chinaRiskPct: number;
}

export interface MonteCarloResult {
  median: number;
  p10: number;    // bear case
  p90: number;    // bull case
  simulations: number[][];
}

// ── Stock metadata ─────────────────────────────────────────────────────────
const STOCK_META: Record<string, {
  beta: number; aiScore: number; isSemiconductor: boolean; chinaRisk: boolean;
  annualReturnEst: number; annualVolEst: number;
}> = {
  AAPL:  { beta: 1.2,  aiScore: 0.7, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.15, annualVolEst: 0.22 },
  ADSK:  { beta: 1.1,  aiScore: 0.5, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.08, annualVolEst: 0.28 },
  AMD:   { beta: 1.9,  aiScore: 0.9, isSemiconductor: true,  chinaRisk: false, annualReturnEst: 0.25, annualVolEst: 0.50 },
  AMZN:  { beta: 1.2,  aiScore: 0.7, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.18, annualVolEst: 0.28 },
  AVGO:  { beta: 1.4,  aiScore: 0.9, isSemiconductor: true,  chinaRisk: false, annualReturnEst: 0.22, annualVolEst: 0.32 },
  BABA:  { beta: 0.8,  aiScore: 0.5, isSemiconductor: false, chinaRisk: true,  annualReturnEst: -0.05, annualVolEst: 0.45 },
  BROS:  { beta: 1.1,  aiScore: 0.1, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.10, annualVolEst: 0.35 },
  CL:    { beta: 0.5,  aiScore: 0.1, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.06, annualVolEst: 0.15 },
  COIN:  { beta: 2.5,  aiScore: 0.4, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.20, annualVolEst: 0.80 },
  GOOG:  { beta: 1.1,  aiScore: 0.9, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.18, annualVolEst: 0.25 },
  INTC:  { beta: 0.9,  aiScore: 0.4, isSemiconductor: true,  chinaRisk: false, annualReturnEst: -0.05, annualVolEst: 0.35 },
  MSFT:  { beta: 0.9,  aiScore: 0.9, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.15, annualVolEst: 0.22 },
  NVDA:  { beta: 1.8,  aiScore: 1.0, isSemiconductor: true,  chinaRisk: false, annualReturnEst: 0.35, annualVolEst: 0.55 },
  ORCL:  { beta: 0.8,  aiScore: 0.6, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.08, annualVolEst: 0.28 },
  PG:    { beta: 0.5,  aiScore: 0.1, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.07, annualVolEst: 0.14 },
  QCOM:  { beta: 1.3,  aiScore: 0.6, isSemiconductor: true,  chinaRisk: false, annualReturnEst: 0.10, annualVolEst: 0.38 },
  SOUN:  { beta: 2.5,  aiScore: 0.8, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.10, annualVolEst: 0.90 },
  TSLA:  { beta: 2.0,  aiScore: 0.7, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.20, annualVolEst: 0.60 },
  TSM:   { beta: 1.3,  aiScore: 0.9, isSemiconductor: true,  chinaRisk: true,  annualReturnEst: 0.20, annualVolEst: 0.35 },
  TXN:   { beta: 1.0,  aiScore: 0.4, isSemiconductor: true,  chinaRisk: false, annualReturnEst: 0.10, annualVolEst: 0.25 },
  XOM:   { beta: 0.8,  aiScore: 0.1, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.08, annualVolEst: 0.22 },
};

export function getMeta(symbol: string) {
  return STOCK_META[symbol] ?? { beta: 1.0, aiScore: 0.5, isSemiconductor: false, chinaRisk: false, annualReturnEst: 0.10, annualVolEst: 0.30 };
}

// ── Risk metrics ───────────────────────────────────────────────────────────
export function calcRiskMetrics(
  positions: { symbol: string; liveValue: number }[],
  totalValue: number,
): RiskMetrics {
  const rf = 0.045; // risk-free rate (4.5% T-bill)

  let weightedBeta       = 0;
  let weightedReturn     = 0;
  let weightedVol        = 0;
  let aiExposureValue    = 0;
  let semiconductorValue = 0;
  let chinaRiskValue     = 0;

  positions.forEach(p => {
    const m = getMeta(p.symbol);
    const w = p.liveValue / totalValue;
    weightedBeta   += w * m.beta;
    weightedReturn += w * m.annualReturnEst;
    weightedVol    += w * m.annualVolEst; // simplified; no correlation
    if (m.aiScore >= 0.6) aiExposureValue    += p.liveValue;
    if (m.isSemiconductor) semiconductorValue += p.liveValue;
    if (m.chinaRisk)       chinaRiskValue     += p.liveValue;
  });

  const dailyVol = weightedVol / Math.sqrt(252);
  const sharpe   = weightedVol > 0 ? (weightedReturn - rf) / weightedVol : 0;
  const alpha    = weightedReturn - rf - weightedBeta * (0.12 - rf); // vs SPY ~12%
  const var95    = dailyVol * 1.645 * 100; // 95% 1-day VaR as %

  return {
    sharpe:           Math.round(sharpe * 100) / 100,
    beta:             Math.round(weightedBeta * 100) / 100,
    alpha:            Math.round(alpha * 1000) / 10,
    stdDev:           Math.round(weightedVol * 1000) / 10,
    var95:            Math.round(var95 * 100) / 100,
    maxDrawdown:      -Math.round(weightedVol * 2.5 * 1000) / 10,
    aiExposurePct:    Math.round((aiExposureValue / totalValue) * 100),
    semiconductorPct: Math.round((semiconductorValue / totalValue) * 100),
    chinaRiskPct:     Math.round((chinaRiskValue / totalValue) * 100),
  };
}

// ── Monte Carlo 6-month projection ────────────────────────────────────────
export function runMonteCarlo(
  positions: { symbol: string; liveValue: number }[],
  totalValue: number,
  days = 126,      // ~6 months
  runs  = 1000,
): MonteCarloResult {
  const rf = 0.045 / 252;

  // Weighted daily drift + vol
  let dailyDrift = 0;
  let dailyVol   = 0;
  positions.forEach(p => {
    const m = getMeta(p.symbol);
    const w = p.liveValue / totalValue;
    dailyDrift += w * (m.annualReturnEst / 252);
    dailyVol   += w * (m.annualVolEst / Math.sqrt(252));
  });

  const sims: number[][] = [];
  const finals: number[] = [];

  for (let r = 0; r < runs; r++) {
    let v = totalValue;
    const path = [v];
    for (let d = 0; d < days; d++) {
      const z   = boxMuller();
      const ret = dailyDrift + dailyVol * z;
      v = v * (1 + ret);
      path.push(Math.round(v));
    }
    sims.push(path);
    finals.push(v);
  }

  finals.sort((a, b) => a - b);
  return {
    median: finals[Math.floor(runs * 0.5)],
    p10:    finals[Math.floor(runs * 0.1)],
    p90:    finals[Math.floor(runs * 0.9)],
    simulations: sims.slice(0, 50), // return 50 paths for charting
  };
}

// Box-Muller transform → standard normal
function boxMuller(): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Correlation matrix (simplified) ────────────────────────────────────────
export function pairCorrelation(symA: string, symB: string): number {
  const a = getMeta(symA);
  const b = getMeta(symB);
  // Heuristic: shared sector/theme → higher correlation
  const isSemiA = a.isSemiconductor, isSemiB = b.isSemiconductor;
  if (isSemiA && isSemiB) return 0.75;
  if (a.aiScore >= 0.7 && b.aiScore >= 0.7) return 0.65;
  if (a.beta > 1.5 && b.beta > 1.5) return 0.55;
  return 0.35 + Math.random() * 0.1;
}
