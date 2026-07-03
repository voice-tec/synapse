'use client';
// Marketplace: dashboard con stats aggregate, tesi in evidenza e vetrina
// paginata (sort server-side). Da loggato si importano nel proprio grafo.
import { useEffect, useState } from 'react';
import { SECTORS } from '@/lib/sectors';
import { type Item, type ImpState, stFor, btnStyle, useAuthed, MarketTopbar, ThesisCard, StatBox, useMarketLang } from './ui';

const P = {
  it: {
    title: 'Tesi della community',
    desc: "Tesi pubblicate da altri, ordinate per track record dell'autore. Importane una: entra nel tuo grafo con accuratezza azzerata e i suoi segnali ri-valutati sui dati di oggi.",
    stTheses: 'tesi pubbliche', stAuthors: 'autori attivi', stConfirmed: 'confermate', stAcc: 'accuratezza media', stAccOf: 'accuratezza',
    featured: '◆ in evidenza', loading: 'caricamento…', error: 'Marketplace non disponibile al momento. Riprova tra poco.',
    searchPh: 'cerca tra le tesi caricate…', allSectors: 'tutti i settori',
    sortRep: 'reputazione', sortRecent: 'recenti', sortAcc: 'accuratezza',
    emptySector: (x: string) => `Nessuna tesi pubblica nel settore ${x}.`,
    empty: 'Ancora nessuna tesi pubblica. Pubblica le tue dal drawer di una tesi nel grafo.',
    more: 'carica altre', loadingMore: 'carico…',
  },
  en: {
    title: 'Community theses',
    desc: "Theses published by others, ranked by the author's track record. Import one: it enters your graph with accuracy reset and its signals re-evaluated on today's data.",
    stTheses: 'public theses', stAuthors: 'active authors', stConfirmed: 'confirmed', stAcc: 'average accuracy', stAccOf: 'accuracy',
    featured: '◆ featured', loading: 'loading…', error: 'Marketplace unavailable right now. Try again shortly.',
    searchPh: 'search loaded theses…', allSectors: 'all sectors',
    sortRep: 'reputation', sortRecent: 'recent', sortAcc: 'accuracy',
    emptySector: (x: string) => `No public theses in the ${x} sector.`,
    empty: 'No public theses yet. Publish yours from a thesis drawer in the graph.',
    more: 'load more', loadingMore: 'loading…',
  },
};

type Stats = {
  publicTheses: number; activeAuthors: number; confirmed: number;
  avgAccuracyBySector: { sector: string; theses: number; accuracy: number | null }[];
};
type Trend = {
  id: string; thesis: string; confidence: number; status: string; sector: string;
  imports14d: number; author: string; authorName: string | null;
};
type Sort = 'rep' | 'recent' | 'accuracy';
const PAGE = 20;

