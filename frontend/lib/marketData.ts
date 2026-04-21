// Mock market data service for demonstration
// In production, replace with actual API calls

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  avgVolume: number;
  beta: number;
}

export interface PortfolioPosition {
  symbol: string;
  shares: number;
  averageCost: number;
  currentValue: number;
  unrealizedGain: number;
  weight: number;
}

export class MarketDataService {
  private static instance: MarketDataService;
  private mockData: Record<string, StockData> = {
    'AAPL': {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 175.43,
      change: 2.15,
      changePercent: 1.24,
      volume: 45230000,
      marketCap: 2750000000000,
      peRatio: 28.5,
      dividendYield: 0.0052,
      fiftyTwoWeekHigh: 199.62,
      fiftyTwoWeekLow: 164.08,
      avgVolume: 58700000,
      beta: 1.3
    },
    'MSFT': {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      price: 415.26,
      change: -1.45,
      changePercent: -0.35,
      volume: 19800000,
      marketCap: 3080000000000,
      peRatio: 32.1,
      dividendYield: 0.007,
      fiftyTwoWeekHigh: 468.35,
      fiftyTwoWeekLow: 362.90,
      avgVolume: 23400000,
      beta: 0.9
    },
    'GOOGL': {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      price: 141.80,
      change: 3.21,
      changePercent: 2.31,
      volume: 25600000,
      marketCap: 1780000000000,
      peRatio: 25.8,
      dividendYield: 0,
      fiftyTwoWeekHigh: 191.75,
      fiftyTwoWeekLow: 128.12,
      avgVolume: 28900000,
      beta: 1.05
    },
    'TSLA': {
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      price: 248.95,
      change: -5.42,
      changePercent: -2.13,
      volume: 67800000,
      marketCap: 792000000000,
      peRatio: 65.2,
      dividendYield: 0,
      fiftyTwoWeekHigh: 299.29,
      fiftyTwoWeekLow: 138.80,
      avgVolume: 54200000,
      beta: 2.1
    }
  };

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  async getStockQuote(symbol: string): Promise<StockData | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const data = this.mockData[symbol.toUpperCase()];
    if (!data) {
      return null;
    }

    // Add some random variation to make it look real-time
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    return {
      ...data,
      price: data.price * (1 + variation),
      change: data.change + (variation * data.price),
      changePercent: data.changePercent + (variation * 100)
    };
  }

  async getMultipleQuotes(symbols: string[]): Promise<StockData[]> {
    const quotes = await Promise.all(
      symbols.map(symbol => this.getStockQuote(symbol))
    );
    return quotes.filter(quote => quote !== null) as StockData[];
  }

  async calculatePortfolioMetrics(positions: PortfolioPosition[]): Promise<{
    totalValue: number;
    totalCost: number;
    totalGain: number;
    totalGainPercent: number;
  }> {
    let totalValue = 0;
    let totalCost = 0;

    for (const position of positions) {
      totalValue += position.currentValue;
      totalCost += position.shares * position.averageCost;
    }

    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent
    };
  }
}