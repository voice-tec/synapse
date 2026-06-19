'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useRef, useState } from 'react';

// ─── Brand palette (stessa dell'app) ───────────────────────────────────────
const C = {
  bg: '#08080a',
  text: '#dddde8',
  q: '#5b9cf6', // domande
  t: '#a78bfa', // tesi
  p: '#34d399', // portafogli
  warn: '#f0a030',
  card: '#0e0e12',
  cardSolid: '#141418',
  border: '#2a2a36',
  muted: '#7a7a95',
  faint: '#3a3a50',
};

const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAeCAYAAADHJYVoAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAACMklEQVR42rWWPWtUURCGn7m7iVmNScRSjVXwAwSxEg2oRbATa7ERCxv9CWpvYWFasRexsBCtFDXYCIKgFkaIYPADQVMpxuw+Fs6VmxB3k911YNh7zt7zzpy573nPQJoaao0uTd2g3ld/qnfU4SiBI8J83gYcA/YDg0B0wC2AFrALmAKaQA24XC+B1QZwBTifi5q5qJMFIDCQ46UEn0At1GF1xj92Td2nblKHcrvtvJHvHVS/JsYX9UBZr1s5eZQeTB1XT6jby4mpBD6X48HcTazTixWBCtQH6vucqKnRQ+ZFYhTlxKJ6PZ/r9NGK/Mrv+A9W1qnRSznagX8EJvMQ2Vd09WKyZSLHA/3CDnUzMAvMAYcjopUas94ytSKitVr2RzL7GXVPD1VYRuVQaxHRVI8DN4FR4CnwInXin1j5+x14DTyMiPmVQkgptepW9ZL6Sv2h/kpfauNVm1aHywDLtrSKPjc6+EZ1VN2vXs0AzzPJWFmzUOvdcl6dVFvqvU4vrku01MFcdyp3cDL6eF4CqEXEkjoLLPT7QNZzJ9Nqq+i3niQFP1WFiz6XZwSIqEwUeYTtpSxZ82fAGKtcT9FNthW2HEq2XCj/3JIcHatcV2umYiXIDvWD+lIdQt2rzmW0WXW8i8xH1NPqQrYXu0vhugGcARazw/oGfK40O+2aIfKa3JmN0AxwNiLeqEU9garMeQvMrwH8r44Dt4G7EfGoLGtEtEolfKw21SelqnVLwypBfgNA68VUmj2DLAAAAABJRU5ErkJggg==';

