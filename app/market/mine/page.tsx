'use client';
// "Le mie pubblicazioni": performance delle proprie tesi pubbliche nel
// marketplace — stato, accuratezza, import ricevuti da altri utenti.
import { useEffect, useState } from 'react';
import { ST, MarketTopbar, AccuracyBar, StatBox, ImportsBadge, btnStyle } from '../ui';

type MineItem = {
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; accuracy: number | null; sector: string; created_at: string; imports: number;
};
type Totals = {
  published: number; maxPublic: number; imports: number; importsLegacy: number;
  confirmed: number; avgAccuracy: number | null;
};

export default function MinePage() {
  const [items, setItems] = useState<MineItem[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/market/mine').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login'; return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { setState('error'); return; }
      setItems(j.items || []);
      setTotals(j.totals || null);
      setState((j.items || []).length ? 'ok' : 'empty');
    }).catch(() => setState('error'));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <MarketTopbar isAuthed={true} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 60px' }}>
        <a href="/market" style={{ fontSize: 11, color: '#7a7a95', textDecoration: 'none' }}>← marketplace</a>
        <div style={{ marginTop: 16, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, marginBottom: 6 }}>Le mie pubblicazioni</div>
        <div style={{ fontSize: 12.5, color: '#7a7a95', marginBottom: 20, lineHeight: 1.6 }}>
          Come stanno andando le tue tesi nel marketplace. Gli import contano quante volte altri utenti le hanno salvate nel proprio grafo.
        </div>

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12 }}>caricamento…</div>}
        {state === 'error' && <div style={{ color: '#e05555', fontSize: 13 }}>Dati non disponibili al momento. Riprova tra poco.</div>}
        {state === 'empty' && (
          <div style={{ color: '#7a7a95', fontSize: 13 }}>
            Non hai ancora pubblicato tesi. Apri una tesi nel <a href="/" style={{ color: '#5b9cf6' }}>tuo grafo</a> e pubblicala dal drawer (serve confidenza ≥ 60).
          </div>
        )}

        {state === 'ok' && totals && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatBox value={`${totals.published}/${totals.maxPublic}`} label="pubblicate" />
              <StatBox value={totals.imports + totals.importsLegacy} label="import ricevuti" />
              <StatBox value={totals.confirmed} label="confermate" />
              <StatBox value={totals.avgAccuracy != null ? `${totals.avgAccuracy}%` : '—'} label="accuratezza media" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((t) => {
                const st = ST[t.status] || ST.active;
                return (
                  <div key={t.id} style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 10, color: '#5a5a78', flexWrap: 'wrap' }}>
                      <span style={{ color: '#a78bfa' }}>◆ confidenza {t.confidence}%</span>
                      <span style={{ color: st.c }}>{st.l}</span>
                      <ImportsBadge n={t.imports} />
                      {t.sector && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#16161e', color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t.sector}</span>}
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 16, fontWeight: 300, lineHeight: 1.5, color: '#d4bbff', marginBottom: 10 }}>"{t.thesis}"</div>
                    <AccuracyBar accuracy={t.accuracy} status={t.status} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: '1px solid #1f1f28', paddingTop: 10 }}>
                      <span style={{ fontSize: 10, color: '#5a5a78' }}>
                        pubblicata il {new Date(t.created_at).toLocaleDateString('it-IT')}
                      </span>
                      <a href="/" style={{ ...btnStyle, background: '#241a3a', color: '#a78bfa', textDecoration: 'none' }}>gestisci nel grafo</a>
                    </div>
                  </div>
                );
              })}
            </div>

            {totals.importsLegacy > 0 && (
              <div style={{ marginTop: 16, fontSize: 10.5, color: '#5a5a78' }}>
                {totals.importsLegacy} import {totals.importsLegacy === 1 ? 'arriva' : 'arrivano'} da condivisioni precedenti e non {totals.importsLegacy === 1 ? 'è attribuito' : 'sono attribuiti'} a una tesi specifica.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
