'use client';
// "Le mie pubblicazioni": performance delle proprie tesi pubbliche nel
// marketplace — stato, accuratezza, import ricevuti da altri utenti.
import { useEffect, useState } from 'react';
import { stFor, MarketTopbar, AccuracyBar, StatBox, ImportsBadge, btnStyle, useMarketLang } from '../ui';

const P = {
  it: {
    back: '← marketplace', title: 'Le mie pubblicazioni',
    desc: 'Come stanno andando le tue tesi nel marketplace. Gli import contano quante volte altri utenti le hanno salvate nel proprio grafo.',
    loading: 'caricamento…', error: 'Dati non disponibili al momento. Riprova tra poco.',
    emptyPre: 'Non hai ancora pubblicato tesi. Apri una tesi nel ', emptyLink: 'tuo grafo', emptyPost: ' e pubblicala dal drawer (serve confidenza ≥ 60).',
    stPub: 'pubblicate', stImports: 'import ricevuti', stConfirmed: 'confermate', stAcc: 'accuratezza media',
    conf: 'confidenza', publishedOn: 'pubblicata il', manage: 'gestisci nel grafo', dateLocale: 'it-IT',
    legacy: (n: number) => `${n} import ${n === 1 ? 'arriva' : 'arrivano'} da condivisioni precedenti e non ${n === 1 ? 'è attribuito' : 'sono attribuiti'} a una tesi specifica.`,
  },
  en: {
    back: '← marketplace', title: 'My publications',
    desc: 'How your theses are doing on the marketplace. Imports count how many times other users saved them to their own graph.',
    loading: 'loading…', error: 'Data unavailable right now. Try again shortly.',
    emptyPre: 'You have not published any thesis yet. Open a thesis in ', emptyLink: 'your graph', emptyPost: ' and publish it from the drawer (needs ≥ 60 confidence).',
    stPub: 'published', stImports: 'imports received', stConfirmed: 'confirmed', stAcc: 'average accuracy',
    conf: 'confidence', publishedOn: 'published on', manage: 'manage in the graph', dateLocale: 'en-US',
    legacy: (n: number) => `${n} import${n === 1 ? ' comes' : 's come'} from earlier shares and ${n === 1 ? 'is' : 'are'} not attributed to a specific thesis.`,
  },
};

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
  const [mlang, , mt] = useMarketLang();
  const lp = P[mlang];
  const ST = stFor(mt);

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
        <a href="/market" style={{ fontSize: 11, color: '#7a7a95', textDecoration: 'none' }}>{lp.back}</a>
        <div style={{ marginTop: 16, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, marginBottom: 6 }}>{lp.title}</div>
        <div style={{ fontSize: 12.5, color: '#7a7a95', marginBottom: 20, lineHeight: 1.6 }}>
          {lp.desc}
        </div>

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12 }}>{lp.loading}</div>}
        {state === 'error' && <div style={{ color: '#e05555', fontSize: 13 }}>{lp.error}</div>}
        {state === 'empty' && (
          <div style={{ color: '#7a7a95', fontSize: 13 }}>
            {lp.emptyPre}<a href="/" style={{ color: '#5b9cf6' }}>{lp.emptyLink}</a>{lp.emptyPost}
          </div>
        )}

        {state === 'ok' && totals && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatBox value={`${totals.published}/${totals.maxPublic}`} label={lp.stPub} />
              <StatBox value={totals.imports + totals.importsLegacy} label={lp.stImports} />
              <StatBox value={totals.confirmed} label={lp.stConfirmed} />
              <StatBox value={totals.avgAccuracy != null ? `${totals.avgAccuracy}%` : '—'} label={lp.stAcc} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((t) => {
                const st = ST[t.status] || ST.active;
                return (
                  <div key={t.id} style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 10, color: '#5a5a78', flexWrap: 'wrap' }}>
                      <span style={{ color: '#a78bfa' }}>◆ {lp.conf} {t.confidence}%</span>
                      <span style={{ color: st.c }}>{st.l}</span>
                      <ImportsBadge n={t.imports} />
                      {t.sector && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#16161e', color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t.sector}</span>}
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 16, fontWeight: 300, lineHeight: 1.5, color: '#d4bbff', marginBottom: 10 }}>"{t.thesis}"</div>
                    <AccuracyBar accuracy={t.accuracy} status={t.status} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: '1px solid #1f1f28', paddingTop: 10 }}>
                      <span style={{ fontSize: 10, color: '#5a5a78' }}>
                        {lp.publishedOn} {new Date(t.created_at).toLocaleDateString(lp.dateLocale)}
                      </span>
                      <a href="/" style={{ ...btnStyle, background: '#241a3a', color: '#a78bfa', textDecoration: 'none' }}>{lp.manage}</a>
                    </div>
                  </div>
                );
              })}
            </div>

            {totals.importsLegacy > 0 && (
              <div style={{ marginTop: 16, fontSize: 10.5, color: '#5a5a78' }}>
                {lp.legacy(totals.importsLegacy)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
