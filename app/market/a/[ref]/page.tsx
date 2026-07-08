'use client';
// Profilo pubblico di un autore del marketplace (indirizzato per hash opaco):
// track record completo, accuratezza per tesi e per settore, tesi importabili.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { type Item, type Rep, useAuthed, MarketTopbar, ThesisCard, AccuracyBar, StatBox, useMarketLang } from '../../ui';

const P = {
  it: {
    back: '← marketplace', loading: 'caricamento…',
    notfound: 'Autore non trovato (o senza tesi pubbliche).', error: 'Profilo non disponibile al momento. Riprova tra poco.',
    since: 'pubblica da', dateLocale: 'it-IT',
    stTheses: 'tesi pubbliche', stConfirmed: 'confermate (su tutte)', stAcc: 'accuratezza media', stImports: 'evoluzioni ricevute',
    bySector: 'per settore', publicTheses: 'tesi pubbliche',
  },
  en: {
    back: '← marketplace', loading: 'loading…',
    notfound: 'Author not found (or has no public theses).', error: 'Profile unavailable right now. Try again shortly.',
    since: 'publishing since', dateLocale: 'en-US',
    stTheses: 'public theses', stConfirmed: 'confirmed (overall)', stAcc: 'average accuracy', stImports: 'evolutions received',
    bySector: 'by sector', publicTheses: 'public theses',
  },
};

type AuthorData = {
  author: string; name: string | null; rep: Rep;
  memberSince: string | null; importsReceived: number;
  bySector: { sector: string; theses: number; accuracy: number | null }[];
  theses: (Omit<Item, 'author' | 'authorName' | 'authorRep'>)[];
};

export default function AuthorPage() {
  const { ref } = useParams<{ ref: string }>();
  const [data, setData] = useState<AuthorData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const isAuthed = useAuthed();
  const [mlang] = useMarketLang();
  const lp = P[mlang];

  useEffect(() => {
    if (!ref) return;
    fetch(`/api/market/author/${encodeURIComponent(ref)}`).then(async (r) => {
      if (r.status === 404 || r.status === 400) { setState('notfound'); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { setState('error'); return; }
      setData(j); setState('ok');
    }).catch(() => setState('error'));
  }, [ref]);

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <MarketTopbar isAuthed={isAuthed} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 60px' }}>
        <a href="/market" style={{ fontSize: 11, color: '#7a7a95', textDecoration: 'none' }}>{lp.back}</a>

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12, marginTop: 20 }}>{lp.loading}</div>}
        {state === 'notfound' && <div style={{ color: '#7a7a95', fontSize: 13, marginTop: 20 }}>{lp.notfound}</div>}
        {state === 'error' && <div style={{ color: '#e05555', fontSize: 13, marginTop: 20 }}>{lp.error}</div>}

        {state === 'ok' && data && (
          <>
            <div style={{ marginTop: 16, marginBottom: 6, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300 }}>
              {data.name || <span style={{ fontFamily: 'monospace' }}>#{data.author}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: '#7a7a95', marginBottom: 20 }}>
              {data.name && <span style={{ fontFamily: 'monospace' }}>#{data.author} · </span>}
              {data.memberSince && <>{lp.since} {new Date(data.memberSince).toLocaleDateString(lp.dateLocale, { month: 'long', year: 'numeric' })}</>}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatBox value={data.theses.length} label={lp.stTheses} />
              <StatBox value={`${data.rep.confirmed}/${data.rep.theses}`} label={lp.stConfirmed} />
              <StatBox value={data.rep.accuracy != null ? `${data.rep.accuracy}%` : '—'} label={lp.stAcc} />
              <StatBox value={data.importsReceived} label={lp.stImports} />
            </div>

            {data.bySector.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{lp.bySector}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.bySector.map((s) => (
                    <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
                      <span style={{ minWidth: 150, color: '#9a9ab2' }}>{s.sector} <span style={{ color: '#5a5a78' }}>({s.theses})</span></span>
                      <div style={{ flex: 1 }}>
                        <AccuracyBar accuracy={s.accuracy} status="active" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{lp.publicTheses}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.theses.map((t) => (
                <div key={t.id}>
                  <ThesisCard it={{ ...t, author: data.author, authorName: data.name, authorRep: data.rep }} />
                  <div style={{ padding: '6px 18px 0' }}>
                    <AccuracyBar accuracy={t.accuracy} status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
