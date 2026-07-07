'use client';
// Dettaglio pubblico di una tesi del marketplace ("GitHub delle tesi"):
// hero, segnali con stato, Evoluzione (timeline delle versioni) e Knowledge
// Tree (albero dei fork con track record per nodo). CTA: importa, forka,
// condividi. L'import/fork usa l'endpoint /api/import esistente.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { type Rep, type ImpState, useAuthed, MarketTopbar, AccuracyBar, RepLine, btnStyle, stFor, useMarketLang, updatedAgo } from '../../ui';

const P = {
  it: {
    back: '← marketplace', loading: 'caricamento…',
    notfound: 'Tesi non trovata (o non pubblica).', error: 'Tesi non disponibile al momento. Riprova tra poco.',
    published: 'pubblicata il', online: (d: number) => `online da ${d} ${d === 1 ? 'giorno' : 'giorni'}`, dateLocale: 'it-IT',
    accuracy: 'accuratezza',
    signalsTitle: 'segnali', confirmCol: 'conferma se', invalidateCol: 'invalida se',
    fired: '● scattato', waiting: '○ in attesa', noData: 'dato mancante', manualNote: 'nota qualitativa',
    evoTitle: 'evoluzione', evoSub: "la storia della tesi come l'ha aggiornata l'autore", evoNow: 'versione attuale',
    treeTitle: 'knowledge tree', treeSub: 'origine e fork: ogni nodo ha il suo track record, misurato sui dati',
    treeYouAreHere: 'questa tesi', privImports: (n: number) => `+${n} import privat${n === 1 ? 'o' : 'i'}`,
    forkBtn: '⑂ forka', forkHint: 'Importata nel grafo: modificala e ripubblicala come fork', share: '↗ condividi', copied: '🔗 link copiato',
    forksWord: 'fork', importsWord: 'import',
  },
  en: {
    back: '← marketplace', loading: 'loading…',
    notfound: 'Thesis not found (or not public).', error: 'Thesis unavailable right now. Try again shortly.',
    published: 'published on', online: (d: number) => `online for ${d} day${d === 1 ? '' : 's'}`, dateLocale: 'en-US',
    accuracy: 'accuracy',
    signalsTitle: 'signals', confirmCol: 'confirms if', invalidateCol: 'invalidates if',
    fired: '● fired', waiting: '○ waiting', noData: 'data missing', manualNote: 'qualitative note',
    evoTitle: 'evolution', evoSub: 'the story of the thesis as the author updated it', evoNow: 'current version',
    treeTitle: 'knowledge tree', treeSub: 'origin and forks: every node has its own track record, measured on data',
    treeYouAreHere: 'this thesis', privImports: (n: number) => `+${n} private import${n === 1 ? '' : 's'}`,
    forkBtn: '⑂ fork', forkHint: 'Imported into your graph: edit it and republish it as a fork', share: '↗ share', copied: '🔗 link copied',
    forksWord: 'forks', importsWord: 'imports',
  },
};

type SigView = { text: string; kind: string; fired: boolean; data_missing: boolean; checked_at: string | null };
type HistEntry = { thesis?: string; confidence?: number; date?: string; note?: string };
type TreeNode = {
  id: string; thesis: string; author: string; authorName: string | null;
  confidence: number | null; accuracy: number | null; status: string;
  privateImports: number; children: TreeNode[];
};
type Detail = {
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; accuracy: number | null; sector: string; created_at: string; updated_at: string;
  daysOnline: number;
  signals: { confirm: SigView[]; invalidate: SigView[] } | null;
  history: HistEntry[];
  author: { ref: string; name: string | null; rep: Rep };
  imports: number; forks: number;
  tree: TreeNode | null;
};

