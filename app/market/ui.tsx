'use client';
// Componenti e costanti condivisi dalle pagine marketplace (/market, /market/a/[ref],
// /market/mine). Stile: inline, tema scuro #08080a + Fraunces, coerente col resto.
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { usePublicLang, LangToggle, type Lang } from '@/lib/i18n-public';

// ── Dizionario marketplace (condiviso dalle 3 pagine) ──
export const MT = {
  it: {
    mine: 'le mie pubblicazioni', plans: 'piani', yourGraph: 'il tuo grafo →',
    author: 'autore', confirmedWord: 'confermate', accuracyWord: 'accuratezza',
    importsWord: 'import', importsTitle: 'quante volte è stata importata da altri utenti',
    forksWord: 'fork', forksTitle: 'import ripubblicati (modificati) da altri utenti',
    trackTitle: "accuratezza media dell'autore su tutte le sue tesi",
    updToday: 'aggiornata oggi', updYesterday: 'aggiornata ieri', updDaysAgo: (d: number) => `aggiornata ${d} gg fa`,
    openBtn: 'apri →',
    conf: 'confidenza', imported: '✓ importata', already: '↘ già nel tuo grafo',
    alreadyTitle: "L'hai già importata: è nel tuo grafo", similar: 'hai già una tesi simile',
    retry: 'riprova', importing: 'importo…', save: '+ salva nel mio grafo', loginToImport: 'accedi per importare',
    stConfirmed: 'confermata ✓', stInvalid: 'invalidata ✕', stActive: 'in corso',
  },
  en: {
    mine: 'my publications', plans: 'pricing', yourGraph: 'your graph →',
    author: 'author', confirmedWord: 'confirmed', accuracyWord: 'accuracy',
    importsWord: 'imports', importsTitle: 'how many times other users imported it',
    forksWord: 'forks', forksTitle: 'imports republished (modified) by other users',
    trackTitle: "author's average accuracy across all their theses",
    updToday: 'updated today', updYesterday: 'updated yesterday', updDaysAgo: (d: number) => `updated ${d}d ago`,
    openBtn: 'open →',
    conf: 'confidence', imported: '✓ imported', already: '↘ already in your graph',
    alreadyTitle: 'You already imported it: it is in your graph', similar: 'you already have a similar thesis',
    retry: 'retry', importing: 'importing…', save: '+ save to my graph', loginToImport: 'log in to import',
    stConfirmed: 'confirmed ✓', stInvalid: 'invalidated ✕', stActive: 'active',
  },
};
export type MTDict = typeof MT.it;
export function useMarketLang(): [Lang, (l: Lang) => void, MTDict] {
  const [lang, setLang] = usePublicLang();
  return [lang, setLang, MT[lang]];
}
export const stFor = (t: MTDict): Record<string, { l: string; c: string }> => ({
  confirmed: { l: t.stConfirmed, c: '#4ad68a' },
  invalidated: { l: t.stInvalid, c: '#e05555' },
  active: { l: t.stActive, c: '#7a7a95' },
});

export type Rep = { theses: number; confirmed: number; invalidated: number; accuracy: number | null };
export type Item = {
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; accuracy: number | null; created_at: string; updated_at?: string; sector: string;
  signals: { confirm: string[]; invalidate: string[] } | null;
  author: string; authorName: string | null; authorRep: Rep;
  imports: number; forks?: number; tickers?: string[]; matchedTickers?: string[];
};
export type ImpState = 'idle' | 'loading' | 'done' | 'duplicate' | 'error' | 'already';

export const ST: Record<string, { l: string; c: string }> = {
  confirmed: { l: 'confermata ✓', c: '#4ad68a' },
  invalidated: { l: 'invalidata ✕', c: '#e05555' },
  active: { l: 'in corso', c: '#7a7a95' },
};

export const btnStyle: React.CSSProperties = {
  flexShrink: 0, background: '#a78bfa', color: '#08080a', border: 'none',
  borderRadius: 9, padding: '7px 13px', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
};

export function useAuthed(): boolean {
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setIsAuthed(!!data.user)).catch(() => {});
  }, []);
  return isAuthed;
}