// ─── Hero graph: mostra il flusso domande → tesi → portafogli ───────────────
// Non rumore casuale come sullo /login: qui i legami nascono in zone precise
// (domande a sinistra, tesi al centro, portafogli a destra) e impulsi viaggiano
// lungo gli archi — l'animazione *racconta* cosa fa Symnaps.
function GraphHero() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = Math.max(window.innerHeight, 560);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    type Node = { x: number; y: number; vx: number; vy: number; r: number; c: string; ph: number; type: 0 | 1 | 2 };
    type Edge = { a: number; b: number; c: string; pulse: number; speed: number };

    // Zone orizzontali per tipo. Un po' di jitter perché non sembri una tabella.
    const zone = (type: 0 | 1 | 2) => {
      const band = type === 0 ? 0.22 : type === 1 ? 0.5 : 0.78;
      return W * (band + (Math.random() - 0.5) * 0.16);
    };

    const make = (type: 0 | 1 | 2): Node => ({
      x: zone(type),
      y: H * (0.12 + Math.random() * 0.76),
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: (type === 0 ? 2 : type === 1 ? 3 : 3.4) + Math.random() * 1.4,
      c: type === 0 ? C.q : type === 1 ? C.t : C.p,
      ph: Math.random() * Math.PI * 2,
      type,
    });

    const dense = W > 720;
    const nQ = dense ? 14 : 8, nT = dense ? 6 : 4, nP = dense ? 4 : 3;
    const nodes: Node[] = [
      ...Array.from({ length: nQ }, () => make(0)),
      ...Array.from({ length: nT }, () => make(1)),
      ...Array.from({ length: nP }, () => make(2)),
    ];
    const idxT = nodes.map((n, i) => (n.type === 1 ? i : -1)).filter((i) => i >= 0);
    const idxP = nodes.map((n, i) => (n.type === 2 ? i : -1)).filter((i) => i >= 0);

    // Legami diretti: ogni tesi pesca 2-3 domande vicine; ogni portafoglio 1-2 tesi.
    const edges: Edge[] = [];
    const nearest = (from: number, pool: number[], k: number) =>
      pool
        .map((j) => ({ j, d: Math.hypot(nodes[from].x - nodes[j].x, nodes[from].y - nodes[j].y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, k)
        .map((o) => o.j);

    const idxQ = nodes.map((n, i) => (n.type === 0 ? i : -1)).filter((i) => i >= 0);
    for (const t of idxT)
      for (const q of nearest(t, idxQ, 2 + Math.floor(Math.random() * 2)))
        edges.push({ a: q, b: t, c: C.t, pulse: Math.random(), speed: 0.003 + Math.random() * 0.004 });
    for (const p of idxP)
      for (const t of nearest(p, idxT, 1 + Math.floor(Math.random() * 2)))
        edges.push({ a: t, b: p, c: C.p, pulse: Math.random(), speed: 0.0025 + Math.random() * 0.003 });

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;

      if (!reduced)
        for (const n of nodes) {
          n.x += n.vx; n.y += n.vy;
          const home = n.type === 0 ? 0.22 : n.type === 1 ? 0.5 : 0.78;
          // molla morbida verso la banda: i tipi restano leggibili
          n.vx += (W * home - n.x) * 0.000004;
          if (n.y < H * 0.08 || n.y > H * 0.92) n.vy *= -1;
        }

      // Archi + impulso che scorre lungo il legame
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, a.c + '00');
        grad.addColorStop(1, e.c + '4d');
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (!reduced) {
          e.pulse += e.speed;
          if (e.pulse > 1) e.pulse -= 1;
          const px = a.x + (b.x - a.x) * e.pulse;
          const py = a.y + (b.y - a.y) * e.pulse;
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = e.c;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Nodi con alone pulsante
      for (const n of nodes) {
        const pulse = reduced ? 0.6 : 0.55 + 0.45 * Math.sin(t * 1.3 + n.ph);
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
        glow.addColorStop(0, n.c + '40');
        glow.addColorStop(1, n.c + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.5 * pulse;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.c;
        ctx.globalAlpha = 0.55 + 0.4 * pulse;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />;
}

// ─── Reveal allo scroll ─────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style, className }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(26px)',
        filter: shown ? 'blur(0)' : 'blur(8px)',
        transition: `opacity .8s cubic-bezier(.22,1,.36,1) ${delay}s, transform .8s cubic-bezier(.22,1,.36,1) ${delay}s, filter .8s cubic-bezier(.22,1,.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

const mono = "'DM Mono', monospace";
const serif = "'Fraunces', serif";

// Glifo nodo colorato (●/◆/▤) come sullo /login
function Glyph({ ch, color }: { ch: string; color: string }) {
  return <span style={{ color, fontSize: 18 }}>{ch}</span>;
}

// ─── Demo animata: la stessa scena che vive nell'app, in loop ───────────────
// Quattro battute che si auto-avanzano: domanda → tesi → portafoglio → il TUO
// portafoglio che marca "già coperto". Niente video: è il prodotto in piccolo.
function FlowDemo() {
  const [s, setS] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  // Parte solo quando entra in viewport (e non spreca raf fuori schermo)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setRun(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!run) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setS(4); return; }
    const id = setInterval(() => setS((p) => (p + 1) % 6), 1700);
    return () => clearInterval(id);
  }, [run]);

  const on = (n: number) => s >= n;       // comparso a questa battuta

  // Geometria nodi (coordinate % nel box) — come nell'app: domande a sx, tesi
  // al centro, portafoglio a dx.
  const N = {
    q1: { x: 17, y: 28 }, q2: { x: 17, y: 72 },
    t: { x: 50, y: 50 }, p: { x: 83, y: 50 },
  };

  return (
    <div ref={wrap} className="w-card" style={{ background: C.card, border: `1px solid ${C.border}88`, borderRadius: 18, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) minmax(0,1fr)' }} className="fd-grid">
        {/* Scena grafo — gli stessi nodi del prodotto: domanda·cerchio, tesi·esagono, portafoglio·quadrato */}
        <div style={{ position: 'relative', minHeight: 460, borderRight: `1px solid ${C.border}55`, background: 'radial-gradient(ellipse 80% 70% at 50% 50%, #0c0c1100, #08080a55)' }}>
          {/* Connettori tratteggiati (come gli archi memory→task / action→memory dell'app) */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <Conn a={N.q1} b={N.t} show={on(2)} col={C.t} />
            <Conn a={N.q2} b={N.t} show={on(2)} col={C.t} />
            <Conn a={N.t} b={N.p} show={on(3)} col={C.p} />
          </svg>

          {/* Domande: cerchio scuro, bordo blu, lettera del tipo di analisi */}
          <GNode p={N.q1} show={on(0)} active={s === 0} kind="q" col={C.q} glyph="V" label="le big tech reggono coi tassi alti?" />
          <GNode p={N.q2} show={on(1)} active={s === 1} kind="q" col={C.q} glyph="M" label="nvidia: la domanda AI rallenta?" />
          {/* Tesi: esagono, arco di confidenza, verdetto */}
          <GNode p={N.t} show={on(2)} active={s === 2} kind="t" col={C.t} glyph="◆" label="mega-cap tech" sub="conf. 72% ↑" conf={0.72} />
          {/* Portafoglio: quadrato verde */}
          <GNode p={N.p} show={on(3)} active={s >= 3} kind="p" col={C.p} glyph="▤" label="portafoglio tesi" sub={on(4) ? '+ già coperto' : '5 categorie'} />
        </div>

        {/* Pannello che racconta la battuta */}
        <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 360, justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: s >= i + 1 || (s === 0 && i === 0) ? [C.q, C.q, C.t, C.p][i] : C.faint + '55', transition: 'background .4s' }} />
            ))}
          </div>

          <Beat show={s <= 1} c={C.q} k="esempio · domande" h="Parti da due domande vere">
            «Le big tech reggono coi tassi alti?» Poi «la domanda AI di Nvidia rallenta?». Ognuna risponde sui dati e prende posizione.
          </Beat>
          <Beat show={s === 2} c={C.t} k="esempio · tesi" h="Si fondono in una tesi">
            Stesso tema → emerge la tesi <b style={{ color: C.t }}>«mega-cap tech»</b> con confidenza 72%, alimentata dai segnali delle due domande.
          </Beat>
          <Beat show={s === 3} c={C.p} k="esempio · portafoglio" h="La tesi diventa strumenti">
            Da «mega-cap tech» nasce un portafoglio: categorie e strumenti reali (ETF, indici), pronti da valutare.
          </Beat>
          <Beat show={s >= 4} c={C.p} k="esempio · il tuo portafoglio" h="Incrociato con ciò che hai">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {['VWCE 60%', 'SGLN 10%', 'AGGH 30%'].map((h) => (
                <span key={h} style={{ fontSize: 10.5, color: C.p, border: `1px solid ${C.p}40`, background: C.p + '12', borderRadius: 7, padding: '3px 8px' }}>{h}</span>
              ))}
            </div>
            Carichi cosa possiedi e Symnaps segnala: <b style={{ color: C.p }}>«mega-cap già coperte in parte da VWCE»</b>.
          </Beat>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px){ .fd-grid{ grid-template-columns: 1fr !important; } .fd-grid > div:first-child{ border-right: none !important; border-bottom: 1px solid ${C.border}55; } }
        .fd-march{ animation: fdMarch 1.2s linear infinite; }
        @keyframes fdMarch{ to { stroke-dashoffset: -6; } }
        .fd-pulse{ transform-box: fill-box; transform-origin: center; animation: fdPulse 1.7s ease-in-out infinite; }
        @keyframes fdPulse{ 0%,100%{ opacity:.55; transform:scale(1); } 50%{ opacity:.12; transform:scale(1.18); } }
        @media (prefers-reduced-motion: reduce){ .fd-march, .fd-pulse{ animation: none; } }
      ` }} />
    </div>
  );
}

