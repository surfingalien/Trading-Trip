# Portfolio Analytics Platform - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Component Reference](#component-reference)
4. [Data Flow](#data-flow)
5. [API Documentation](#api-documentation)
6. [User Guide](#user-guide)
7. [Configuration & Deployment](#configuration--deployment)
8. [Development Guide](#development-guide)
9. [Investment Analysis Framework](#investment-analysis-framework)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Purpose
The Portfolio Analytics Platform is a professional-grade stock market research and portfolio management tool that provides real-time investment signals using Goldman Sachs and Morgan Stanley-style institutional analysis frameworks.

### Key Capabilities
- **Real-time Market Data**: Fetch and display live stock quotes with minimal latency
- **Portfolio Tracking**: Monitor multiple stock positions with detailed performance metrics
- **Investment Signals**: AI-generated buy/sell/hold recommendations with confidence scores
- **Risk Assessment**: Calculate volatility, Sharpe ratios, beta, and risk ratings
- **Professional UI**: Responsive dashboard with institutional-grade design

### Target Users
- Individual investors seeking professional-grade analysis
- Portfolio managers evaluating trading opportunities
- Financial analysts requiring systematic research tools
- Traders requiring structured decision-making frameworks

### Tech Stack
- **Frontend**: React 19.2.4 with Next.js 16.2.1 (App Router)
- **Styling**: Tailwind CSS 3.4.1 with shadcn/ui components
- **Language**: TypeScript 5.9.3 with strict type checking
- **Charts**: Recharts 2.13.0
- **Icons**: Lucide React 0.451.0
- **HTTP Client**: Axios 1.7.7
- **Runtime**: Node.js with Edge Runtime support

---

## System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                      │
│              (Next.js App Router + React Components)             │
└────────────────┬──────────────────────────────────────┬──────────┘
                 │                                      │
                 ▼                                      ▼
    ┌──────────────────────┐         ┌─────────────────────────┐
    │ Portfolio Dashboard  │         │  Stock Details Page     │
    │  - Position Table    │         │  - Analysis Details     │
    │  - Performance Metrics│        │  - Risk Metrics         │
    │  - Buy/Sell Signals  │         │  - Trading Signals      │
    └──────────────────────┘         └─────────────────────────┘
                 │                                      │
                 │        Service Layer                 │
                 └──────────────────────┬───────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                             │
        ┌────────▼─────────────┐            ┌────────────────┬▼──────────┐
        │ MarketDataService    │            │ InvestmentAnalysis       │
        │ - Stock Quotes       │            │ - Buy/Sell Signals       │
        │ - Portfolio Metrics  │            │ - Risk Calculation       │
        │ - Real-time Updates  │            │ - Confidence Scoring     │
        └────────┬─────────────┘            └─────────────────────────┘
                 │                                    │
                 │         Data Access Layer          │
                 └──────────────────────┬─────────────┘
                                        │
                 ┌──────────────────────┴─────────────────────┐
                 │                                            │
        ┌────────▼─────────────┐                ┌────────────▼─────────┐
        │   Mock Data Store    │                │   Market Data API    │
        │   (Current Stage)    │                │   (Production Ready) │
        └──────────────────────┘                └──────────────────────┘
```

### Layer Descriptions

#### 1. User Interface Layer
- **Next.js App Router**: Server-side rendering and client-side interactivity
- **React Components**: Modular, reusable UI building blocks
- **Tailwind CSS**: Utility-first styling with responsive design
- **shadcn/ui**: Pre-built accessible components (Card, Button, Badge, Input)

#### 2. Service Layer
- **MarketDataService**: Centralized market data management
- **InvestmentAnalysisService**: Analysis algorithms and signal generation
- **Portfolio Management**: Position tracking and aggregation

#### 3. Data Access Layer
- **Mock Data Store**: Current demonstration data (AAPL, MSFT, GOOGL, TSLA)
- **External APIs**: Ready for production integration (Yahoo Finance, Alpha Vantage, Finnhub)

---

## Component Reference

### Core Services

#### MarketDataService

**Class**: `MarketDataService`
**Pattern**: Singleton

**Purpose**: Centralized service for fetching market data and managing portfolio metrics.

**Key Methods**:

```typescript
// Get current price and metrics for a single stock
async getStockQuote(symbol: string): Promise<StockData | null>

// Fetch quotes for multiple stocks in parallel
async getMultipleQuotes(symbols: string[]): Promise<StockData[]>

// Calculate aggregate portfolio metrics
async calculatePortfolioMetrics(
  positions: PortfolioPosition[]
): Promise<{
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
}>
```

**Data Structures**:

```typescript
interface StockData {
  symbol: string;              // Ticker symbol (e.g., 'AAPL')
  name: string;               // Company name
  price: number;              // Current market price
  change: number;             // Dollar change from previous close
  changePercent: number;      // Percentage change
  volume: number;            // Trading volume
  marketCap: number;         // Market capitalization
  peRatio: number;           // P/E ratio
  dividendYield: number;     // Dividend yield as decimal
  fiftyTwoWeekHigh: number; // 52-week high price
  fiftyTwoWeekLow: number;  // 52-week low price
  avgVolume: number;          // Average daily volume
  beta: number;               // Beta coefficient
}

interface PortfolioPosition {
  symbol: string;             // Stock symbol
  shares: number;            // Number of shares held
  averageCost: number;       // Cost basis per share
  currentValue: number;      // Market value of position
  unrealizedGain: number;    // Gain/loss in dollars
  weight: number;            // Position as % of portfolio
}
```

**Implementation Notes**:
- Currently uses mock data with simulated delays (100ms)
- Adds ±5% price variation to simulate real-time market movements
- Singleton pattern ensures single instance across application
- Ready for replacement with real API (Yahoo Finance, Alpha Vantage, Finnhub)

---

#### InvestmentAnalysisService

**Class**: `InvestmentAnalysisService`
**Pattern**: Standard instantiation with shared MarketDataService

**Purpose**: Generate investment signals and analyze risk metrics using institutional frameworks.

**Key Methods**:

```typescript
// Complete analysis for a single stock
async analyzeStock(symbol: string): Promise<{
  data: StockData;
  signals: BuySellSignal;
  risk: RiskMetrics;
}>

// Generate buy/sell signals based on multiple criteria
private async generateSignals(
  stockData: StockData
): Promise<BuySellSignal>

// Calculate risk metrics
private async calculateRiskMetrics(symbol: string): Promise<RiskMetrics>
```

**Data Structures**:

```typescript
interface BuySellSignal {
  symbol: string;                    // Stock symbol
  action: 'BUY' | 'SELL' | 'HOLD';  // Action recommendation
  confidence: number;                // Confidence score (0-1)
  reasoning: string[];              // Detailed reasoning
  targetPrice?: number;             // Target price for BUY
  stopLoss?: number;                // Stop loss for SELL
  timeframe: string;                // Investment timeframe
}

interface RiskMetrics {
  volatility: number;     // Stock price volatility
  sharpeRatio: number;   // Risk-adjusted return metric
  maxDrawdown: number;   // Maximum peak-to-trough decline
  beta: number;          // Market sensitivity
  riskRating: 1 | 2 | 3 | 4 | 5;  // 1=Low, 5=High
}
```

**Signal Generation Algorithm**:

The analysis follows this priority sequence:

1. **P/E Ratio Analysis**
   - Compare to sector average (base: 20)
   - P/E < 16%: Strong buy signal (+0.2 confidence)
   - P/E > 24%: Weak signal (-0.2 confidence)

2. **Price Position Analysis (52-week range)**
   - Position < 30%: Near 52-week low, BUY signal (+0.3 confidence)
   - Position > 80%: Near 52-week high, SELL signal (+0.2 confidence)
   - Base confidence: 0.5 (HOLD)

3. **Dividend Yield Analysis**
   - Yield > 3%: Positive signal (+0.1 confidence)
   - Component of income investing thesis

4. **Volume Analysis**
   - Volume > 1M shares: Strong interest (+0.1 confidence)
   - Used to confirm signal strength

5. **Final Action Determination**
   - Confidence ≥ 0.7: Action = BUY or SELL
   - Confidence 0.4-0.7: Action = HOLD
   - Reasoning compiled from all factors

---

### UI Components

All UI components are located in `components/ui/` and built on shadcn/ui:

#### Card
- Container for grouped content
- Supports header, content, and footer sections
- Props: `className`, `children`

#### Button
- Primary action trigger
- Variants: default, outline, ghost, link
- Props: `onClick`, `disabled`, `variant`, `size`

#### Input
- Text field for user input
- Props: `value`, `onChange`, `placeholder`, `disabled`, `type`

#### Badge
- Small component for labeling (signal type, status)
- Variants: default, secondary, destructive, outline
- Props: `variant`, `children`

---

### Page Components

#### PortfolioDashboard (`app/page.tsx`)

**Purpose**: Main landing page displaying portfolio overview and trading signals.

**Features**:
- Portfolio performance summary (total value, gain/loss)
- Real-time stock position table
- Buy/sell signal visualization
- Color-coded signal confidence
- Responsive grid layout

**State Management**:
```typescript
const [portfolio, setPortfolio] = useState(mockPortfolio);
const [stockData, setStockData] = useState<StockData[]>([]);
const [signals, setSignals] = useState<BuySellSignal[]>([]);
const [loading, setLoading] = useState(true);
const [selectedStock, setSelectedStock] = useState<string | null>(null);
```

**Data Loading Flow**:
1. Component mounts
2. `loadPortfolioData()` triggered
3. Fetch stock quotes for all positions concurrently
4. Update position values with current prices
5. Generate investment signals
6. Render dashboard

**Performance Optimization**:
- Parallel fetching of multiple quotes
- Memoization of unchanged components
- Debounced real-time updates

---

## Data Flow

### Complete Request/Response Cycle

```
1. User Visits http://localhost:3000
   │
   ├─► Next.js renders PortfolioDashboard component
   └─► React mounts and triggers useEffect hook

2. loadPortfolioData() Execution
   │
   ├─► Extract symbols from mockPortfolio.positions
   │   (symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'])
   │
   ├─► Call marketDataService.getMultipleQuotes(symbols)
   │   │
   │   ├─► For each symbol, call getStockQuote(symbol) in parallel
   │   │   │
   │   │   ├─► Simulate API delay (100ms)
   │   │   ├─► Fetch mock data for symbol
   │   │   ├─► Apply ±5% price variation
   │   │   └─► Return StockData object
   │   │
   │   └─► Promise.all() waits for all quotes
   │
   ├─► Update portfolio positions with current prices
   │   │
   │   └─► For each position:
   │       currentValue = shares × currentPrice
   │       unrealizedGain = currentValue - (shares × averageCost)
   │
   ├─► Calculate portfolio metrics
   │   │
   │   └─► totalValue = sum of all positions
   │       totalGain = sum of all unrealizedGains
   │
   ├─► Generate buy/sell signals
   │   │
   │   └─► For each stock quote:
   │       call analysisService.generateSignals(stockData)
   │
   └─► Render updated dashboard

3. Signal Generation Deep Dive
   │
   ├─► Evaluate P/E ratio vs sector average
   ├─► Calculate price position (52-week range)
   ├─► Check dividend yield
   ├─► Analyze trading volume
   ├─► Compile reasoning array
   ├─► Determine action (BUY/SELL/HOLD)
   └─► Return BuySellSignal with confidence score

4. Dashboard Rendering
   │
   ├─► Display portfolio summary
   ├─► Show color-coded signals
   │   ├─► Green: BUY (confidence high)
   │   ├─► Red: SELL (confidence high)
   │   └─► Yellow: HOLD (confidence medium)
   └─► Enable user interactions (click stock, drill down)
```

### Data Dependencies
```
mockPortfolio (initial state)
    │
    ├─► Portfolio.positions[]
    │   │
    │   └─► For each position → fetch StockData
    │       │
    │       └─► Generate BuySellSignal
    │           └─► Render with signal badge
    │
    └─► Portfolio metrics
        ├─► totalValue
        ├─► totalGain
        └─► totalGainPercent
```

---

## API Documentation

### MarketDataService API

#### getDe getStockQuote(symbol: string)

**Input**: 
- `symbol` (string): Stock ticker symbol

**Output**:
- Promise<StockData | null>

**Behavior**:
- Returns null if symbol not found
- Simulates 100ms API latency
- Applies ±5% price variation
- Thread-safe singleton access

**Example**:
```typescript
const service = MarketDataService.getInstance();
const appleData = await service.getStockQuote('AAPL');
// Result:
// {
//   symbol: 'AAPL',
//   name: 'Apple Inc.',
//   price: 175.43,
//   ...
// }
```

---

#### getMultipleQuotes(symbols: string[])

**Input**:
- `symbols` (string[]): Array of stock tickers

**Output**:
- Promise<StockData[]>

**Behavior**:
- Fetches all quotes in parallel using Promise.all()
- Filters out null/failed responses
- Returns array of successful results

**Example**:
```typescript
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];
const quotes = await service.getMultipleQuotes(symbols);
// Result: [StockData, StockData, StockData, StockData]
```

---

#### calculatePortfolioMetrics(positions: PortfolioPosition[])

**Input**:
- `positions` (PortfolioPosition[]): Array of held positions

**Output**:
```typescript
Promise<{
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
}>
```

**Calculation Formula**:
- totalValue = Σ(position.currentValue)
- totalCost = Σ(shares × averageCost)
- totalGain = totalValue - totalCost
- totalGainPercent = (totalGain / totalCost) × 100

**Example**:
```typescript
const metrics = await service.calculatePortfolioMetrics(portfolio.positions);
// Result:
// {
//   totalValue: 95500.00,
//   totalCost: 81240.00,
//   totalGain: 14260.00,
//   totalGainPercent: 17.53
// }
```

---

### InvestmentAnalysisService API

#### generateSignals(stockData: StockData)

**Input**:
- `stockData` (StockData): Stock data object

**Output**:
- Promise<BuySellSignal>

**Signal Priority**:
1. P/E Ratio (-0.2 to +0.2 confidence impact)
2. 52-Week Price Position (-0.3 to +0.3)
3. Dividend Yield (+0.1)
4. Trading Volume (+0.1)
5. Final Action Determination

**Confidence Thresholds**:
- ≥ 0.7: Strong signal (BUY or SELL)
- 0.4-0.7: Moderate signal (HOLD)
- < 0.4: Weak signal (HOLD)

**Example**:
```typescript
const signal = await analysisService.generateSignals(appleData);
// Result:
// {
//   symbol: 'AAPL',
//   action: 'BUY',
//   confidence: 0.75,
//   reasoning: [
//     'P/E ratio (28.5) is attractive...',
//     'Stock is near 52-week low...',
//     'High trading volume indicates...'
//   ],
//   targetPrice: 185.00,
//   stopLoss: 165.00,
//   timeframe: '3-6 months'
// }
```

---

## User Guide

### Getting Started

#### 1. Installation
```bash
# Clone or navigate to project
cd /Users/SurfingAlien/Stock

# Install dependencies
npm install

# This installs:
# - Next.js & React
# - TypeScript
# - Tailwind CSS & shadcn/ui
# - Lucide icons
# - Recharts
```

#### 2. Starting the Application
```bash
# Start development server
npm run dev

# Server runs on http://localhost:3000
# Hot reload enabled for development
```

#### 3. First Visit
- Dashboard loads automatically
- Portfolio positions display with current mock prices
- Real-time data updates every few seconds
- Investment signals show as colored badges

### Navigation

#### Main Dashboard
- **URL**: `http://localhost:3000`
- **Display**: Portfolio overview with all positions
- **Components**:
  - Summary metrics (total value, gain/loss)
  - Position table with individual stocks
  - Signal badges (BUY/SELL/HOLD)
  - Confidence indicators

#### Stock Details
- Click any stock position for detailed analysis
- View:
  - Real-time price with change percentage
  - Historical performance (52-week high/low)
  - Buy/sell signal reasoning
  - Risk metrics (volatility, beta)
  - Recommended price targets

### Understanding the Signals

#### Signal Types

**BUY** (Green Badge)
- Indicates undervalued stock
- Action: Consider adding to position
- Conditions: P/E attractive, price near 52-week low, strong volume
- Confidence: ≥ 0.7 (70%)

**SELL** (Red Badge)
- Indicates overvalued or weakness
- Action: Consider reducing position
- Conditions: P/E elevated, price near 52-week high
- Confidence: ≥ 0.7 (70%)

**HOLD** (Yellow Badge)
- Indicates neutral position
- Action: Monitor for better entry/exit
- Conditions: Mixed or moderate signals
- Confidence: 0.4-0.7 (40-70%)

#### Confidence Score
- Range: 0-100%
- >70%: Strong signal, higher probability
- 40-70%: Moderate signal, monitor closely
- <40%: Weak signal, unclear direction

### Interpreting Performance Metrics

#### Portfolio Summary
- **Total Value**: Current market value of all positions
- **Total Gain/Loss**: Dollar amount gained or lost
- **Gain %**: Percentage return on invested capital
- **Portfolio Weight**: Individual position as % of total

#### Per-Position Metrics
- **Current Price**: Real-time market price
- **Shares**: Number of shares held
- **Position Value**: Current = Shares × Price
- **Unrealized Gain/Loss**: Profit/loss if sold today
- **Cost Basis**: Original purchase price per share

### Decision Making

#### Investment Workflow
1. **Review Dashboard**: Check all positions and signals
2. **Examine Reasoning**: Read detailed signal justification
3. **Consider Context**: Cross-reference with market news
4. **Check Risk**: Verify your risk tolerance against volatility
5. **Set Decisions**: Use target prices and stop losses
6. **Track Changes**: Monitor position updates

#### Example Decision Matrix
```
Signal  | Confidence | Action
--------|------------|--------
BUY     | HIGH (>70%)| Strong add opportunity
BUY     | MED (40-70%)| Monitor before adding
HOLD    | HIGH       | Maintain position
SELL    | HIGH (>70%)| Consider trimming
SELL    | MED (40-70%)| Set stop loss to protect
```

---

## Configuration & Deployment

### Development Configuration

#### Environment Variables
```bash
# .env.local (create in root)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development
```

#### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### Next.js Configuration (`next.config.js`)
```javascript
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  // Add compression, optimization
}
```

### Production Deployment

#### Pre-Deployment Checklist
- [ ] Replace mock data with live API integration
- [ ] Set up authentication/authorization
- [ ] Configure real market data API (Yahoo Finance, Alpha Vantage, Finnhub)
- [ ] Set up error tracking (Sentry)
- [ ] Configure logging (Datadog, LogRocket)
- [ ] Run security audit (`npm audit`)
- [ ] Performance testing

#### Build for Production
```bash
# Build optimized bundle
npm run build

# Start production server
npm start

# Or deploy to Vercel (one-click deployment)
vercel deploy
```

#### Deployment Platforms

**Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**AWS Amplify**
```bash
amplify init
amplify add hosting
amplify publish
```

### Performance Optimization

#### Frontend Optimization
```typescript
// Use React.memo for expensive components
const StockCard = React.memo(({ stock }) => (
  // Component implementation
));

// Implement code splitting
const StockDetails = dynamic(
  () => import('./StockDetails'),
  { loading: () => <Skeleton /> }
);

// Use useMemo for expensive calculations
const memoizedData = useMemo(
  () => expensiveCalculation(data),
  [data]
);
```

#### API Optimization
- Implement response caching (Redis)
- Use request batching
- Pagination for large datasets
- Compression (gzip)

#### Database Optimization (if applicable)
- Index frequently queried columns
- Normalize schema
- Connection pooling
- Query optimization

---

## Development Guide

### Project Structure
```
/Users/SurfingAlien/Stock/
├── app/
│   ├── page.tsx              # Main dashboard component
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   └── ui/                   # shadcn/ui components
│       ├── card.tsx
│       ├── button.tsx
│       ├── badge.tsx
│       └── input.tsx
├── lib/
│   ├── marketData.ts         # Market data service
│   ├── investmentAnalysis.ts # Analysis service
│   └── portfolioData.ts      # Portfolio data
├── node_modules/             # Dependencies
├── public/                   # Static assets
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── tailwind.config.js        # Tailwind CSS config
└── next.config.js            # Next.js config
```

### Development Workflow

#### Adding a New Feature

1. **Create Component** (if UI)
```typescript
// components/MyNewComponent.tsx
export default function MyNewComponent({ prop }: { prop: string }) {
  return <div>{prop}</div>;
}
```

2. **Add Service Logic** (if business logic)
```typescript
// lib/myService.ts
export class MyService {
  async getData(): Promise<MyData> {
    // Implementation
  }
}
```

3. **Integrate into Page**
```typescript
// app/page.tsx
import MyNewComponent from '@/components/MyNewComponent';
import { MyService } from '@/lib/myService';

export default function Page() {
  const service = new MyService();
  // Use component and service
}
```

#### Code Style Guidelines

- **Naming**:
  - PascalCase for components and classes
  - camelCase for functions and variables
  - CONSTANT_CASE for constants

- **Formatting**:
  - 2-space indentation
  - Semicolons required
  - Trailing commas in multi-line objects
  - 80-100 character line width

- **Type Safety**:
  - Always use TypeScript interfaces
  - Avoid `any` type
  - Explicit return types on functions

#### Common Development Tasks

**Adding a New Stock to Mock Data**:
```typescript
// lib/marketData.ts
private mockData: Record<string, StockData> = {
  'AAPL': { /* ... */ },
  'NEWSTOCK': {  // Add here
    symbol: 'NEWSTOCK',
    name: 'New Company',
    price: 100.00,
    // ... other fields
  }
};
```

**Modifying Signal Generation**:
```typescript
// lib/investmentAnalysis.ts
private async generateSignals(stockData: StockData): Promise<BuySellSignal> {
  // Add new analysis criteria
  // Update reasoning array
  // Adjust confidence score
}
```

**Tweaking UI Components**:
```typescript
// Tailwind classes in component
<Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
  {/* Customize styling */}
</Card>
```

---

## Investment Analysis Framework

### Analysis Philosophy

The platform implements multi-factor analysis combining:
- **Fundamental Analysis**: P/E ratio, dividend yield, market cap
- **Technical Analysis**: Price position within 52-week range, volume trends
- **Risk Analysis**: Beta, volatility, price volatility
- **Sentiment Analysis**: Volume patterns, market positioning

### Signal Generation Algorithm (Detailed)

#### Phase 1: Data Preparation
```
Input: StockData object with current market metrics
Output: Normalized metrics for comparison
```

#### Phase 2: Multi-Factor Analysis
```
P/E Analysis:
  └─ Benchmark: Sector average P/E (~20)
  └─ Low P/E (<16): Strong buy indicator
  └─ High P/E (>24): Weak indicator

Price Positioning:
  └─ Calculate: (Price - 52w Low) / (52w High - 52w Low)
  └─ Position < 30% (near low): BUY signal
  └─ Position > 80% (near high): SELL signal

Dividend Yield:
  └─ Threshold: > 3%
  └─ Indicates: Income-producing stock

Volume Analysis:
  └─ Benchmark: 1M+ shares daily
  └─ Indicates: Liquid, actively traded
```

#### Phase 3: Confidence Calculation
```
Base confidence: 0.5 (neutral HOLD)

Adjustments:
+ 0.2 (attractive P/E)
- 0.2 (expensive P/E)
+ 0.3 (near 52-week low)
+ 0.2 (near 52-week high for SELL)
+ 0.1 (strong dividend)
+ 0.1 (high volume)

Final confidence: Sum of adjustments clamped to [0, 1]
```

#### Phase 4: Action Determination
```
Confidence ≥ 0.7:
  └─ Determine BUY or SELL based on dominant factor

Confidence 0.4-0.7:
  └─ HOLD (mixed signals)

Confidence < 0.4:
  └─ HOLD (insufficient conviction)
```

### Limitations & Disclaimers

- **Mock Data**: Current platform uses simulated prices
- **No Real APIs**: Requires integration for production use
- **Historical Data**: Limited to current snapshot
- **Market Events**: Doesn't account for earnings announcements, geopolitical events
- **Herd Mentality**: Doesn't consider market psychology
- **Tax Implications**: Doesn't account for tax-loss harvesting

---

## Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Error: Port 3000 already in use
lsof -i :3000  # Check what's running
kill -9 <PID>  # Kill the process
npm run dev    # Try again

# Or use different port:
npm run dev -- -p 3001
```

#### Module Not Found Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart server
npm run dev
```

#### TypeScript Compilation Errors
```bash
# Check TypeScript version
npx tsc --version

# Rebuild TypeScript
npm run build

# If still failing, check tsconfig.json paths
```

#### Mock Data Not Updating
```typescript
// Ensure mock data is fresh
const variation = Math.random();  // Ensures randomness
// Don't cache responses
const data = { ...this.mockData[symbol] };
```

#### Performance Issues

**Slow Dashboard Loading**:
- Check network tab (DevTools)
- Reduce number of concurrent requests
- Implement pagination
- Use React.memo for components

**High CPU Usage**:
- Profile with DevTools Performance tab
- Check for unnecessary re-renders
- Use React.lazy for code splitting

### Getting Help

#### Debug Mode
```typescript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug:', data);
}
```

#### Check Logs
```bash
# Terminal output shows:
# - Next.js compilation status
# - Build errors
# - Runtime warnings

# Browser console shows:
# - Client-side errors
# - Network requests
# - Component warnings
```

#### Common Solutions

| Error | Solution |
|-------|----------|
| 500 Server Error | Check console logs, restart server |
| Missing modules | `npm install`, clear cache |
| Styling not applied | Check Tailwind config, restart |
| Data not loading | Verify mock data exists, check API |
| Slow performance | Profile with DevTools, optimize |

---

## API Integration Guide

### Preparing for Real Market Data

#### Step 1: Choose Data Provider

**Option A: Yahoo Finance API**
```bash
npm install yahoo-finance2
# Note: Has Node.js compatibility issues in browser environment
# Use for server-side only
```

**Option B: Alpha Vantage**
```bash
npm install alphavantage
# Free tier: 5 requests/min, 500/day
# Good for getting started
```

**Option C: Finnhub**
```bash
npm install finnhub
# Free tier: 60 requests/min
# Better rate limits than Alpha Vantage
```

#### Step 2: Update MarketDataService

```typescript
// lib/marketData.ts
import Finnhub from 'finnhub';

export class MarketDataService {
  private finnhub = new Finnhub({
    token: process.env.FINNHUB_API_KEY
  });

  async getStockQuote(symbol: string): Promise<StockData | null> {
    try {
      const quote = await this.finnhub.quote(symbol);
      return {
        symbol,
        name: symbol,
        price: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        // ... map other fields
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      return null;
    }
  }
}
```

#### Step 3: Environment Configuration

```bash
# .env.local
FINNHUB_API_KEY=your_api_key_here
ALPHA_VANTAGE_KEY=your_key_here
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

---

## Conclusion

This portfolio analytics platform provides a solid foundation for institutional-grade investment analysis. With mock data ready, it demonstrates the complete architecture and can be quickly integrated with real market data sources to create a production-ready application.

For questions or contributions, refer to the component documentation and development guide above.

**Version**: 1.0.0  
**Last Updated**: March 25, 2026  
**Status**: Development Ready
