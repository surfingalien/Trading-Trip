import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.TRADING_API_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol   = searchParams.get('symbol') || '';
  const strategy = searchParams.get('strategy') || 'rsi';
  const period   = searchParams.get('period') || '1y';

  try {
    const res = await fetch(
      `${API_BASE}/api/backtest/${symbol}?strategy=${strategy}&period=${period}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Trading API unavailable' }, { status: 503 });
  }
}