export default function MarketPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [trending, setTrending] = useState<Trend[]>([]);
  const isAuthed = useAuthed();
  const [imp, setImp] = useState<Record<string, ImpState>>({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('rep');
  const [sector, setSector] = useState<string>('');
  const [mlang, , mt] = useMarketLang();
  const lp = P[mlang];
  const ST = stFor(mt);

  const listUrl = (off: number) => {
    const p = new URLSearchParams({ sort, offset: String(off), limit: String(PAGE) });
    if (sector) p.set('sector', sector);
    return `/api/market?${p}`;
  };

  // Cambio sort/settore → riparte da pagina 0 (offset reset).
  useEffect(() => {
    setState('loading'); setOffset(0);
    fetch(listUrl(0)).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { setState('error'); return; }
      setItems(j.items || []);
      setHasMore(!!j.hasMore);
      setState((j.items || []).length ? 'ok' : 'empty');
    }).catch(() => setState('error'));
  }, [sector, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    const next = offset + PAGE;
    setLoadingMore(true);
    try {
      const r = await fetch(listUrl(next));
      const j = await r.json().catch(() => ({}));
      if (r.ok && !j.error) {
        // Dedup per id: la lista può slittare tra una pagina e l'altra (cache 20s).
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...(j.items || []).filter((i: Item) => !seen.has(i.id))];
        });
        setHasMore(!!j.hasMore);
        setOffset(next);
      }
    } catch {}
    setLoadingMore(false);
  };

  useEffect(() => {
    // no-store: bypassa la cache del browser (quella CDN ha già TTL corto)
    fetch('/api/market/stats', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && !j.error) { setStats(j.stats || null); setTrending(j.trending || []); }
    }).catch(() => {});
  }, []);

  // Tesi già importate dal chiamante → badge "già nel tuo grafo" sulle card.
  useEffect(() => {
    if (!isAuthed) return;
    fetch('/api/market/imported', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.ids)) {
        setImp((m) => {
          const next = { ...m };
          for (const id of j.ids) if (!next[id] || next[id] === 'idle') next[id] = 'already';
          return next;
        });
      }
    }).catch(() => {});
  }, [isAuthed]);

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

  // Ricerca testuale client-side: filtra solo le pagine già caricate.
  const shown = items.filter((it) => {
    if (!q.trim()) return true;
    const hay = [it.thesis, it.explanation, ...(it.signals?.confirm || []), ...(it.signals?.invalidate || [])]
      .filter(Boolean).join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  });

  // Accuratezza media: del settore selezionato, o globale (media pesata).
  const accStat = (() => {
    if (!stats) return null;
    const rows = sector
      ? stats.avgAccuracyBySector.filter((s) => s.sector === sector)
      : stats.avgAccuracyBySector;
    const withAcc = rows.filter((s) => s.accuracy != null);
    if (!withAcc.length) return null;
    const tot = withAcc.reduce((a, s) => a + s.theses, 0);
    return Math.round(withAcc.reduce((a, s) => a + (s.accuracy as number) * s.theses, 0) / tot);
  })();

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <MarketTopbar isAuthed={isAuthed} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 60px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, marginBottom: 6 }}>{lp.title}</div>
        <div style={{ fontSize: 12.5, color: '#7a7a95', marginBottom: 20, lineHeight: 1.6 }}>
          {lp.desc}
        </div>

        {stats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatBox value={stats.publicTheses} label={lp.stTheses} />
            <StatBox value={stats.activeAuthors} label={lp.stAuthors} />
            <StatBox value={stats.confirmed} label={lp.stConfirmed} />
            <StatBox value={accStat != null ? `${accStat}%` : '—'} label={sector ? `${lp.stAccOf} ${sector}` : lp.stAcc} />
          </div>
        )}

        {trending.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{lp.featured}</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {trending.map((t) => {
                const st = ST[t.status] || ST.active;
                return (
                  <div key={t.id} style={{ minWidth: 220, maxWidth: 260, flexShrink: 0, background: '#12101c', border: '1px solid #2f2545', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 9.5, color: '#5a5a78', marginBottom: 6 }}>
                      <span style={{ color: '#a78bfa' }}>◆ {t.confidence}%</span>
                      <span style={{ color: st.c }}>{st.l}</span>
                      {t.imports14d > 0 && <span style={{ color: '#4ad68a' }}>↘ {t.imports14d}</span>}
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 13, lineHeight: 1.45, color: '#d4bbff', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{t.thesis}"</div>
                    <a href={`/market/a/${t.author}`} style={{ fontSize: 10, color: '#7a7a95', textDecoration: 'none' }}>
                      {t.authorName || `#${t.author}`} →
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12 }}>{lp.loading}</div>}
        {state === 'error' && <div style={{ color: '#e05555', fontSize: 13 }}>{lp.error}</div>}

        {(state === 'ok' || state === 'empty') && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lp.searchPh}
              style={{ flex: 1, minWidth: 200, background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 9, padding: '8px 12px', color: '#e8e8f0', fontSize: 12.5 }} />
            <select value={sector} onChange={(e) => setSector(e.target.value)}
              style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 9, padding: '8px 12px', color: sector ? '#a78bfa' : '#7a7a95', fontSize: 12 }}>
              <option value="">{lp.allSectors}</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4, background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 9, padding: 3 }}>
              {(['rep', 'recent', 'accuracy'] as const).map((s) => (
                <button key={s} onClick={() => setSort(s)}
                  style={{ background: sort === s ? '#241a3a' : 'transparent', color: sort === s ? '#a78bfa' : '#7a7a95', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11.5, cursor: 'pointer' }}>
                  {s === 'rep' ? lp.sortRep : s === 'recent' ? lp.sortRecent : lp.sortAcc}
                </button>
              ))}
            </div>
          </div>
        )}

        {state === 'empty' && <div style={{ color: '#7a7a95', fontSize: 13 }}>{sector ? lp.emptySector(sector) : lp.empty}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map((it) => (
            <ThesisCard key={it.id} it={it} impState={imp[it.id] || 'idle'} onImport={importThesis} isAuthed={isAuthed} />
          ))}
        </div>

        {state === 'ok' && hasMore && !q.trim() && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={loadMore} disabled={loadingMore}
              style={{ ...btnStyle, background: '#241a3a', color: '#a78bfa', opacity: loadingMore ? 0.6 : 1 }}>
              {loadingMore ? lp.loadingMore : lp.more}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