// Connettore tratteggiato in stile app (marching ants), appare alla sua battuta
function Conn({ a, b, show, col }: { a: { x: number; y: number }; b: { x: number; y: number }; show: boolean; col: string }) {
  return (
    <g style={{ opacity: show ? 1 : 0, transition: 'opacity .6s ease' }}>
      <line
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={col} strokeWidth={0.5} strokeLinecap="round"
        strokeDasharray="1.4 1.6"
        className={show ? 'fd-march' : undefined}
        style={{ opacity: 0.5 }}
      />
      {/* Impulso: il dato che scorre lungo l'arco nella direzione del flusso */}
      {show && (
        <circle r={1.4} fill={col}>
          <animate attributeName="cx" values={`${a.x};${b.x}`} dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="cy" values={`${a.y};${b.y}`} dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

// Nodo disegnato come nel prodotto: domanda·cerchio, tesi·esagono, portafoglio·quadrato.
// Lo shape sta in un <svg> quadrato proprio, così non si deforma.
const HEX = '85,30 85,70 50,90 15,70 15,30 50,10'; // esagono pointy-top, come drawHex()
function GNode({ p, show, kind, col, glyph, label, sub, conf, active }: {
  p: { x: number; y: number }; show: boolean; kind: 'q' | 't' | 'p'; col: string;
  glyph: string; label: string; sub?: string; conf?: number; active?: boolean;
}) {
  const size = kind === 'q' ? 64 : kind === 't' ? 94 : 80;
  const fill = kind === 'q' ? '#0e0e12' : kind === 't' ? '#0d0a18' : '#0a1a14';
  const C2 = 2 * Math.PI * 46;
  return (
    <div style={{
      position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: size, height: size,
      transform: `translate(-50%, -50%) scale(${show ? (active ? 1.06 : 1) : 0.7})`,
      opacity: show ? 1 : 0, transition: 'opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1)',
      pointerEvents: 'none', zIndex: active ? 3 : 2,
    }}>
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {/* alone */}
          {kind === 'q' && <circle cx={50} cy={50} r={48} fill={col} opacity={0.06} />}
          {kind === 'q' && <circle cx={50} cy={50} r={38} fill={fill} stroke={col} strokeWidth={4} opacity={0.95} />}
          {kind === 't' && <polygon points={HEX} fill={col} opacity={0.06} transform="scale(1.18) translate(-7.6 -7.6)" />}
          {kind === 't' && <polygon points={HEX} fill={fill} stroke={col} strokeWidth={3.5} />}
          {kind === 't' && conf != null && (
            <circle cx={50} cy={50} r={46} fill="none" stroke={col} strokeWidth={3}
              strokeDasharray={`${C2 * conf} ${C2}`} strokeLinecap="round"
              transform="rotate(-90 50 50)" opacity={0.6} />
          )}
          {kind === 'p' && <rect x={6} y={6} width={88} height={88} rx={3} fill={col} opacity={0.06} />}
          {kind === 'p' && <rect x={16} y={16} width={68} height={68} fill={fill} stroke={col} strokeWidth={4} />}
          {/* Anello che pulsa quando il nodo è quello "attivo" nella battuta corrente */}
          {active && show && kind === 'q' && <circle cx={50} cy={50} r={40} fill="none" stroke={col} strokeWidth={2.5} className="fd-pulse" />}
          {active && show && kind === 't' && <polygon points={HEX} fill="none" stroke={col} strokeWidth={2.5} className="fd-pulse" />}
          {active && show && kind === 'p' && <rect x={16} y={16} width={68} height={68} fill="none" stroke={col} strokeWidth={2.5} className="fd-pulse" />}
        </svg>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: col, fontFamily: mono, fontSize: kind === 'q' ? 15 : 18, fontWeight: 500,
        }}>{glyph}</span>
      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 9, width: 150, textAlign: 'center' }}>
        <div style={{ fontFamily: kind === 'q' ? mono : serif, fontSize: kind === 'q' ? 10 : 11.5, lineHeight: 1.3, color: kind === 'q' ? C.muted : '#fff' }}>{label}</div>
        {sub && <div style={{ marginTop: 3, fontSize: 9.5, color: col, letterSpacing: '.02em' }}>{sub}</div>}
      </div>
    </div>
  );
}

