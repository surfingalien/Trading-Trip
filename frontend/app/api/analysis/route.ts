import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.TRADING_API_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols') || '';
  try {
    const res = await fetch(
      `${API_BASE}/api/portfolio/analysis?symbols=${encodeURIComponent(symbols)}`,
      { next: { revalidate: 120 } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Trading API unavailable' }, { status: 503 });
  }
}
