'use client';
// Componenti e costanti condivisi dalle pagine marketplace (/market, /market/a/[ref],
// /market/mine). Stile: inline, tema scuro #08080a + Fraunces, coerente col resto.
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export type Rep = { theses: number; confirmed: number; invalidated: number; accuracy: number | null };
export type Item = {
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; accuracy: number | null; created_at: string; sector: string;
  signals: { confirm: string[]; invalidate: string[] } | null;
  author: string; authorName: string | null; authorRep: Rep;
  imports: number;
};
export type ImpState = 'idle' | 'loading' | 'done' | 'duplicate' | 'error';

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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1f1f28' }}>
      <a href="/market" style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 300, color: '#e8e8f0', textDecoration: 'none' }}>Symnaps</a>
      <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#241a3a', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em' }}>marketplace</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
        {isAuthed && <a href="/market/mine" style={{ color: '#a78bfa', fontSize: 12, textDecoration: 'none' }}>le mie pubblicazioni</a>}
        <a href="/synapse" style={{ color: '#5b9cf6', fontSize: 12, textDecoration: 'none' }}>il tuo grafo →</a>
      </span>
    </div>
  );
}

export function RepLine({ authorRef, name, rep }: { authorRef: string; name: string | null; rep: Rep }) {
  return (
    <span>
      autore{' '}
      <a href={`/market/a/${authorRef}`}
        style={{ color: '#9a9ab2', fontFamily: name ? 'inherit' : 'monospace', textDecoration: 'underline', textDecorationColor: '#3a3a50', textUnderlineOffset: 3 }}>
        {name || `#${authorRef}`}
      </a>
      {' '}· {rep.confirmed}/{rep.theses} confermate{rep.accuracy != null ? ` · ${rep.accuracy}% accuratezza` : ''}
    </span>
  );
}

export function ImportsBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#12241a', color: '#4ad68a' }}
      title="quante volte è stata importata da altri utenti">
      ↘ {n} import
    </span>
  );
}

export function ThesisCard({ it, impState, onImport, isAuthed }: {
  it: Item; impState: ImpState; onImport: (id: string) => void; isAuthed: boolean;
}) {
  const st = ST[it.status] || ST.active;
  const s = impState;
  return (
    <div style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 10, color: '#5a5a78', flexWrap: 'wrap' }}>
        <span style={{ color: '#a78bfa' }}>◆ confidenza {it.confidence}%</span>
        <span style={{ color: st.c }}>{st.l}</span>
        <ImportsBadge n={it.imports} />
        {it.sector && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#16161e', color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em' }}>{it.sector}</span>}
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 16, fontWeight: 300, lineHeight: 1.5, color: '#d4bbff', marginBottom: 8 }}>"{it.thesis}"</div>
      {it.explanation && <div style={{ fontSize: 11.5, color: '#7a7a95', lineHeight: 1.6, marginBottom: 10 }}>{it.explanation}</div>}
      {it.signals && (
        <div style={{ display: 'flex', gap: 12, fontSize: 10.5, lineHeight: 1.6, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>{it.signals.confirm.map((t, i) => <div key={i} style={{ color: '#4ad68a99' }}>✓ {t}</div>)}</div>
          <div style={{ flex: 1 }}>{it.signals.invalidate.map((t, i) => <div key={i} style={{ color: '#e0555599' }}>✗ {t}</div>)}</div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #1f1f28', paddingTop: 12 }}>
        <div style={{ fontSize: 10.5, color: '#7a7a95' }}>
          <RepLine authorRef={it.author} name={it.authorName} rep={it.authorRep} />
        </div>
        {isAuthed ? (
          s === 'done' ? <span style={{ fontSize: 11.5, color: '#4ad68a' }}>✓ importata</span>
          : s === 'duplicate' ? <span style={{ fontSize: 11.5, color: '#f0a030' }}>hai già una tesi simile</span>
          : s === 'error' ? <button onClick={() => onImport(it.id)} style={btnStyle}>riprova</button>
          : <button onClick={() => onImport(it.id)} disabled={s === 'loading'} style={{ ...btnStyle, opacity: s === 'loading' ? 0.6 : 1 }}>{s === 'loading' ? 'importo…' : '+ salva nel mio grafo'}</button>
        ) : (
          <a href="/login" style={{ ...btnStyle, textDecoration: 'none' }}>accedi per importare</a>
        )}
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

export function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110, background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, color: '#e8e8f0' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}
