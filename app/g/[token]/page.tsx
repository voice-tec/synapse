'use client';
// Pagina pubblica read-only di un grafo condiviso.
// Renderer autonomo e leggero: force layout, pan/zoom, dettaglio su click.
// Niente auth, niente AI — solo la fotografia del grafo + CTA al signup.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const TC: Record<string, string> = { causal: '#5b9cf6', compare: '#2ecf98', risk: '#f0a030', trend: '#4ad68a', screen: '#4ad68a' };

type Detail = { kind: 'task' | 'thesis' | 'action'; data: any } | null;

export default function SharedGraphPage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [detail, setDetail] = useState<Detail>(null);
  const detailRef = useRef<Detail>(null);
  detailRef.current = detail;

  useEffect(() => {
    fetch(`/api/shared/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setSnap(j.snapshot); setState('ok'); })
      .catch(() => setState('missing'));
  }, [token]);

  useEffect(() => {
    if (!snap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Costruzione nodi/archi dal layout snapshot ──
    type N = { id: string; kind: 'task' | 'thesis' | 'action'; x: number; y: number; vx: number; vy: number; r: number; color: string; ph: number; data: any };
    const W0 = canvas.getBoundingClientRect().width, H0 = canvas.getBoundingClientRect().height;
    const nodes: N[] = [];
    const rand = (s: number) => W0 / 2 + (Math.random() - 0.5) * s;

    for (const t of snap.tasks || []) nodes.push({ id: t.id, kind: 'task', x: rand(W0 * 0.7), y: H0 / 2 + (Math.random() - 0.5) * H0 * 0.7, vx: 0, vy: 0, r: 16, color: TC[t.type] || '#5b9cf6', ph: Math.random() * 6.28, data: t });
    for (const th of snap.theses || []) nodes.push({ id: th.id, kind: 'thesis', x: rand(W0 * 0.5), y: H0 / 2 + (Math.random() - 0.5) * H0 * 0.5, vx: 0, vy: 0, r: 24, color: th.color || '#a78bfa', ph: Math.random() * 6.28, data: th });
    for (const a of snap.actions || []) {
      const src = (snap.theses || []).find((th: any) => th.clusterId === a.clusterId);
      nodes.push({ id: a.id, kind: 'action', x: rand(W0 * 0.5), y: H0 / 2 + (Math.random() - 0.5) * H0 * 0.5, vx: 0, vy: 0, r: 20, color: '#34d399', ph: Math.random() * 6.28, data: { ...a, srcId: src?.id } });
    }
    const byId = new Map(nodes.map((n) => [n.id, n]));

    type E = { a: N; b: N; alpha: number; dash: boolean };
    const edges: E[] = [];
    for (const c of snap.conns || []) {
      const a = byId.get(c.from), b = byId.get(c.to);
      if (a && b) edges.push({ a, b, alpha: 0.1 + 0.25 * (c.score || 0.5), dash: false });
    }
    for (const th of snap.theses || []) {
      const tn = byId.get(th.id);
      for (const sid of th.sources || []) {
        const sn = byId.get(sid);
        if (tn && sn) edges.push({ a: tn, b: sn, alpha: 0.12, dash: false });
      }
    }
    for (const n of nodes) {
      if (n.kind === 'action' && n.data.srcId) {
        const sn = byId.get(n.data.srcId);
        if (sn) edges.push({ a: n, b: sn, alpha: 0.3, dash: true });
      }
    }

    // ── Force layout: repulsione + molle + gravità al centro ──
    let iter = 0;
    const simulate = () => {
      for (let k = 0; k < 4; k++) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy; if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
            const f = 5200 / d2;
            const d = Math.sqrt(d2);
            a.vx += (dx / d) * f; a.vy += (dy / d) * f;
            b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const want = e.dash ? 110 : 150;
          const f = (d - want) * 0.012;
          e.a.vx += (dx / d) * f; e.a.vy += (dy / d) * f;
          e.b.vx -= (dx / d) * f; e.b.vy -= (dy / d) * f;
        }
        for (const n of nodes) {
          n.vx += (W0 / 2 - n.x) * 0.0012; n.vy += (H0 / 2 - n.y) * 0.0012;
          n.x += n.vx; n.y += n.vy;
          n.vx *= 0.82; n.vy *= 0.82;
        }
        iter++;
      }
    };

    // ── Vista (pan/zoom) ──
    const view = { x: 0, y: 0, z: 1 };
    const fitView = () => {
      if (!nodes.length) return;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const n of nodes) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
      const r = canvas.getBoundingClientRect();
      const pad = 90;
      const z = Math.min(1.4, Math.min((r.width - pad * 2) / Math.max(120, maxX - minX), (r.height - pad * 2) / Math.max(120, maxY - minY)));
      view.z = Math.max(0.3, z);
      view.x = r.width / 2 - ((minX + maxX) / 2) * view.z;
      view.y = r.height / 2 - ((minY + maxY) / 2) * view.z;
    };

    // ── Disegno ──
    const drawHex = (x: number, y: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6;
        i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)) : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
    };
    let fitted = false;
    const loop = () => {
      if (iter < 260) { simulate(); if (iter >= 260) { fitView(); fitted = true; } }
      else if (!fitted) { fitView(); fitted = true; }

      const r = canvas.getBoundingClientRect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.translate(view.x, view.y); ctx.scale(view.z, view.z);
      const t = Date.now() / 1000;

      for (const e of edges) {
        ctx.beginPath();
        if (e.dash) ctx.setLineDash([3, 3]);
        ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y);
        ctx.strokeStyle = e.dash ? '#34d399' : '#5b9cf6';
        ctx.globalAlpha = e.alpha; ctx.lineWidth = 1; ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.3 + n.ph);
        if (n.kind === 'task') {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6, 0, 6.29);
          ctx.fillStyle = n.color; ctx.globalAlpha = 0.06 * pulse; ctx.fill(); ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.29);
          ctx.fillStyle = '#0c1020'; ctx.fill();
          ctx.strokeStyle = n.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.fillStyle = n.color; ctx.font = '11px DM Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText((n.data.type || '?')[0].toUpperCase(), n.x, n.y);
        } else if (n.kind === 'thesis') {
          drawHex(n.x, n.y, n.r + 8);
          ctx.strokeStyle = n.color; ctx.lineWidth = 1; ctx.globalAlpha = 0.15 + 0.12 * pulse; ctx.stroke(); ctx.globalAlpha = 1;
          drawHex(n.x, n.y, n.r);
          ctx.fillStyle = '#0d0a18'; ctx.fill();
          ctx.strokeStyle = n.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 13, -Math.PI / 2, -Math.PI / 2 + (n.data.confidence / 100) * 6.28);
          ctx.strokeStyle = n.color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.fillStyle = n.color; ctx.font = '12px DM Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('◆', n.x, n.y);
          ctx.font = '9px DM Mono, monospace';
          ctx.fillText(`${n.data.confidence}%`, n.x, n.y + n.r + 22);
        } else {
          ctx.fillStyle = '#0a1a14'; ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
          ctx.strokeStyle = n.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85;
          ctx.strokeRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); ctx.globalAlpha = 1;
          ctx.fillStyle = n.color; ctx.font = '12px DM Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('▤', n.x, n.y);
          const ov = n.data.performance?.overall;
          if (ov) {
            ctx.font = '10px DM Mono, monospace';
            ctx.fillStyle = String(ov).trim().startsWith('-') ? '#e05555' : '#4ad68a';
            ctx.fillText(ov, n.x, n.y + n.r + 12);
          }
        }
      }

      // Etichette tesi (testo breve sotto l'esagono)
      ctx.font = '10px DM Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const n of nodes) {
        if (n.kind !== 'thesis') continue;
        const s = n.data.thesis.length > 26 ? n.data.thesis.slice(0, 26) + '…' : n.data.thesis;
        ctx.fillStyle = '#7c5ab8';
        ctx.fillText(s, n.x, n.y + n.r + 30);
      }

      raf = requestAnimationFrame(loop);
    };
    loop();

    // ── Interazione: pan, zoom, tap → dettaglio ──
    let dragging = false, moved = false, lx = 0, ly = 0;
    const toWorld = (sx: number, sy: number) => ({ x: (sx - view.x) / view.z, y: (sy - view.y) / view.z });
    const hit = (sx: number, sy: number) => {
      const p = toWorld(sx, sy);
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(n.x - p.x, n.y - p.y) < n.r + 10) return n;
      }
      return null;
    };
    const down = (x: number, y: number) => { dragging = true; moved = false; lx = x; ly = y; };
    const move = (x: number, y: number) => {
      if (!dragging) return;
      if (Math.abs(x - lx) + Math.abs(y - ly) > 3) moved = true;
      view.x += x - lx; view.y += y - ly; lx = x; ly = y;
    };
    const up = (x: number, y: number) => {
      if (dragging && !moved) {
        const n = hit(x, y);
        setDetail(n ? { kind: n.kind, data: n.data } : null);
      }
      dragging = false;
    };
    const rect = () => canvas.getBoundingClientRect();
    canvas.addEventListener('mousedown', (e) => down(e.clientX - rect().left, e.clientY - rect().top));
    window.addEventListener('mousemove', (e) => move(e.clientX - rect().left, e.clientY - rect().top));
    window.addEventListener('mouseup', (e) => up(e.clientX - rect().left, e.clientY - rect().top));
    canvas.addEventListener('touchstart', (e) => down(e.touches[0].clientX - rect().left, e.touches[0].clientY - rect().top), { passive: true });
    canvas.addEventListener('touchmove', (e) => move(e.touches[0].clientX - rect().left, e.touches[0].clientY - rect().top), { passive: true });
    canvas.addEventListener('touchend', (e) => up(e.changedTouches[0].clientX - rect().left, e.changedTouches[0].clientY - rect().top));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const mx = e.clientX - rect().left, my = e.clientY - rect().top;
      const before = toWorld(mx, my);
      view.z = Math.max(0.25, Math.min(2.5, view.z * (e.deltaY < 0 ? 1.1 : 0.9)));
      view.x = mx - before.x * view.z; view.y = my - before.y * view.z;
    }, { passive: false });

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [snap]);

  const stats = snap ? { t: (snap.tasks || []).length, th: (snap.theses || []).length, a: (snap.actions || []).length } : null;

  return (
    <div style={{ height: '100dvh', background: '#08080a', color: '#dddde8', fontFamily: "'DM Mono', monospace", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&display=swap');
        body { margin: 0; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .gd-card { animation: cardIn .35s cubic-bezier(.22,1,.36,1) both; }
        .gd-cta { transition: opacity .15s, transform .15s; }
        .gd-cta:hover { opacity: .88; transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #1f1f28', background: '#0e0e12', flexShrink: 0, zIndex: 5 }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 300 }}>Symnaps</span>
        <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#1a2a4a', color: '#5b9cf6', textTransform: 'uppercase', letterSpacing: '.06em' }}>grafo condiviso</span>
        {stats && (
          <span style={{ fontSize: 10, color: '#5a5a78', display: 'flex', gap: 12 }}>
            <span>● {stats.t} domande</span>
            <span style={{ color: '#a78bfa99' }}>◆ {stats.th} tesi</span>
            <span style={{ color: '#34d39999' }}>▤ {stats.a} portafogli</span>
          </span>
        )}
        <a href="/login" className="gd-cta" style={{ marginLeft: 'auto', background: '#5b9cf6', color: '#08080a', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          crea il tuo grafo →
        </a>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {state === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3a50', fontSize: 12 }}>caricamento del grafo…</div>
        )}
        {state === 'missing' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 300, color: '#7a7a95' }}>Questo grafo non esiste più</div>
            <a href="/login" style={{ color: '#5b9cf6', fontSize: 12 }}>crea il tuo →</a>
          </div>
        )}
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
        {state === 'ok' && (
          <div style={{ position: 'absolute', top: 14, left: 18, fontSize: 10, color: '#3a3a50', pointerEvents: 'none' }}>
            trascina per muoverti · rotella per zoom · tocca un nodo per i dettagli
          </div>
        )}

        {/* Card dettaglio */}
        {detail && (
          <div className="gd-card" style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: 'min(440px, calc(100% - 32px))', maxHeight: '46%', overflowY: 'auto', background: '#0e0e12f2', backdropFilter: 'blur(10px)', border: '1px solid #2a2a36', borderRadius: 16, padding: '16px 18px', zIndex: 10 }}>
            <button onClick={() => setDetail(null)} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: '#7a7a95', fontSize: 16, cursor: 'pointer' }}>×</button>
            {detail.kind === 'task' && (
              <>
                <div style={{ fontSize: 9, color: TC[detail.data.type] || '#5b9cf6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>● domanda · {detail.data.type || 'analisi'}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 300, lineHeight: 1.4, marginBottom: 10, paddingRight: 16 }}>{detail.data.q}</div>
                {detail.data.insight && <div style={{ fontSize: 11.5, color: '#9a9ab2', lineHeight: 1.7, fontFamily: "'Fraunces', serif" }}>{detail.data.insight}</div>}
                {!!(detail.data.metrics || []).length && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {detail.data.metrics.map((m: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 8, background: '#141418', color: m.pos === true ? '#4ad68a' : m.pos === false ? '#e05555' : '#dddde8' }}>
                        {m.k}: <b>{m.v}</b>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            {detail.kind === 'thesis' && (
              <>
                <div style={{ fontSize: 9, color: detail.data.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>◆ tesi · confidenza {detail.data.confidence}% · {detail.data.revisions} revisioni</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 15, fontWeight: 300, lineHeight: 1.5, marginBottom: 8, paddingRight: 16, color: '#d4bbff' }}>"{detail.data.thesis}"</div>
                {detail.data.explanation && <div style={{ fontSize: 11, color: '#7a7a95', lineHeight: 1.6 }}>{detail.data.explanation}</div>}
                {detail.data.signals && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10.5, lineHeight: 1.6 }}>
                    <div style={{ flex: 1 }}>{(detail.data.signals.confirm || []).map((s: string, i: number) => <div key={i} style={{ color: '#4ad68a99' }}>✓ {s}</div>)}</div>
                    <div style={{ flex: 1 }}>{(detail.data.signals.invalidate || []).map((s: string, i: number) => <div key={i} style={{ color: '#e0555599' }}>✗ {s}</div>)}</div>
                  </div>
                )}
              </>
            )}
            {detail.kind === 'action' && (
              <>
                <div style={{ fontSize: 9, color: '#34d399', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  ▤ portafoglio tesi{detail.data.performance?.overall ? ` · ${detail.data.performance.overall} dal lancio` : ''}
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 300, lineHeight: 1.4, marginBottom: 8, paddingRight: 16 }}>{detail.data.title || 'Portafoglio della tesi'}</div>
                {detail.data.summary && <div style={{ fontSize: 11, color: '#7a7a95', lineHeight: 1.6, marginBottom: 10 }}>{detail.data.summary}</div>}
                {(detail.data.categories || []).map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11, padding: '5px 0', borderBottom: '1px solid #1f1f28' }}>
                    <span style={{ flex: 1, color: '#9a9ab2' }}>{c.name}</span>
                    {c.weight_hint && <span style={{ color: '#34d399' }}>{c.weight_hint}</span>}
                  </div>
                ))}
                <div style={{ fontSize: 9, color: '#3a3a50', marginTop: 10, lineHeight: 1.5 }}>Contenuto educativo e illustrativo, non è consulenza finanziaria.</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '10px 20px', borderTop: '1px solid #1f1f28', background: '#0e0e12', fontSize: 10, color: '#3a3a50', flexShrink: 0, flexWrap: 'wrap' }}>
        <span>fatto con <span style={{ fontFamily: "'Fraunces', serif", color: '#7a7a95' }}>Symnaps</span> — le domande diventano un grafo, le tesi emergono da sole</span>
        <a href="/login" style={{ color: '#5b9cf6', textDecoration: 'none' }}>inizia gratis →</a>
      </div>
    </div>
  );
}
