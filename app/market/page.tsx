'use client';
// Marketplace "GitHub della ricerca finanziaria": home a sezioni (Trending,
// Per te, Confermate, Miglior track record, Nuove) con row orizzontali di
// card compatte, + vista lista (ricerca, filtro settore, sort, paginazione).
// L'import si fa dalla pagina dettaglio /market/t/[id].
import { useEffect, useState } from 'react';
import { SECTORS } from '@/lib/sectors';
import { type Item, stFor, btnStyle, useAuthed, MarketTopbar, ThesisCard, StatBox, useMarketLang } from './ui';

const P = {
  it: {
    title: 'Tesi della community',
    desc: "Le tesi qui non si scaricano e basta: si importano, si forkano, evolvono — e ogni autore ha un track record misurato sui dati reali, non sui like.",
    stTheses: 'tesi pubbliche', stAuthors: 'autori attivi', stConfirmed: 'confermate', stAcc: 'accuratezza media', stAccOf: 'accuratezza',
    secTrending: '🔥 trending', secForYou: '🧠 per te', secConfirmed: '✓ confermate', secTrack: '📈 miglior track record', secNew: '🆕 nuove tesi',
    secAll: '◆ le tesi della community',
    forYouSub: 'tesi di altri sui ticker del tuo portafoglio e delle tue tesi',
    seeAll: 'vedi tutte →', backHome: '← sezioni',
    evPublished: 'pubblicata', evConfirmed: 'confermata ✓', evInvalidated: 'invalidata ✕', evImported: 'importata nel grafo di qualcuno',
    agoToday: 'oggi', agoYesterday: 'ieri', agoDays: (d: number) => `${d}g fa`,
    loading: 'caricamento…', error: 'Marketplace non disponibile al momento. Riprova tra poco.',
    searchPh: 'cerca tra le tesi caricate…', allSectors: 'tutti i settori',
    sortRep: 'reputazione', sortRecent: 'recenti', sortAcc: 'accuratezza', onlyConfirmed: 'solo confermate ✓',
    emptySector: (x: string) => `Nessuna tesi pubblica nel settore ${x}.`,
    empty: 'Ancora nessuna tesi pubblica. Pubblica le tue dal drawer di una tesi nel grafo.',
    more: 'carica altre', loadingMore: 'carico…',
  },
  en: {
    title: 'Community theses',
    desc: "Theses here aren't just downloaded: they get imported, forked, they evolve — and every author has a track record measured on real data, not likes.",
    stTheses: 'public theses', stAuthors: 'active authors', stConfirmed: 'confirmed', stAcc: 'average accuracy', stAccOf: 'accuracy',
    secTrending: '🔥 trending', secForYou: '🧠 for you', secConfirmed: '✓ confirmed', secTrack: '📈 best track record', secNew: '🆕 new theses',
    secAll: '◆ community theses',
    forYouSub: "others' theses on the tickers of your portfolio and your theses",
    seeAll: 'see all →', backHome: '← sections',
    evPublished: 'published', evConfirmed: 'confirmed ✓', evInvalidated: 'invalidated ✕', evImported: "imported into someone's graph",
    agoToday: 'today', agoYesterday: 'yesterday', agoDays: (d: number) => `${d}d ago`,
    loading: 'loading…', error: 'Marketplace unavailable right now. Try again shortly.',
    searchPh: 'search loaded theses…', allSectors: 'all sectors',
    sortRep: 'reputation', sortRecent: 'recent', sortAcc: 'accuracy', onlyConfirmed: 'confirmed only ✓',
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
type Activity = { type: 'published' | 'confirmed' | 'invalidated' | 'imported'; thesisId: string; thesis: string; author: string; authorName: string | null; date: string };
const PAGE = 20;
const ROW = 10; // item per sezione orizzontale
const MIN_FOR_SECTIONS = 5; // sotto: vetrina unica (le sezioni ripeterebbero le stesse card)

export default function MarketPage() {
  const isAuthed = useAuthed();
  const [mlang, , mt] = useMarketLang();
  const lp = P[mlang];
  const ST = stFor(mt);

  // Vista: home a sezioni ↔ lista completa (con sort/filtri).
  const [view, setView] = useState<'home' | 'list'>('home');

  // ── Dati home ──
  const [stats, setStats] = useState<Stats | null>(null);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [confirmedItems, setConfirmedItems] = useState<Item[]>([]);
  const [trackItems, setTrackItems] = useState<Item[]>([]);
  const [newItems, setNewItems] = useState<Item[]>([]);
  const [forMeItems, setForMeItems] = useState<Item[]>([]);
  const [homeState, setHomeState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');
  const [totalPublic, setTotalPublic] = useState(0);
  const [activity, setActivity] = useState<Activity[]>([]);

  // ── Dati lista ──
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('rep');
  const [sector, setSector] = useState<string>('');
  const [confirmedOnly, setConfirmedOnly] = useState(false);

  const fetchItems = async (params: Record<string, string>): Promise<{ items: Item[]; hasMore: boolean; total: number } | null> => {
    try {
      const r = await fetch(`/api/market?${new URLSearchParams(params)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) return null;
      return { items: j.items || [], hasMore: !!j.hasMore, total: j.total || 0 };
    } catch { return null; }
  };

  // Home: sezioni in parallelo. Le tre liste condividono la CDN cache per URL.
  useEffect(() => {
    (async () => {
      const [conf, track, recent] = await Promise.all([
        fetchItems({ status: 'confirmed', sort: 'accuracy', limit: String(ROW) }),
        fetchItems({ sort: 'accuracy', limit: String(ROW) }),
        fetchItems({ sort: 'recent', limit: String(ROW) }),
      ]);
      if (!conf && !track && !recent) { setHomeState('error'); return; }
      setConfirmedItems(conf?.items || []);
      setTrackItems(track?.items || []);
      setNewItems(recent?.items || []);
      setTotalPublic(recent?.total || 0);
      setHomeState((recent?.items || []).length ? 'ok' : 'empty');
    })();
  }, []);

  // Strip attività: eventi pubblici recenti. Best-effort, nascosta se pochi.
  useEffect(() => {
    fetch('/api/market/activity').then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.events)) setActivity(j.events);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // no-store: bypassa la cache del browser (quella CDN ha già TTL corto)
    fetch('/api/market/stats', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && !j.error) { setStats(j.stats || null); setTrending(j.trending || []); }
    }).catch(() => {});
  }, []);

  // Per te: solo autenticati; sezione nascosta se vuota o in errore.
  useEffect(() => {
    if (!isAuthed) return;
    fetch('/api/market/for-me', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.items)) setForMeItems(j.items);
    }).catch(() => {});
  }, [isAuthed]);

  const listParams = (off: number) => {
    const p: Record<string, string> = { sort, offset: String(off), limit: String(PAGE) };
    if (sector) p.sector = sector;
    if (confirmedOnly) p.status = 'confirmed';
    return p;
  };

  // Lista: riparte da pagina 0 a ogni cambio sort/settore/filtro.
  useEffect(() => {
    if (view !== 'list') return;
    setState('loading'); setOffset(0);
    fetchItems(listParams(0)).then((res) => {
      if (!res) { setState('error'); return; }
      setItems(res.items);
      setHasMore(res.hasMore);
      setState(res.items.length ? 'ok' : 'empty');
    });
  }, [view, sector, sort, confirmedOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    const next = offset + PAGE;
    setLoadingMore(true);
    const res = await fetchItems(listParams(next));
    if (res) {
      // Dedup per id: la lista può slittare tra una pagina e l'altra (cache 20s).
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setHasMore(res.hasMore);
      setOffset(next);
    }
    setLoadingMore(false);
  };

  const openList = (s: Sort, confirmed = false) => {
    setSort(s); setConfirmedOnly(confirmed); setView('list');
    try { window.scrollTo({ top: 0 }); } catch {}
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
    const rows = sector && view === 'list'
      ? stats.avgAccuracyBySector.filter((s) => s.sector === sector)
      : stats.avgAccuracyBySector;
    const withAcc = rows.filter((s) => s.accuracy != null);
    if (!withAcc.length) return null;
    const tot = withAcc.reduce((a, s) => a + s.theses, 0);
    return Math.round(withAcc.reduce((a, s) => a + (s.accuracy as number) * s.theses, 0) / tot);
  })();

  // "oggi / ieri / Ng fa" per la strip attività.
  const agoShort = (iso: string) => {
    const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
    return d === 0 ? lp.agoToday : d === 1 ? lp.agoYesterday : lp.agoDays(d);
  };
  const EV_STYLE: Record<Activity['type'], { icon: string; c: string }> = {
    published: { icon: '◆', c: '#a78bfa' },
    confirmed: { icon: '✓', c: '#4ad68a' },
    invalidated: { icon: '✕', c: '#e05555' },
    imported: { icon: '↘', c: '#4ad68a' },
  };
  const evLabel = (t: Activity['type']) =>
    t === 'published' ? lp.evPublished : t === 'confirmed' ? lp.evConfirmed : t === 'invalidated' ? lp.evInvalidated : lp.evImported;

  // Sezioni senza fotocopie: una tesi appare solo nella PRIMA sezione che la
  // contiene (ordine di priorità: trending → per te → confermate → track → nuove).
  const sections = (() => {
    const seen = new Set<string>(trending.map((t) => t.id));
    const take = (arr: Item[]) => arr.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
    return { forMe: take(forMeItems), confirmed: take(confirmedItems), track: take(trackItems), recent: take(newItems) };
  })();

  const sectionHead = (title: string, sub: string | null, onSeeAll: (() => void) | null) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#9a9ab2', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
      {sub && <span style={{ fontSize: 10, color: '#5a5a78' }}>{sub}</span>}
      {onSeeAll && (
        <button onClick={onSeeAll}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#a78bfa', fontSize: 11, cursor: 'pointer', padding: 0 }}>
          {lp.seeAll}
        </button>
      )}
    </div>
  );

  const row = (its: Item[]) => (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {its.map((it, i) => <ThesisCard key={it.id} it={it} compact fadeIndex={i} />)}
    </div>
  );

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
            <StatBox value={accStat != null ? `${accStat}%` : '—'} label={sector && view === 'list' ? `${lp.stAccOf} ${sector}` : lp.stAcc} />
          </div>
        )}

        {view === 'home' && (
          <>
            {homeState === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map((i) => <div key={i} className="mk-skel" style={{ height: 110 }} />)}
              </div>
            )}
            {homeState === 'error' && <div style={{ color: '#e05555', fontSize: 13 }}>{lp.error}</div>}
            {homeState === 'empty' && <div style={{ color: '#7a7a95', fontSize: 13 }}>{lp.empty}</div>}

            {homeState === 'ok' && (
              <>
                {/* Strip attività: il nastro che fa respirare la pagina. */}
                {activity.length >= 3 && (
                  <div className="mk-fade" style={{ overflow: 'hidden', borderTop: '1px solid #1f1f28', borderBottom: '1px solid #1f1f28', padding: '8px 0', marginBottom: 24 }}>
                    <div className="mk-tape">
                      {activity.concat(activity).map((e, i) => {
                        const s = EV_STYLE[e.type];
                        return (
                          <a key={i} href={`/market/t/${e.thesisId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: '#7a7a95', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            <span style={{ color: s.c }}>{s.icon}</span>
                            <span style={{ color: '#9a9ab2' }}>{e.authorName || `#${e.author}`}</span>
                            <span>{evLabel(e.type)}</span>
                            <span style={{ color: '#5a5a78', fontStyle: 'italic', fontFamily: "'Fraunces', serif" }}>
                              «{e.thesis.slice(0, 46)}{e.thesis.length > 46 ? '…' : ''}»
                            </span>
                            <span style={{ color: '#3a3a50' }}>{agoShort(e.date)}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {totalPublic < MIN_FOR_SECTIONS ? (
                  /* Cold start: con poche tesi le sezioni sarebbero fotocopie —
                     una vetrina sola con card piene. */
                  <div style={{ marginBottom: 26 }}>
                    {sectionHead(lp.secAll, null, null)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {newItems.map((it, i) => <ThesisCard key={it.id} it={it} fadeIndex={i} />)}
                    </div>
                  </div>
                ) : (
                  <>
                    {trending.length >= 4 ? (
                      /* Hero: prima trending grande + le successive impilate. */
                      <div style={{ marginBottom: 26 }}>
                        {sectionHead(lp.secTrending, null, null)}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {(() => {
                            const [first, ...rest] = trending;
                            const st0 = ST[first.status] || ST.active;
                            return (
                              <>
                                <a href={`/market/t/${first.id}`} className="mk-card mk-fade"
                                  style={{ flex: '1.5 1 340px', textDecoration: 'none', background: '#12101c', border: '1px solid #2f2545', borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#5a5a78', marginBottom: 10 }}>
                                    <span style={{ color: '#a78bfa' }}>◆ {first.confidence}%</span>
                                    <span style={{ color: st0.c }}>{st0.l}</span>
                                    {first.imports14d > 0 && <span style={{ color: '#4ad68a' }}>↘ {first.imports14d}</span>}
                                  </div>
                                  <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 19, fontWeight: 300, lineHeight: 1.5, color: '#d4bbff', marginBottom: 12 }}>"{first.thesis}"</div>
                                  <div style={{ marginTop: 'auto', fontSize: 10.5, color: '#7a7a95' }}>{first.authorName || `#${first.author}`} →</div>
                                </a>
                                <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {rest.slice(0, 3).map((t, i) => {
                                    const st = ST[t.status] || ST.active;
                                    return (
                                      <a key={t.id} href={`/market/t/${t.id}`} className="mk-card mk-fade"
                                        style={{ animationDelay: `${(i + 1) * 60}ms`, flex: 1, textDecoration: 'none', background: '#12101c', border: '1px solid #2f2545', borderRadius: 12, padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', gap: 8, fontSize: 9.5, color: '#5a5a78', marginBottom: 4 }}>
                                          <span style={{ color: '#a78bfa' }}>◆ {t.confidence}%</span>
                                          <span style={{ color: st.c }}>{st.l}</span>
                                          {t.imports14d > 0 && <span style={{ color: '#4ad68a' }}>↘ {t.imports14d}</span>}
                                        </div>
                                        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.4, color: '#d4bbff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{t.thesis}"</div>
                                      </a>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : trending.length > 0 && (
                      <div style={{ marginBottom: 26 }}>
                        {sectionHead(lp.secTrending, null, null)}
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                          {trending.map((t, i) => {
                            const st = ST[t.status] || ST.active;
                            return (
                              <div key={t.id} className="mk-card mk-fade" style={{ animationDelay: `${i * 60}ms`, minWidth: 220, maxWidth: 260, flexShrink: 0, background: '#12101c', border: '1px solid #2f2545', borderRadius: 12, padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 8, fontSize: 9.5, color: '#5a5a78', marginBottom: 6 }}>
                                  <span style={{ color: '#a78bfa' }}>◆ {t.confidence}%</span>
                                  <span style={{ color: st.c }}>{st.l}</span>
                                  {t.imports14d > 0 && <span style={{ color: '#4ad68a' }}>↘ {t.imports14d}</span>}
                                </div>
                                <a href={`/market/t/${t.id}`} style={{ textDecoration: 'none' }}>
                                  <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 13, lineHeight: 1.45, color: '#d4bbff', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{t.thesis}"</div>
                                </a>
                                <a href={`/market/a/${t.author}`} style={{ fontSize: 10, color: '#7a7a95', textDecoration: 'none' }}>
                                  {t.authorName || `#${t.author}`} →
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {sections.forMe.length > 0 && (
                      <div style={{ marginBottom: 26 }}>
                        {sectionHead(lp.secForYou, lp.forYouSub, null)}
                        {row(sections.forMe)}
                      </div>
                    )}

                    {sections.confirmed.length > 0 && (
                      <div style={{ marginBottom: 26 }}>
                        {sectionHead(lp.secConfirmed, null, () => openList('accuracy', true))}
                        {row(sections.confirmed)}
                      </div>
                    )}

                    {sections.track.length > 0 && (
                      <div style={{ marginBottom: 26 }}>
                        {sectionHead(lp.secTrack, null, () => openList('accuracy'))}
                        {row(sections.track)}
                      </div>
                    )}

                    {sections.recent.length > 0 && (
                      <div style={{ marginBottom: 26 }}>
                        {sectionHead(lp.secNew, null, () => openList('recent'))}
                        {row(sections.recent)}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {view === 'list' && (
          <>
            <button onClick={() => { setView('home'); setConfirmedOnly(false); setSector(''); setQ(''); }}
              style={{ background: 'none', border: 'none', color: '#7a7a95', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
              {lp.backHome}
            </button>

            {state === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map((i) => <div key={i} className="mk-skel" style={{ height: 110 }} />)}
              </div>
            )}
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
                <button onClick={() => setConfirmedOnly(!confirmedOnly)}
                  style={{ background: confirmedOnly ? '#12241a' : '#0e0e12', border: `1px solid ${confirmedOnly ? '#1f4a33' : '#2a2a36'}`, borderRadius: 9, padding: '8px 12px', color: confirmedOnly ? '#4ad68a' : '#7a7a95', fontSize: 11.5, cursor: 'pointer' }}>
                  {lp.onlyConfirmed}
                </button>
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
              {shown.map((it, i) => <ThesisCard key={it.id} it={it} fadeIndex={i} />)}
            </div>

            {state === 'ok' && hasMore && !q.trim() && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button onClick={loadMore} disabled={loadingMore}
                  style={{ ...btnStyle, background: '#241a3a', color: '#a78bfa', opacity: loadingMore ? 0.6 : 1 }}>
                  {loadingMore ? lp.loadingMore : lp.more}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