// Riga segnale con stato esplicito (come nel drawer del grafo).
function SigRow({ s, color, lp }: { s: SigView; color: string; lp: typeof P.it }) {
  const label = s.kind === 'manual' ? lp.manualNote : s.data_missing ? lp.noData : s.fired ? lp.fired : lp.waiting;
  const stColor = s.kind === 'manual' || s.data_missing ? '#5a5a78' : s.fired ? color : '#7a7a95';
  return (
    <div style={{ marginBottom: 7, lineHeight: 1.55 }}>
      <span style={{ color: `${color}bb` }}>{s.text}</span>
      <span style={{ marginLeft: 8, fontSize: 9, color: stColor, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

// Nodo dell'albero dei fork, ricorsivo (indentazione a sinistra).
function TreeNodeView({ n, currentId, lp, stl, depth }: {
  n: TreeNode; currentId: string; lp: typeof P.it;
  stl: Record<string, { l: string; c: string }>; depth: number;
}) {
  const me = n.id === currentId;
  const st = stl[n.status] || stl.active;
  return (
    <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? '1px solid #2a2a36' : 'none', paddingLeft: depth ? 12 : 0, marginTop: depth ? 8 : 0 }}>
      <a href={me ? undefined : `/market/t/${n.id}`}
        style={{
          display: 'block', textDecoration: 'none', background: me ? '#12101c' : '#0e0e12',
          border: `1px solid ${me ? '#a78bfa66' : '#2a2a36'}`, borderRadius: 10, padding: '9px 12px',
        }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9.5, color: '#5a5a78', marginBottom: 4, flexWrap: 'wrap' }}>
          {me && <span style={{ color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.05em' }}>◉ {lp.treeYouAreHere}</span>}
          <span style={{ color: '#a78bfa' }}>◆ {n.confidence ?? '—'}%</span>
          <span style={{ color: st.c }}>{st.l}</span>
          {n.accuracy != null && <span style={{ color: '#5b9cf6' }}>{Math.round(n.accuracy)}% acc</span>}
          <span style={{ marginLeft: 'auto', color: '#7a7a95' }}>{n.authorName || `#${n.author}`}</span>
        </div>
        <div style={{ fontSize: 11.5, color: me ? '#d4bbff' : '#9a9ab2', lineHeight: 1.45, fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>
          "{n.thesis}"
        </div>
      </a>
      {n.privateImports > 0 && (
        <div style={{ marginLeft: 18, borderLeft: '1px solid #2a2a36', paddingLeft: 12, marginTop: 6, fontSize: 10, color: '#5a5a78' }}>
          {lp.privImports(n.privateImports)}
        </div>
      )}
      {n.children.map((c) => (
        <TreeNodeView key={c.id} n={c} currentId={currentId} lp={lp} stl={stl} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function ThesisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const isAuthed = useAuthed();
  const [imp, setImp] = useState<ImpState>('idle');
  const [forkHint, setForkHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mlang, , mt] = useMarketLang();
  const lp = P[mlang];
  const STL = stFor(mt);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/market/thesis/${encodeURIComponent(id)}`).then(async (r) => {
      if (r.status === 404) { setState('notfound'); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { setState('error'); return; }
      setData(j); setState('ok');
    }).catch(() => setState('error'));
  }, [id]);

  // Badge "già nel tuo grafo": stessa fonte della vetrina.
  useEffect(() => {
    if (!isAuthed || !id) return;
    fetch('/api/market/imported', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.ids) && j.ids.includes(id)) setImp((s) => (s === 'idle' ? 'already' : s));
    }).catch(() => {});
  }, [isAuthed, id]);

  // Import e fork usano lo stesso endpoint: il fork è un import che l'utente
  // poi modifica e ripubblica dal grafo (il server rifiuta i fork identici).
  const importThesis = async (asFork: boolean) => {
    setImp('loading');
    try {
      const r = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thesisId: id }),
      });
      const j = await r.json();
      setImp(j.imported ? 'done' : j.duplicate ? 'duplicate' : 'error');
      if (j.imported && asFork) setForkHint(true);
      try { if (j.imported) (window as any).posthog?.capture(asFork ? 'thesis_forked' : 'thesis_imported'); } catch {}
    } catch { setImp('error'); }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const st = data ? (STL[data.status] || STL.active) : STL.active;
  const secLbl = (txt: string, sub?: string) => (
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em' }}>{txt}</span>
      {sub && <span style={{ fontSize: 10, color: '#5a5a78', marginLeft: 10 }}>{sub}</span>}
    </div>
  );

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
            {/* ── Hero ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 10, fontSize: 10, color: '#5a5a78', flexWrap: 'wrap' }}>
              <span style={{ color: '#a78bfa' }}>◆ {mt.conf} {data.confidence}%</span>
              <span style={{ color: st.c }}>{st.l}</span>
              {data.forks > 0 && <span style={{ color: '#f0a030' }} title={mt.forksTitle}>⑂ {data.forks} {lp.forksWord}</span>}
              {data.imports > 0 && <span style={{ color: '#4ad68a' }} title={mt.importsTitle}>↘ {data.imports} {lp.importsWord}</span>}
              {data.sector && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#16161e', color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em' }}>{data.sector}</span>}
            </div>

            <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 22, fontWeight: 300, lineHeight: 1.45, color: '#d4bbff', marginBottom: 12 }}>"{data.thesis}"</div>
            {data.explanation && <div style={{ fontSize: 12.5, color: '#9a9ab2', lineHeight: 1.7, marginBottom: 14 }}>{data.explanation}</div>}

            <div style={{ fontSize: 10.5, color: '#7a7a95', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <RepLine authorRef={data.author.ref} name={data.author.name} rep={data.author.rep} />
              <span>· {lp.published} {new Date(data.created_at).toLocaleDateString(lp.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span>· {lp.online(data.daysOnline)}</span>
              {updatedAgo(data.updated_at, mt) && <span>· {updatedAgo(data.updated_at, mt)}</span>}
            </div>

            {secLbl(lp.accuracy)}
            <div style={{ marginBottom: 22 }}><AccuracyBar accuracy={data.accuracy} status={data.status} /></div>

            {/* ── CTA ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #1f1f28', borderBottom: '1px solid #1f1f28', padding: '14px 0', marginBottom: 26, flexWrap: 'wrap' }}>
              {isAuthed ? (
                imp === 'done' ? (
                  <span style={{ fontSize: 12, color: '#4ad68a' }}>{forkHint ? `${mt.imported} — ${lp.forkHint}` : mt.imported}</span>
                ) : imp === 'already' ? (
                  <span style={{ fontSize: 12, color: '#4ad68a' }} title={mt.alreadyTitle}>{mt.already}</span>
                ) : imp === 'duplicate' ? (
                  <span style={{ fontSize: 12, color: '#f0a030' }}>{mt.similar}</span>
                ) : imp === 'error' ? (
                  <button onClick={() => importThesis(false)} style={btnStyle}>{mt.retry}</button>
                ) : (
                  <>
                    <button onClick={() => importThesis(false)} disabled={imp === 'loading'}
                      style={{ ...btnStyle, opacity: imp === 'loading' ? 0.6 : 1 }}>
                      {imp === 'loading' ? mt.importing : mt.save}
                    </button>
                    <button onClick={() => importThesis(true)} disabled={imp === 'loading'} title={lp.forkHint}
                      style={{ ...btnStyle, background: 'transparent', color: '#f0a030', border: '1px solid #f0a03055', opacity: imp === 'loading' ? 0.6 : 1 }}>
                      {lp.forkBtn}
                    </button>
                  </>
                )
              ) : (
                <a href="/login" style={{ ...btnStyle, textDecoration: 'none' }}>{mt.loginToImport}</a>
              )}
              <button onClick={share}
                style={{ ...btnStyle, background: 'transparent', color: '#5b9cf6', border: '1px solid #5b9cf655', marginLeft: 'auto' }}>
                {copied ? lp.copied : lp.share}
              </button>
            </div>

            {/* ── Segnali ── */}
            {data.signals && (data.signals.confirm.length > 0 || data.signals.invalidate.length > 0) && (
              <div style={{ marginBottom: 26 }}>
                {secLbl(lp.signalsTitle)}
                <div style={{ display: 'flex', gap: 16, fontSize: 11.5 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, color: '#4ad68a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>✓ {lp.confirmCol}</div>
                    {data.signals.confirm.map((s, i) => <SigRow key={i} s={s} color="#4ad68a" lp={lp} />)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, color: '#e05555', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>✗ {lp.invalidateCol}</div>
                    {data.signals.invalidate.map((s, i) => <SigRow key={i} s={s} color="#e05555" lp={lp} />)}
                  </div>
                </div>
              </div>
            )}

            {/* ── Evoluzione: versioni dalla history + versione attuale ── */}
            {data.history.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                {secLbl(lp.evoTitle, lp.evoSub)}
                <div style={{ borderLeft: '1px solid #2a2a36', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.history.map((h, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 9.5, color: '#5a5a78', marginBottom: 3 }}>
                        v{i + 1}{h.date ? ` · ${new Date(h.date).toLocaleDateString(lp.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}{h.confidence != null ? ` · ◆ ${h.confidence}%` : ''}
                      </div>
                      {h.thesis && <div style={{ fontSize: 11.5, color: '#9a9ab2', lineHeight: 1.5, fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>"{h.thesis}"</div>}
                      {h.note && <div style={{ fontSize: 10.5, color: '#7a7a95', marginTop: 2 }}>{h.note}</div>}
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 9.5, color: '#a78bfa', marginBottom: 3 }}>
                      {lp.evoNow} · ◆ {data.confidence}%
                    </div>
                    <div style={{ fontSize: 11.5, color: '#d4bbff', lineHeight: 1.5, fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>"{data.thesis}"</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Knowledge Tree: mostrato solo se c'è lineage (radice ≠ foglia unica) ── */}
            {data.tree && (data.tree.children.length > 0 || data.tree.id !== data.id || data.tree.privateImports > 0) && (
              <div style={{ marginBottom: 26 }}>
                {secLbl(lp.treeTitle, lp.treeSub)}
                <TreeNodeView n={data.tree} currentId={data.id} lp={lp} stl={STL} depth={0} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
