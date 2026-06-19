'use client';
// Marketplace: vetrina delle tesi pubbliche di tutti, ordinate per reputazione
// dell'autore (anonima). Da loggato si importano nel proprio grafo.
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type Rep = { theses: number; confirmed: number; invalidated: number; accuracy: number | null };
type Item = {
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; created_at: string;
  signals: { confirm: string[]; invalidate: string[] } | null;
  author: string; authorRep: Rep;
};

const ST: Record<string, { l: string; c: string }> = {
  confirmed: { l: 'confermata ✓', c: '#4ad68a' },
  invalidated: { l: 'invalidata ✕', c: '#e05555' },
  active: { l: 'in corso', c: '#7a7a95' },
};

export default function MarketPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'empty'>('loading');
  const [isAuthed, setIsAuthed] = useState(false);
  const [imp, setImp] = useState<Record<string, 'idle' | 'loading' | 'done' | 'duplicate' | 'error'>>({});

  useEffect(() => {
    fetch('/api/market').then((r) => r.json()).then((j) => {
      setItems(j.items || []);
      setState((j.items || []).length ? 'ok' : 'empty');
    }).catch(() => setState('empty'));
    createClient().auth.getUser().then(({ data }) => setIsAuthed(!!data.user)).catch(() => {});
  }, []);

  const importThesis = async (id: string) => {
    setImp((m) => ({ ...m, [id]: 'loading' }));
    try {
      const r = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thesisId: id }),
      });
      const j = await r.json();
      setImp((m) => ({ ...m, [id]: j.imported ? 'done' : j.duplicate ? 'duplicate' : 'error' }));
    } catch { setImp((m) => ({ ...m, [id]: 'error' })); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1f1f28' }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 300 }}>Symnaps</span>
        <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#241a3a', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em' }}>marketplace</span>
        <a href="/synapse" style={{ marginLeft: 'auto', color: '#5b9cf6', fontSize: 12, textDecoration: 'none' }}>il tuo grafo →</a>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 60px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, marginBottom: 6 }}>Tesi della community</div>
        <div style={{ fontSize: 12.5, color: '#7a7a95', marginBottom: 24, lineHeight: 1.6 }}>
          Tesi pubblicate da altri, ordinate per track record dell'autore. Importane una: entra nel tuo grafo con accuratezza azzerata e i suoi segnali ri-valutati sui dati di oggi.
        </div>

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12 }}>caricamento…</div>}
        {state === 'empty' && <div style={{ color: '#7a7a95', fontSize: 13 }}>Ancora nessuna tesi pubblica. Pubblica le tue dal drawer di una tesi nel grafo.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((it) => {
            const st = ST[it.status] || ST.active;
            const s = imp[it.id] || 'idle';
            const rep = it.authorRep;
            return (
              <div key={it.id} style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 10, color: '#5a5a78' }}>
                  <span style={{ color: '#a78bfa' }}>◆ confidenza {it.confidence}%</span>
                  <span style={{ color: st.c }}>{st.l}</span>
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
                    autore <span style={{ color: '#9a9ab2', fontFamily: 'monospace' }}>#{it.author}</span> · {rep.confirmed}/{rep.theses} confermate{rep.accuracy != null ? ` · ${rep.accuracy}% accuratezza` : ''}
                  </div>
                  {isAuthed ? (
                    s === 'done' ? <span style={{ fontSize: 11.5, color: '#4ad68a' }}>✓ importata</span>
                    : s === 'duplicate' ? <span style={{ fontSize: 11.5, color: '#f0a030' }}>hai già una tesi simile</span>
                    : s === 'error' ? <button onClick={() => importThesis(it.id)} style={btnStyle}>riprova</button>
                    : <button onClick={() => importThesis(it.id)} disabled={s === 'loading'} style={{ ...btnStyle, opacity: s === 'loading' ? 0.6 : 1 }}>{s === 'loading' ? 'importo…' : '+ salva nel mio grafo'}</button>
                  ) : (
                    <a href="/login" style={{ ...btnStyle, textDecoration: 'none' }}>accedi per importare</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  flexShrink: 0, background: '#a78bfa', color: '#08080a', border: 'none',
  borderRadius: 9, padding: '7px 13px', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
};
