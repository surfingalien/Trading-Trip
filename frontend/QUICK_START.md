# Quick Start Guide

## 🚀 Get Running in 2 Minutes

### 1. Start the Server
```bash
npm run dev
```

### 2. Open Browser
```
http://localhost:3000
```

That's it! Dashboard loads with portfolio and signals.

---

## 📊 What You'll See

```
PORTFOLIO ANALYTICS DASHBOARD
═══════════════════════════════════════════════════════════

Portfolio Summary
├─ Total Value: $95,500.00
├─ Total Gain: $14,260.00 (+14.9%)
└─ Positions: 4 stocks

Positions Table
┌─────┬────────┬──────────┬────────────┬────────┬────────┐
│ #   │ Symbol │ Price    │ Shares     │ Value  │ Signal │
├─────┼────────┼──────────┼────────────┼────────┼────────┤
│ 1   │ AAPL   │ $175.43  │ 100        │ $17.5K │ 🟢 BUY │
│ 2   │ MSFT   │ $415.26  │ 50         │ $20.7K │ 🟡 HLD │
│ 3   │ GOOGL  │ $141.80  │ 20         │ $52.3K │ 🔴 SLL │
│ 4   │ TSLA   │ $248.95  │ 30         │ $4.8K  │ 🟡 HLD │
└─────┴────────┴──────────┴────────────┴────────┴────────┘

Legend:
  🟢 BUY  = Strong buying opportunity
  🔴 SELL = Profit-taking recommended
  🟡 HOLD = Mixed signals, monitor
```

---

## 🎯 Key Files to Know

### Backend Services
- **`lib/marketData.ts`** - Fetch stock quotes & calculate metrics
- **`lib/investmentAnalysis.ts`** - Generate buy/sell signals
- **`lib/portfolioData.ts`** - Portfolio positions & holdings

### Frontend
- **`app/page.tsx`** - Main dashboard component
- **`components/ui/`** - UI building blocks (Card, Button, Badge)

### Configuration
- **`tsconfig.json`** - TypeScript path mappings
- **`tailwind.config.js`** - Styling configuration
- **`next.config.js`** - Next.js settings

---

## 🔧 Common Tasks

### Add a New Stock to Mock Data
```typescript
// lib/marketData.ts → mockData object
'NVDA': {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  price: 850.00,
  change: 12.50,
  // ... other fields
}
```

### Change Signal Thresholds
```typescript
// lib/investmentAnalysis.ts → generateSignals()
const sectorAvgPE = 20;  // Change this
if (stockData.peRatio < sectorAvgPE * 0.8) {
  // P/E is attractive
}
```

### Modify Dashboard Colors
```typescript
// app/page.tsx
<Badge 
  className="bg-green-100 text-green-800"  // Change colors
>
  {signal.action}
</Badge>
```

### Switch to Real API
```typescript
// lib/marketData.ts
import Finnhub from 'finnhub';

async getStockQuote(symbol: string) {
  const quote = await this.finnhub.quote(symbol);
  // Map response to StockData
}
```

---

## 📈 Understanding Signals

### BUY Signal (🟢) - 75% Confidence
**When**: Stock near 52-week low, attractive P/E, high volume
**Action**: Consider adding to position
**Target**: +10-15% upside
**Timeframe**: 3-6 months

### SELL Signal (🔴) - 70% Confidence
**When**: Stock near 52-week high, elevated P/E, weak fundamentals
**Action**: Consider reducing position
**Target**: Profit-taking
**Timeframe**: Immediate to 1 month

### HOLD Signal (🟡) - 50-65% Confidence
**When**: Mixed indicators, unclear direction
**Action**: Monitor and wait for clarity
**Target**: Watch for signal change
**Timeframe**: 1-3 months

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| Module not found | `rm -rf .next && npm run dev` |
| Price not updating | Check `marketData.ts` variance function |
| Signals not showing | Verify `investmentAnalysis.ts` returns data |
| Styles look broken | Check `tailwind.config.js` paths |

---

## 📚 Learn More

- **Full Documentation**: See `DOCUMENTATION.md`
- **Architecture**: See diagrams in `DOCUMENTATION.md`
- **API Reference**: See `DOCUMENTATION.md` → API Documentation
- **Development**: See `DOCUMENTATION.md` → Development Guide

---

## 🚀 Next: Add Real Market Data

Ready to use live data? Choose an API:

### Option 1: Alpha Vantage (Recommended)
```bash
npm install alphavantage
# Free: 5 req/min, 500/day
```

### Option 2: Finnhub
```bash
npm install finnhub
# Free: 60 req/min
```

### Option 3: Yahoo Finance
```bash
npm install yahoo-finance2
# No official free tier, use unofficial
```

Then update `lib/marketData.ts` to use the API instead of mock data.

---

## ✨ Quick Reference

### Component Props
```typescript
// Button
<Button onClick={handler} disabled={false} variant="default">
  Click me
</Button>

// Card
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Badge
<Badge variant="default">BUY</Badge>  {/* green */}
<Badge variant="destructive">SELL</Badge>  {/* red */}
```

### Service Methods
```typescript
// MarketDataService
const service = MarketDataService.getInstance();
const quote = await service.getStockQuote('AAPL');
const quotes = await service.getMultipleQuotes(['AAPL', 'MSFT']);
const metrics = await service.calculatePortfolioMetrics(positions);

// InvestmentAnalysisService  
const analysis = new InvestmentAnalysisService();
const signal = await analysis.generateSignals(stockData);
const risk = await analysis.calculateRiskMetrics('AAPL');
```

---

## 🎓 Study Path

### Beginner
1. Run `npm run dev`
2. View dashboard at `http://localhost:3000`
3. Read through `app/page.tsx` to understand component structure
4. Check `lib/portfolioData.ts` to see mock data format

### Intermediate
1. Modify mock data prices in `lib/marketData.ts`
2. Change signal thresholds in `lib/investmentAnalysis.ts`
3. Update UI colors in `app/page.tsx`
4. Add new UI components from `components/ui/`

### Advanced
1. Integrate real API (Alpha Vantage, Finnhub, Yahoo Finance)
2. Add database for storing portfolio history
3. Implement user authentication
4. Deploy to production (Vercel, AWS, Railway)

---

## 💡 Pro Tips

1. **Use DevTools** → F12 to inspect network requests and console
2. **Hot Reload** → Changes save automatically during `npm run dev`
3. **TypeScript** → Hover over code for type hints
4. **Component Testing** → Modify component locally without affecting tests
5. **Network Tab** → Watch API calls and response times

---

**Need more help?** → See `DOCUMENTATION.md` for complete reference  
**Want to deploy?** → See `DOCUMENTATION.md` → Configuration & Deployment  
**Having issues?** → See `DOCUMENTATION.md` → Troubleshooting