export function MarketTopbar({ isAuthed }: { isAuthed: boolean }) {
  const [lang, setLang, t] = useMarketLang();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1f1f28' }}>
      <a href="/market" style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 300, color: '#e8e8f0', textDecoration: 'none' }}>
        <img src="/logo.png" alt="" style={{ height: 22, width: 'auto', display: 'block' }} />
        Symnaps
      </a>
      <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#241a3a', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em' }}>marketplace</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
        {isAuthed && <a href="/market/mine" style={{ color: '#a78bfa', fontSize: 12, textDecoration: 'none' }}>{t.mine}</a>}
        <a href="/pricing" style={{ color: '#7a7a95', fontSize: 12, textDecoration: 'none' }}>{t.plans}</a>
        <a href="/" style={{ color: '#5b9cf6', fontSize: 12, textDecoration: 'none' }}>{t.yourGraph}</a>
        <LangToggle lang={lang} setLang={setLang} />
      </span>
    </div>
  );
}

export function RepLine({ authorRef, name, rep }: { authorRef: string; name: string | null; rep: Rep }) {
  const [, , t] = useMarketLang();
  return (
    <span>
      {t.author}{' '}
      <a href={`/market/a/${authorRef}`}
        style={{ color: '#9a9ab2', fontFamily: name ? 'inherit' : 'monospace', textDecoration: 'underline', textDecorationColor: '#3a3a50', textUnderlineOffset: 3 }}>
        {name || `#${authorRef}`}
      </a>
      {' '}· {rep.confirmed}/{rep.theses} {t.confirmedWord}{rep.accuracy != null ? ` · ${rep.accuracy}% ${t.accuracyWord}` : ''}
    </span>
  );
}

export function ImportsBadge({ n }: { n: number }) {
  const [, , t] = useMarketLang();
  if (!n) return null;
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#12241a', color: '#4ad68a' }}
      title={t.importsTitle}>
      ↘ {n} {t.importsWord}
    </span>
  );
}

// "aggiornata oggi / ieri / N gg fa" nella lingua corrente.
export function updatedAgo(iso: string | undefined, t: MTDict): string | null {
  if (!iso) return null;
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (!isFinite(d)) return null;
  return d === 0 ? t.updToday : d === 1 ? t.updYesterday : t.updDaysAgo(d);
}

