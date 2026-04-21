import { MarketDataService, StockData, PortfolioPosition } from './marketData';

export interface BuySellSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  targetPrice?: number;
  stopLoss?: number;
  timeframe: string;
}

export interface RiskMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  riskRating: 1 | 2 | 3 | 4 | 5;
}

export class InvestmentAnalysisService {
  private marketData: MarketDataService;

  constructor() {
    this.marketData = MarketDataService.getInstance();
  }

  async analyzeStock(symbol: string): Promise<{
    data: StockData;
    signals: BuySellSignal;
    risk: RiskMetrics;
  }> {
    const data = await this.marketData.getStockQuote(symbol);
    const signals = await this.generateSignals(data!);
    const risk = await this.calculateRiskMetrics(symbol);

    return { data: data!, signals, risk };
  }

  private async generateSignals(stockData: StockData): Promise<BuySellSignal> {
    const reasoning: string[] = [];
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;

    // P/E Ratio Analysis (compared to sector average - simplified)
    const sectorAvgPE = 20; // This would be dynamic in real implementation
    if (stockData.peRatio < sectorAvgPE * 0.8) {
      reasoning.push(`P/E ratio (${stockData.peRatio}) is attractive compared to sector average`);
      confidence += 0.2;
    } else if (stockData.peRatio > sectorAvgPE * 1.2) {
      reasoning.push(`P/E ratio (${stockData.peRatio}) is elevated compared to sector average`);
      confidence -= 0.2;
    }

    // Price vs 52-week levels
    const priceToHigh = (stockData.price - stockData.fiftyTwoWeekLow) /
                       (stockData.fiftyTwoWeekHigh - stockData.fiftyTwoWeekLow);
    if (priceToHigh < 0.3) {
      reasoning.push('Stock is near 52-week low, potential buying opportunity');
      action = 'BUY';
      confidence += 0.3;
    } else if (priceToHigh > 0.8) {
      reasoning.push('Stock is near 52-week high, consider taking profits');
      action = 'SELL';
      confidence += 0.2;
    }

    // Dividend yield
    if (stockData.dividendYield > 0.03) {
      reasoning.push(`Strong dividend yield of ${(stockData.dividendYield * 100).toFixed(2)}%`);
      confidence += 0.1;
    }

    // Volume analysis (simplified)
    if (stockData.volume > 1000000) {
      reasoning.push('High trading volume indicates strong interest');
      confidence += 0.1;
    }

    // Determine final action based on confidence
    if (confidence > 0.7) {
      action = action === 'BUY' ? 'BUY' : 'SELL';
    } else if (confidence < 0.3) {
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    return {
      symbol: stockData.symbol,
      action,
      confidence,
      reasoning,
      targetPrice: stockData.price * (action === 'BUY' ? 1.15 : action === 'SELL' ? 0.85 : 1.05),
      stopLoss: stockData.price * (action === 'BUY' ? 0.9 : action === 'SELL' ? 1.1 : 0.95),
      timeframe: '3-6 months',
    };
  }

  private async calculateRiskMetrics(symbol: string): Promise<RiskMetrics> {
    // Simplified risk calculations - in production, use historical data
    const volatility = Math.random() * 0.3 + 0.1; // 10-40% volatility
    const sharpeRatio = (Math.random() * 2) - 0.5; // -0.5 to 1.5
    const maxDrawdown = Math.random() * 0.4; // 0-40%
    const beta = Math.random() * 2; // 0-2

    let riskRating: 1 | 2 | 3 | 4 | 5 = 3;
    if (volatility < 0.15 && maxDrawdown < 0.2) riskRating = 1;
    else if (volatility > 0.35 || maxDrawdown > 0.35) riskRating = 5;
    else if (volatility > 0.25 || maxDrawdown > 0.25) riskRating = 4;
    else if (volatility < 0.2 && maxDrawdown < 0.15) riskRating = 2;

    return {
      volatility,
      sharpeRatio,
      maxDrawdown,
      beta,
      riskRating,
    };
  }

  async getPortfolioAnalysis(positions: PortfolioPosition[]): Promise<{
    signals: BuySellSignal[];
    portfolioRisk: RiskMetrics;
    recommendations: string[];
  }> {
    const signals = await Promise.all(
      positions.map(pos => this.generateSignals(pos as any))
    );

    // Calculate portfolio-level risk (simplified)
    const portfolioRisk: RiskMetrics = {
      volatility: positions.reduce((sum, pos) => sum + (pos.weight * 0.2), 0),
      sharpeRatio: 1.2,
      maxDrawdown: 0.25,
      beta: 1.1,
      riskRating: 3,
    };

    const recommendations = this.generatePortfolioRecommendations(signals, positions);

    return { signals, portfolioRisk, recommendations };
  }

  private generatePortfolioRecommendations(
    signals: BuySellSignal[],
    positions: PortfolioPosition[]
  ): string[] {
    const recommendations: string[] = [];

    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');

    if (buySignals.length > 0) {
      recommendations.push(`Consider increasing positions in: ${buySignals.map(s => s.symbol).join(', ')}`);
    }

    if (sellSignals.length > 0) {
      recommendations.push(`Consider reducing positions in: ${sellSignals.map(s => s.symbol).join(', ')}`);
    }

    // Diversification check
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const topHoldingWeight = Math.max(...positions.map(p => p.weight));

    if (topHoldingWeight > 0.3) {
      recommendations.push('Portfolio may be over-concentrated in top holdings. Consider rebalancing.');
    }

    return recommendations;
  }
}