function Beat({ show, c, k, h, children }: { show: boolean; c: string; k: string; h: string; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="w-in" style={{ animationDuration: '.5s' }}>
      <div style={{ fontSize: 10, color: c, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 7 }}>{k}</div>
      <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 19, color: '#fff', marginBottom: 9 }}>{h}</h3>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, margin: 0 }}>{children}</p>
    </div>
  );
}

// Sticky-stack = ANATOMIA del sistema (cos'è ogni nodo + perché è rigoroso).
// Distinta dalla demo, che mostra UN esempio concreto svolgersi.
const STEPS = [
  {
    g: '●', c: C.q, k: 'domanda',
    h: 'Interroga dati reali, non opinioni',
    b: 'Ogni domanda è un nodo. Symnaps risponde con dati ufficiali — serie FRED e prezzi Twelve Data, niente numeri inventati — e prende posizione con un verdetto netto: sì, no o dipende.',
  },
  {
    g: '◆', c: C.t, k: 'tesi',
    h: 'Un track record che non si può gonfiare',
    b: 'Le domande sullo stesso tema diventano una tesi. La confidenza è calcolata dai dati, non sparata dal modello: segnali testabili la confermano o la invalidano, e si ri-controlla ogni settimana.',
  },
  {
    g: '▤', c: C.p, k: 'portafoglio',
    h: 'Tradotta in strumenti, con i suoi limiti',
    b: 'Da una tesi solida nasce un portafoglio: categorie e strumenti reali (ETF, indici), a taglio educativo, agganciato a ciò che già possiedi.',
  },
];

const FEATURES = [
  { g: '◵', c: C.q, h: 'Scenari & catalizzatori', b: 'Modelli Bull / Base / Bear per ogni tesi, integrati con i catalizzatori di mercato in arrivo che possono spostare i prezzi.' },
  { g: '▦', c: C.p, h: 'Dati macro ufficiali', b: 'Serie FRED® e prezzi Twelve Data integrati direttamente nei tuoi parametri di ricerca e nei grafici a linea. Niente numeri inventati, solo fonti istituzionali.' },
  { g: '◆', c: C.t, h: 'Memoria del grafo', b: 'Nodi di memoria storici che ricordano ogni tua analisi conclusa. La tua ricerca non riparte mai da zero, si evolve.' },
  { g: '✕', c: C.warn, h: 'Stress Test', b: "Sfida la tenuta di una tesi inserendo una nuova variabile macro. Guarda se l'analisi regge alla pressione dei dati storici o se invalida l'ipotesi." },
  { g: '◷', c: C.t, h: 'Verdetto dinamico', b: 'Symnaps monitora le tesi e aggiorna i collegamenti ogni settimana, registrando ogni singolo cambiamento di scenario nello storico delle tue analisi.' },
  { g: '▤', c: C.p, h: 'Carica il tuo portafoglio', b: 'Inserisci gli strumenti che possiedi davvero (ticker e peso). Ogni portafoglio di tesi segnala cosa hai già coperto — es. "già coperto in parte da VWCE".' },
  { g: '↗', c: C.q, h: 'Condividi il grafo', b: 'Pubblica un link al grafo: responsive, pinch-zoom, leggibile da chiunque — senza account.' },
];

