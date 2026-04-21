import { NextResponse } from 'next/server';

const API_BASE = process.env.TRADING_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/snapshot`, { next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Trading API unavailable' }, { status: 503 });
  }
}
