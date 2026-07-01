'use client';
// Profilo pubblico di un autore del marketplace (indirizzato per hash opaco):
// track record completo, accuratezza per tesi e per settore, tesi importabili.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { type Item, type ImpState, type Rep, useAuthed, MarketTopbar, ThesisCard, AccuracyBar, StatBox } from '../../ui';

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
  const [imp, setImp] = useState<Record<string, ImpState>>({});

  useEffect(() => {
    if (!ref) return;
    fetch(`/api/market/author/${encodeURIComponent(ref)}`).then(async (r) => {
      if (r.status === 404 || r.status === 400) { setState('notfound'); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { setState('error'); return; }
      setData(j); setState('ok');
    }).catch(() => setState('error'));
  }, [ref]);

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
      <MarketTopbar isAuthed={isAuthed} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 60px' }}>
        <a href="/market" style={{ fontSize: 11, color: '#7a7a95', textDecoration: 'none' }}>← marketplace</a>

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12, marginTop: 20 }}>caricamento…</div>}
        {state === 'notfound' && <div style={{ color: '#7a7a95', fontSize: 13, marginTop: 20 }}>Autore non trovato (o senza tesi pubbliche).</div>}
        {state === 'error' && <div style={{ color: '#e05555', fontSize: 13, marginTop: 20 }}>Profilo non disponibile al momento. Riprova tra poco.</div>}

        {state === 'ok' && data && (
          <>
            <div style={{ marginTop: 16, marginBottom: 6, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300 }}>
              {data.name || <span style={{ fontFamily: 'monospace' }}>#{data.author}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: '#7a7a95', marginBottom: 20 }}>
              {data.name && <span style={{ fontFamily: 'monospace' }}>#{data.author} · </span>}
              {data.memberSince && <>pubblica da {new Date(data.memberSince).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</>}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatBox value={data.theses.length} label="tesi pubbliche" />
              <StatBox value={`${data.rep.confirmed}/${data.rep.theses}`} label="confermate (su tutte)" />
              <StatBox value={data.rep.accuracy != null ? `${data.rep.accuracy}%` : '—'} label="accuratezza media" />
              <StatBox value={data.importsReceived} label="import ricevuti" />
            </div>

            {data.bySector.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>per settore</div>
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

            <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>tesi pubbliche</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.theses.map((t) => (
                <div key={t.id}>
                  <ThesisCard
                    it={{ ...t, author: data.author, authorName: data.name, authorRep: data.rep }}
                    impState={imp[t.id] || 'idle'} onImport={importThesis} isAuthed={isAuthed} />
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