// Card tesi (GitHub delle tesi): solo gli essenziali — confidenza, stato,
// track record autore, fork, import, freschezza. L'import si fa dal dettaglio.
// compact: variante stretta per le row orizzontali della home.
// fadeIndex: ingresso scaglionato (60ms a card, cap a 8).
export function ThesisCard({ it, compact, fadeIndex }: { it: Item; compact?: boolean; fadeIndex?: number }) {
  const [, , t] = useMarketLang();
  const STL = stFor(t);
  const st = STL[it.status] || STL.active;
  const upd = updatedAgo(it.updated_at, t);
  return (
    <div className="mk-card mk-fade" style={{
      animationDelay: `${Math.min(fadeIndex || 0, 8) * 60}ms`,
      background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 14, padding: compact ? '12px 14px' : '16px 18px',
      ...(compact ? { minWidth: 250, maxWidth: 290, flexShrink: 0, display: 'flex', flexDirection: 'column' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 10, color: '#5a5a78', flexWrap: 'wrap' }}>
        <span style={{ color: '#a78bfa' }}>◆ {it.confidence}%</span>
        <span style={{ color: st.c }}>{st.l}</span>
        {it.authorRep?.accuracy != null && <span style={{ color: '#5b9cf6' }} title={t.trackTitle}>📈 {it.authorRep.accuracy}%</span>}
        {(it.forks || 0) > 0 && <span style={{ color: '#f0a030' }} title={t.forksTitle}>⑂ {it.forks}</span>}
        {it.imports > 0 && <span style={{ color: '#4ad68a' }} title={t.importsTitle}>↘ {it.imports}</span>}
        {!compact && it.sector && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#16161e', color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em' }}>{it.sector}</span>}
      </div>
      <a href={`/market/t/${it.id}`} style={{ textDecoration: 'none' }}>
        <div style={{
          fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 300, color: '#d4bbff',
          fontSize: compact ? 13.5 : 16, lineHeight: 1.5, marginBottom: 8,
          ...(compact ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
        }}>"{it.thesis}"</div>
      </a>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <div style={{ flex: 1 }}><AccuracyBar accuracy={it.accuracy} status={it.status} /></div>
          <Sparkline symbol={it.tickers?.[0]} />
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        borderTop: '1px solid #1f1f28', paddingTop: compact ? 8 : 12, marginTop: compact ? 'auto' : 0,
        fontSize: 10.5, color: '#7a7a95',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {compact
            ? <a href={`/market/a/${it.author}`} style={{ color: '#9a9ab2', textDecoration: 'none' }}>{it.authorName || `#${it.author}`}</a>
            : <RepLine authorRef={it.author} name={it.authorName} rep={it.authorRep} />}
          {upd && <span style={{ color: '#5a5a78' }}> · {upd}</span>}
        </span>
        <a href={`/market/t/${it.id}`} style={{ flexShrink: 0, color: '#a78bfa', fontSize: 11, textDecoration: 'none' }}>{t.openBtn}</a>
      </div>
    </div>
  );
}

// Barra orizzontale di accuratezza (0-100) per una tesi: verde/rossa a esito
// chiuso, viola neutro finché in corso. Solo div — niente librerie chart.
export function AccuracyBar({ accuracy, status }: { accuracy: number | null; status: string }) {
  const color = status === 'confirmed' ? '#4ad68a' : status === 'invalidated' ? '#e05555' : '#a78bfa';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#1a1a22', borderRadius: 2, overflow: 'hidden' }}>
        {accuracy != null && <div style={{ width: `${Math.max(2, Math.min(100, accuracy))}%`, height: '100%', background: color, borderRadius: 2 }} />}
      </div>
      <span style={{ fontSize: 10, color: accuracy != null ? color : '#3a3a50', fontFamily: 'monospace', minWidth: 34, textAlign: 'right' }}>
        {accuracy != null ? `${Math.round(accuracy)}%` : '—'}
      </span>
    </div>
  );
}

// StatBox con count-up (rAF ~700ms, ease-out) al cambio valore: le stats
// entrano "vive" invece che piatte. Valori non numerici (es. "—") passano
// diretti; prefers-reduced-motion salta l'animazione.
export function StatBox({ value, label }: { value: string | number; label: string }) {
  const [shown, setShown] = useState<string | number>(typeof value === 'number' ? 0 : value);
  useEffect(() => {
    const m = typeof value === 'number'
      ? { n: value, suf: '' }
      : (() => { const mm = /^(\d+)(.*)$/.exec(String(value)); return mm ? { n: parseInt(mm[1], 10), suf: mm[2] } : null; })();
    if (!m) { setShown(value); return; }
    let raf = 0;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; } } catch {}
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(m.n * eased) + m.suf);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div style={{ flex: 1, minWidth: 110, background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, color: '#e8e8f0' }}>{shown}</div>
      <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Sparkline 30 giorni di un simbolo: SVG hairline, verde/rossa col segno.
// Best-effort: 404 o rete ko → non renderizza nulla (mai placeholder rotti).
export function Sparkline({ symbol, width = 84, height = 22 }: { symbol?: string; width?: number; height?: number }) {
  const [d, setD] = useState<{ closes: number[]; pct: number } | null>(null);
  useEffect(() => {
    if (!symbol) return;
    let dead = false;
    fetch(`/api/market/spark/${encodeURIComponent(symbol)}`).then(async (r) => {
      if (!r.ok) return;
      const j = await r.json().catch(() => null);
      if (!dead && Array.isArray(j?.closes) && j.closes.length >= 2) setD(j);
    }).catch(() => {});
    return () => { dead = true; };
  }, [symbol]);
  if (!symbol || !d) return null;
  const min = Math.min(...d.closes), max = Math.max(...d.closes);
  const span = max - min || 1;
  const pts = d.closes
    .map((c, i) => `${((i / (d.closes.length - 1)) * width).toFixed(1)},${(height - 2 - ((c - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const color = d.pct >= 0 ? '#4ad68a' : '#e05555';
  return (
    <span className="mk-fade" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={`${symbol} · 30d`}>
      <svg width={width} height={height} style={{ display: 'block' }} aria-hidden="true">
        <polyline points={pts} fill="none" stroke={color} strokeOpacity={0.8} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 9.5, fontFamily: 'monospace', color }}>{symbol} {d.pct >= 0 ? '+' : ''}{d.pct}%</span>
    </span>
  );
}