// Barra di avanzamento scroll (i 3 colori semantici). transform-only, rAF-throttle.
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? h.scrollTop / max : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.q}, ${C.t}, ${C.p})`, transformOrigin: '0 50%', transform: 'scaleX(0)', zIndex: 30, pointerEvents: 'none' }} />;
}

// Mesh di orb sfocati + grana: profondità dietro a tutto, costo GPU contenuto.
function GrainOrbs() {
  return (
    <>
      <div className="w-orbs" data-par="0.28" aria-hidden><div className="w-orb w-orb1" /><div className="w-orb w-orb2" /><div className="w-orb w-orb3" /></div>
      <div className="w-grain" aria-hidden />
    </>
  );
}

// Marquee: cosa Symnaps mastica davvero (una sola sulla pagina, racconta i dati).
const MARQUEE = ['FRED macro', 'Twelve Data', 'CPI', 'tassi FED', 'NVDA', 'spread high-yield', 'VWCE', 'mega-cap tech', 'oro', 'curva dei rendimenti', 'utili trimestrali', 'volatilità'];
function Marquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div className="w-marquee" style={{ borderTop: `1px solid ${C.border}55`, borderBottom: `1px solid ${C.border}55`, padding: '15px 0' }}>
      <div className="w-mtrack">
        {items.map((m, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, fontSize: 12.5, color: C.muted, letterSpacing: '.05em' }}>
            <span style={{ color: [C.q, C.t, C.p][i % 3], fontSize: 9 }}>●</span>{m}
          </span>
        ))}
      </div>
    </div>
  );
}

// Conteggio animato all'ingresso in viewport (rAF, niente re-render React).
function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to + suffix; return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const dur = 1100, t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

const STATS = [
  { n: 3, k: 'tipi di nodo nel grafo', c: C.q },
  { n: 2, k: 'fonti dati ufficiali (FRED · Twelve Data)', c: C.p },
  { n: 0, k: 'numeri inventati', c: C.t },
];

export default function Welcome() {
  // CTA magnetiche: il bottone segue leggermente il cursore (transform inline,
  // transizione .15s della .w-btn = molla morbida). Spento con reduced-motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const btns = Array.from(document.querySelectorAll<HTMLElement>('.w-cta'));
    const cleanups: Array<() => void> = [];
    btns.forEach((b) => {
      const move = (e: MouseEvent) => {
        const r = b.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        b.style.transform = `translate(${mx * 0.18}px, ${my * 0.28}px)`;
      };
      const leave = () => { b.style.transform = ''; };
      b.addEventListener('mousemove', move);
      b.addEventListener('mouseleave', leave);
      cleanups.push(() => { b.removeEventListener('mousemove', move); b.removeEventListener('mouseleave', leave); });
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  // Parallax: elementi con [data-par] traslano in funzione dello scroll; [data-fade]
  // sfuma uscendo dall'hero. Un solo loop rAF, scroll passivo, transform/opacity.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pars = Array.from(document.querySelectorAll<HTMLElement>('[data-par]'));
    const fades = Array.from(document.querySelectorAll<HTMLElement>('[data-fade]'));
    const stack = Array.from(document.querySelectorAll<HTMLElement>('.w-stack-card'));
    let raf = 0;
    const update = () => {
      const y = window.scrollY;
      for (const el of pars) el.style.transform = `translate3d(0, ${Math.round(y * parseFloat(el.dataset.par || '0'))}px, 0)`;
      for (const el of fades) el.style.opacity = String(Math.max(0, 1 - y / 560));
      // Sticky-stack: il pannello uscente si rimpicciolisce e sfuma man mano che
      // il successivo gli sale sopra (progress = quanto il next si avvicina al pin).
      const vh = window.innerHeight;
      for (let i = 0; i < stack.length - 1; i++) {
        const nr = stack[i + 1].getBoundingClientRect();
        const pinTop = 84 + i * 16;
        const p = Math.max(0, Math.min(1, (vh - nr.top) / (vh - pinTop)));
        stack[i].style.transform = `scale(${(1 - 0.09 * p).toFixed(4)})`;
        // scurisco con brightness (NON opacity): il pannello resta opaco, niente trasparenza
        stack[i].style.filter = `brightness(${(1 - 0.5 * p).toFixed(3)})`;
      }
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: mono, minHeight: '100dvh', overflowX: 'clip' }}>
      <ScrollProgress />
      <GrainOrbs />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&display=swap');
        a { text-decoration: none; }
        .w-in { animation: wIn .8s cubic-bezier(.22,1,.36,1) both; }
        @keyframes wIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .w-btn { transition: transform .15s cubic-bezier(.22,1,.36,1), box-shadow .15s, opacity .15s; }
        .w-btn:hover { transform: translateY(-2px); }
        .w-btn:active { transform: translateY(0) scale(.985); }
        .w-cta span { transition: transform .18s cubic-bezier(.22,1,.36,1); }
        .w-cta:hover span { transform: translateX(4px) rotate(-2deg); }
        .w-card { transition: border-color .3s, transform .35s cubic-bezier(.22,1,.36,1), background .3s, box-shadow .35s; }
        .w-card:hover { border-color: ${C.border}; transform: translateY(-6px) scale(1.015); background: ${C.cardSolid}; box-shadow: 0 30px 60px -28px #000000e6; }
        .w-step:hover .w-stepnum { opacity: 1; }
        .w-rise { animation: wRise 1s cubic-bezier(.16,1,.3,1) both; }
        @keyframes wRise { from { transform: translateY(118%) rotate(2deg); opacity: 0; filter: blur(6px); } to { transform: translateY(0) rotate(0); opacity: 1; filter: blur(0); } }
        /* Mesh di orb sfocati che derivano lenti dietro tutto */
        .w-orbs { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .w-orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; will-change: transform; }
        .w-orb1 { width: 48vw; height: 48vw; left: -12vw; top: -10vw; background: radial-gradient(circle, ${C.q}66, transparent 64%); animation: orb1 24s ease-in-out infinite; }
        .w-orb2 { width: 42vw; height: 42vw; right: -10vw; top: 16vh; background: radial-gradient(circle, ${C.t}59, transparent 64%); animation: orb2 28s ease-in-out infinite; }
        .w-orb3 { width: 40vw; height: 40vw; left: 24vw; bottom: -14vw; background: radial-gradient(circle, ${C.p}4d, transparent 64%); animation: orb3 32s ease-in-out infinite; }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(9vw,7vh) scale(1.12)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-7vw,-5vh) scale(1.1)} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(5vw,-7vh) scale(1.15)} }
        .w-grain { position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: .045; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
        /* Marquee orizzontale (una sola, racconta cosa analizza) */
        .w-marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
        .w-mtrack { display: inline-flex; gap: 30px; white-space: nowrap; animation: marq 34s linear infinite; }
        .w-marquee:hover .w-mtrack { animation-play-state: paused; }
        @keyframes marq { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .w-glass { backdrop-filter: blur(16px) saturate(1.2); background: ${C.bg}aa; border: 1px solid ${C.border}cc; box-shadow: 0 12px 40px -16px #000000cc; }
        /* Sticky-stack: i 3 step si impilano fissandosi in sequenza durante lo scroll */
        .w-stack-card { position: sticky; border-radius: 26px; overflow: hidden; box-shadow: 0 30px 70px -30px #000000e6; transform-origin: 50% 0; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce){ .w-stack-card { position: relative !important; transform: none !important; opacity: 1 !important; filter: none !important; } }
        /* Bento "come funziona": card grande a sinistra (a) su due righe, b/c a destra */
        .w-bento3 { display: grid; gap: 16px; grid-template-columns: 1.35fr 1fr; grid-template-areas: 'a b' 'a c'; }
        .w-bento3 .ba { grid-area: a; } .w-bento3 .bb { grid-area: b; } .w-bento3 .bc { grid-area: c; }
        /* Bento feature: ritmo non uniforme (tile larghe e strette) */
        .w-bentoF { display: grid; gap: 14px; grid-template-columns: repeat(6, 1fr); }
        .w-bentoF .f0 { grid-column: span 4; } .w-bentoF .f1 { grid-column: span 2; }
        .w-bentoF .f2 { grid-column: span 2; } .w-bentoF .f3 { grid-column: span 2; } .w-bentoF .f4 { grid-column: span 2; }
        .w-bentoF .f5 { grid-column: span 3; } .w-bentoF .f6 { grid-column: span 3; }
        @media (max-width: 760px){
          .w-bento3 { grid-template-columns: 1fr; grid-template-areas: 'a' 'b' 'c'; }
          .w-bentoF { grid-template-columns: 1fr; }
          .w-bentoF > * { grid-column: auto !important; }
          .w-stats { grid-template-columns: 1fr !important; }
        }
        ::selection { background: ${C.q}33; }
        @media (prefers-reduced-motion: reduce){
          .w-in, .w-rise { animation: none !important; }
          .w-btn:hover, .w-card:hover { transform: none !important; }
          .w-orb, .w-mtrack { animation: none !important; }
        }
      ` }} />


      {/* ── Nav: pill di vetro fluttuante, staccata dal bordo ── */}
      <nav className="w-glass" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', gap: 18, padding: '8px 8px 8px 18px', borderRadius: 999, width: 'max-content', maxWidth: 'calc(100vw - 32px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src={LOGO} alt="Symnaps" style={{ height: 20 }} />
          <span style={{ fontFamily: serif, fontWeight: 300, fontSize: 18, color: '#fff', letterSpacing: '.02em' }}>Symnaps</span>
        </div>
        <a href="/login" className="w-btn" style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: C.bg, background: C.q, borderRadius: 999, padding: '8px 16px' }}>accedi</a>
      </nav>

      {/* ── Hero ── */}
      <header style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 20px 80px' }}>
        <GraphHero />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: `radial-gradient(ellipse 70% 60% at 50% 42%, transparent 28%, ${C.bg}e6 78%)` }} />

        <div data-par="0.16" data-fade style={{ position: 'relative', zIndex: 2, maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, willChange: 'transform, opacity' }}>
          <div className="w-in" style={{ fontSize: 11, color: C.faint, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            sistema di pensiero visivo · ricerca finanziaria
          </div>

          <h1 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(50px, 11vw, 132px)', lineHeight: 1.0, letterSpacing: '-.035em' }}>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '.1em' }}><span className="w-rise" style={{ display: 'block', color: C.q, animationDelay: '.06s' }}>Questions.</span></span>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '.1em' }}><span className="w-rise" style={{ display: 'block', color: C.t, animationDelay: '.18s' }}>Theses.</span></span>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '.1em' }}><span className="w-rise" style={{ display: 'block', color: C.p, animationDelay: '.30s' }}>Portfolios.</span></span>
          </h1>

          <p className="w-in" style={{ maxWidth: 560, fontSize: 14.5, lineHeight: 1.7, color: C.muted, animationDelay: '.16s' }}>
            Mappa la tua ricerca finanziaria in un grafo dinamico. Symnaps collega le tue
            ipotesi a macro-scenari e dati ufficiali, organizzando visivamente la tua
            intelligenza.
          </p>

          <div className="w-in" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '.24s' }}>
            <a href="/login" className="w-btn w-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.q, color: C.bg, fontFamily: mono, fontWeight: 500, fontSize: 13, borderRadius: 12, padding: '11px 13px 11px 20px', boxShadow: `0 10px 34px -10px ${C.q}77` }}>
              Inizia da una domanda
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#08080a26', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>→</span>
            </a>
            <a href="#come" className="w-btn" style={{ color: C.text, fontFamily: mono, fontSize: 13, borderRadius: 12, padding: '13px 22px', border: `1px solid ${C.border}` }}>
              Vedi come funziona
            </a>
          </div>

          <div className="w-in" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', fontSize: 10.5, color: C.faint, letterSpacing: '.04em', marginTop: 8, animationDelay: '.32s' }}>
            <span><Glyph ch="●" color={C.q} /> domande</span>
            <span style={{ color: C.faint }}>→</span>
            <span><Glyph ch="◆" color={C.t} /> tesi</span>
            <span style={{ color: C.faint }}>→</span>
            <span><Glyph ch="▤" color={C.p} /> portafogli</span>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 2, fontSize: 18, color: C.faint, animation: 'wIn 1s 1s both' }}>↓</div>
      </header>

      {/* ── Marquee dati: cosa analizza ── */}
      <div style={{ position: 'relative', zIndex: 5 }}>
        <Marquee />
      </div>

      {/* ── Come funziona ── */}
      <section id="come" style={{ position: 'relative', zIndex: 5, maxWidth: 1040, margin: '0 auto', padding: '90px 24px 40px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(26px, 4vw, 38px)', color: '#fff', letterSpacing: '-.01em' }}>
              Tre tipi di nodo, costruiti sui <span style={{ fontStyle: 'italic' }}>dati</span>.
            </h2>
          </div>
        </Reveal>

        <div className="w-stack">
          {STEPS.map((s, i) => (
            <div key={s.k} className="w-stack-card" style={{ top: 84 + i * 16, zIndex: i + 1, marginBottom: i < STEPS.length - 1 ? 28 : 0, minHeight: '58vh', background: `linear-gradient(135deg, ${s.c}26, transparent 60%), ${C.cardSolid}`, border: `1px solid ${s.c}3a`, display: 'flex', alignItems: 'center', gap: 'clamp(20px,5vw,64px)', padding: 'clamp(30px,5vw,60px)', flexWrap: 'wrap' }}>
              {/* numero filigrana */}
              <div style={{ position: 'absolute', top: '-8%', right: '2%', fontFamily: serif, fontWeight: 300, fontSize: 'clamp(130px,24vw,320px)', lineHeight: 0.8, color: s.c + '1c', pointerEvents: 'none', userSelect: 'none' }}>0{i + 1}</div>
              {/* nodo come nel grafo: cerchio (domanda) · esagono+arco (tesi) · quadrato (portafoglio) */}
              <div style={{ position: 'relative', flexShrink: 0, width: 'clamp(112px,18vw,200px)', height: 'clamp(112px,18vw,200px)' }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  {i === 0 && (<><circle cx="50" cy="50" r="48" fill={s.c} opacity="0.07" /><circle cx="50" cy="50" r="40" fill={C.cardSolid} stroke={s.c} strokeWidth="3" /></>)}
                  {i === 1 && (<><polygon points={HEX} fill={s.c} opacity="0.07" transform="scale(1.16) translate(-6.9 -6.9)" /><polygon points={HEX} fill={C.cardSolid} stroke={s.c} strokeWidth="3" /><circle cx="50" cy="50" r="46" fill="none" stroke={s.c} strokeWidth="3" strokeDasharray={`${(2 * Math.PI * 46 * 0.72).toFixed(1)} ${(2 * Math.PI * 46).toFixed(1)}`} strokeLinecap="round" transform="rotate(-90 50 50)" opacity="0.65" /></>)}
                  {i === 2 && (<><rect x="6" y="6" width="88" height="88" rx="4" fill={s.c} opacity="0.07" /><rect x="14" y="14" width="72" height="72" fill={C.cardSolid} stroke={s.c} strokeWidth="3" /></>)}
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: 'clamp(30px,5vw,58px)', color: s.c }}>{s.g}</span>
                {i === 1 && <span style={{ position: 'absolute', bottom: '-22px', left: 0, right: 0, textAlign: 'center', fontSize: 11, color: s.c, letterSpacing: '.04em' }}>conf. 72% ↑</span>}
              </div>
              <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                <div style={{ fontSize: 11, color: s.c, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>{s.k}</div>
                <h3 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(26px,4vw,44px)', color: '#fff', marginBottom: 16, lineHeight: 1.1, letterSpacing: '-.02em' }}>{s.h}</h3>
                <p style={{ fontSize: 'clamp(13px,1.4vw,16px)', lineHeight: 1.7, color: C.muted, maxWidth: '48ch' }}>{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo animata ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 1040, margin: '0 auto', padding: '40px 24px 20px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(24px, 4vw, 34px)', color: '#fff', letterSpacing: '-.01em' }}>
              Da una domanda al <span style={{ fontStyle: 'italic' }}>tuo</span> portafoglio.
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <FlowDemo />
        </Reveal>
      </section>

      {/* ── Features ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 1040, margin: '0 auto', padding: '50px 24px 40px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(26px, 4vw, 38px)', color: '#fff', letterSpacing: '-.01em' }}>
              Non un editor di note. Un <span style={{ fontStyle: 'italic' }}>sistema visivo</span> che connette i dati.
            </h2>
          </div>
        </Reveal>

        <div className="w-bentoF">
          {FEATURES.map((f, i) => (
            <Reveal key={f.h} className={`f${i}`} delay={(i % 3) * 0.07}>
              <div className="w-card" style={{ background: i === 0 ? `linear-gradient(135deg, ${f.c}16, ${C.card})` : C.card, border: `1px solid ${i === 0 ? f.c + '3a' : C.border + '88'}`, borderRadius: 16, padding: '22px 22px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: f.c + '1a', border: `1px solid ${f.c}3a`, color: f.c, fontSize: 15 }}>{f.g}</span>
                  <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 17, color: '#fff' }}>{f.h}</h3>
                </div>
                <p style={{ fontSize: 12.5, lineHeight: 1.65, color: C.muted, maxWidth: i === 0 ? '54ch' : undefined }}>{f.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Numeri onesti (count-up) ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 1040, margin: '0 auto', padding: '40px 24px 10px' }}>
        <Reveal>
          <div className="w-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {STATS.map((st) => (
              <div key={st.k} style={{ textAlign: 'center', padding: '26px 16px' }}>
                <div style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(44px, 7vw, 76px)', color: st.c, lineHeight: 1 }}><CountUp to={st.n} /></div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 12, letterSpacing: '.03em' }}>{st.k}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── CTA finale ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 860, margin: '0 auto', padding: '60px 24px 80px' }}>
        <Reveal>
          <div style={{ position: 'relative', borderRadius: 28, border: `1px solid ${C.border}`, background: `linear-gradient(180deg, ${C.card}, ${C.bg})`, padding: 'clamp(48px, 7vw, 80px) 32px', textAlign: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 70% 90% at 50% 0%, ${C.q}24, transparent 62%)` }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(30px, 5.5vw, 52px)', color: '#fff', marginBottom: 16, lineHeight: 1.12, letterSpacing: '-.02em' }}>
                Inizia da una domanda.<br /><span style={{ fontStyle: 'italic', color: C.muted }}>Al resto pensa la struttura.</span>
              </h2>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 26 }}>Gratis per iniziare. Nessuna carta richiesta.</p>
              <a href="/login" className="w-btn w-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.q, color: C.bg, fontFamily: mono, fontWeight: 500, fontSize: 13, borderRadius: 12, padding: '12px 14px 12px 22px', boxShadow: `0 10px 34px -10px ${C.q}77` }}>
                Inizia da una domanda
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#08080a26', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>→</span>
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: 'relative', zIndex: 5, borderTop: `1px solid ${C.border}55`, padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src={LOGO} alt="" style={{ height: 18 }} />
          <span style={{ fontFamily: serif, fontWeight: 300, fontSize: 15, color: C.muted }}>Symnaps</span>
        </div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.04em' }}>un sistema di pensiero visivo per la ricerca finanziaria</div>
        <a href="/login" style={{ fontSize: 11, color: C.muted }}>accedi →</a>
      </footer>
    </div>
  );
}
