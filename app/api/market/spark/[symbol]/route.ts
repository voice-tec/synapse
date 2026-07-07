import { NextRequest, NextResponse } from 'next/server';
import { fetchSeries } from '@/lib/quotes';

// Sparkline per le card/dettaglio del marketplace: ultimi ~30 giorni di
// chiusure per un simbolo. Cache CDN dura (1h + SWR 24h): protegge il free
// tier TwelveData — al massimo una chiamata per simbolo l'ora, condivisa da
// tutti gli utenti. Errore o simbolo ignoto → 404 silenzioso (la UI nasconde).
export async function GET(_req: NextRequest, { params }: { params: { symbol: string } }) {
  const symbol = (params.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: 'bad_symbol' }, { status: 404 });
  }

  const fromIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  try {
    const series = await fetchSeries(symbol, fromIso);
    if (!series || series.closes.length < 2) {
      return NextResponse.json({ error: 'no_data' }, { status: 404 });
    }
    const closes = series.closes;
    const pct = Math.round(((closes[closes.length - 1] - closes[0]) / closes[0]) * 1000) / 10;
    return NextResponse.json(
      { symbol, closes, pct },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ error: 'no_data' }, { status: 404 });
  }
}
