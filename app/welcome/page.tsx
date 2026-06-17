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
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
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
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(22px)',
        transition: `opacity .7s cubic-bezier(.22,1,.36,1) ${delay}s, transform .7s cubic-bezier(.22,1,.36,1) ${delay}s`,
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)' }} className="fd-grid">
        {/* Scena grafo — gli stessi nodi del prodotto: domanda·cerchio, tesi·esagono, portafoglio·quadrato */}
        <div style={{ position: 'relative', minHeight: 320, borderRight: `1px solid ${C.border}55`, background: 'radial-gradient(ellipse 80% 70% at 50% 50%, #0c0c1100, #08080a55)' }}>
          {/* Connettori tratteggiati (come gli archi memory→task / action→memory dell'app) */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <Conn a={N.q1} b={N.t} show={on(2)} col={C.t} />
            <Conn a={N.q2} b={N.t} show={on(2)} col={C.t} />
            <Conn a={N.t} b={N.p} show={on(3)} col={C.p} />
          </svg>

          {/* Domande: cerchio scuro, bordo blu, lettera del tipo di analisi */}
          <GNode p={N.q1} show={on(0)} kind="q" col={C.q} glyph="V" label="le big tech reggono coi tassi alti?" />
          <GNode p={N.q2} show={on(1)} kind="q" col={C.q} glyph="M" label="nvidia: la domanda AI rallenta?" />
          {/* Tesi: esagono, arco di confidenza, verdetto */}
          <GNode p={N.t} show={on(2)} kind="t" col={C.t} glyph="◆" label="mega-cap tech" sub="conf. 72% ↑" conf={0.72} />
          {/* Portafoglio: quadrato verde */}
          <GNode p={N.p} show={on(3)} kind="p" col={C.p} glyph="▤" label="portafoglio tesi" sub={on(4) ? '+ già coperto' : '5 categorie'} />
        </div>

        {/* Pannello che racconta la battuta */}
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300, justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: s >= i + 1 || (s === 0 && i === 0) ? [C.q, C.q, C.t, C.p][i] : C.faint + '55', transition: 'background .4s' }} />
            ))}
          </div>

          <Beat show={s <= 1} c={C.q} k="domande" h="Parti da una domanda">
            Ogni domanda è un nodo blu. Symnaps cerca i dati reali — FRED, prezzi Twelve Data — e risponde.
          </Beat>
          <Beat show={s === 2} c={C.t} k="tesi" h="La tesi emerge da sola">
            Le domande sullo stesso tema si coagulano in una tesi viola, con una <b style={{ color: C.t }}>confidenza che sale e scende</b> e segnali che la confermano o la smontano. Si ricontrolla ogni settimana.
          </Beat>
          <Beat show={s === 3} c={C.p} k="portafoglio" h="Germoglia un portafoglio">
            Dalla tesi forte nasce un portafoglio verde: categorie di asset e strumenti reali (ETF, indici), derivati dalla tesi.
          </Beat>
          <Beat show={s >= 4} c={C.p} k="il tuo portafoglio" h="Carica cosa possiedi davvero">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {['VWCE 60%', 'SGLN 10%', 'AGGH 30%'].map((h) => (
                <span key={h} style={{ fontSize: 10.5, color: C.p, border: `1px solid ${C.p}40`, background: C.p + '12', borderRadius: 7, padding: '3px 8px' }}>{h}</span>
              ))}
            </div>
            Il portafoglio della tesi marca cosa hai già: <b style={{ color: C.p }}>«mega-cap già coperte in parte da VWCE»</b>. Si aggancia a ciò che possiedi.
          </Beat>
        </div>
      </div>
      <style>{`
        @media (max-width: 640px){ .fd-grid{ grid-template-columns: 1fr !important; } .fd-grid > div:first-child{ border-right: none !important; border-bottom: 1px solid ${C.border}55; } }
        .fd-march{ animation: fdMarch 1.2s linear infinite; }
        @keyframes fdMarch{ to { stroke-dashoffset: -6; } }
        @media (prefers-reduced-motion: reduce){ .fd-march{ animation: none; } }
      `}</style>
    </div>
  );
}

// Connettore tratteggiato in stile app (marching ants), appare alla sua battuta
function Conn({ a, b, show, col }: { a: { x: number; y: number }; b: { x: number; y: number }; show: boolean; col: string }) {
  return (
    <line
      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
      stroke={col} strokeWidth={0.5} strokeLinecap="round"
      strokeDasharray="1.4 1.6"
      className={show ? 'fd-march' : undefined}
      style={{ opacity: show ? 0.55 : 0, transition: 'opacity .6s ease' }}
    />
  );
}

// Nodo disegnato come nel prodotto: domanda·cerchio, tesi·esagono, portafoglio·quadrato.
// Lo shape sta in un <svg> quadrato proprio, così non si deforma.
const HEX = '85,30 85,70 50,90 15,70 15,30 50,10'; // esagono pointy-top, come drawHex()
function GNode({ p, show, kind, col, glyph, label, sub, conf }: {
  p: { x: number; y: number }; show: boolean; kind: 'q' | 't' | 'p'; col: string;
  glyph: string; label: string; sub?: string; conf?: number;
}) {
  const size = kind === 'q' ? 50 : kind === 't' ? 68 : 60;
  const fill = kind === 'q' ? '#0e0e12' : kind === 't' ? '#0d0a18' : '#0a1a14';
  const C2 = 2 * Math.PI * 46;
  return (
    <div style={{
      position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
      transform: `translate(-50%, -50%) scale(${show ? 1 : 0.7})`,
      opacity: show ? 1 : 0, transition: 'opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1)',
      pointerEvents: 'none', textAlign: 'center',
    }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
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
        </svg>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: col, fontFamily: mono, fontSize: kind === 'q' ? 15 : 18, fontWeight: 500,
        }}>{glyph}</span>
      </div>
      <div style={{ marginTop: 7, fontFamily: kind === 'q' ? mono : serif, fontSize: kind === 'q' ? 10 : 11.5, lineHeight: 1.3, color: kind === 'q' ? C.muted : '#fff', maxWidth: 140 }}>
        {label}
      </div>
      {sub && <div style={{ marginTop: 3, fontSize: 9.5, color: col, letterSpacing: '.02em' }}>{sub}</div>}
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

const STEPS = [
  {
    g: '●', c: C.q, k: 'domande',
    h: "Parti da un'ipotesi",
    b: "Ogni domanda di analisi è un nodo blu sul grafo. Una società, un tema macro, una view di mercato. Più esplori, più l'architettura visiva si espande.",
  },
  {
    g: '◆', c: C.t, k: 'tesi',
    h: 'Le tesi si strutturano attraverso i dati',
    b: 'Symnaps elimina le ridondanze e raggruppa le informazioni correlate per rilevanza semantica. Il sistema fa germogliare un nodo viola, completo di verdetto, scenari e catalizzatori.',
  },
  {
    g: '▤', c: C.p, k: 'portafogli',
    h: 'Dalle tesi ai portafogli',
    b: 'Quando una tesi diventa solida, germoglia un portafoglio verde: categorie di asset e strumenti, derivati direttamente dalla tesi.',
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

export default function Welcome() {
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: mono, minHeight: '100dvh', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&display=swap');
        a { text-decoration: none; }
        .w-in { animation: wIn .8s cubic-bezier(.22,1,.36,1) both; }
        @keyframes wIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .w-btn { transition: transform .15s, box-shadow .15s, opacity .15s; }
        .w-btn:hover { transform: translateY(-2px); }
        .w-card { transition: border-color .25s, transform .25s, background .25s; }
        .w-card:hover { border-color: ${C.border}; transform: translateY(-3px); background: ${C.cardSolid}; }
        .w-step:hover .w-stepnum { opacity: 1; }
        ::selection { background: ${C.q}33; }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', background: '#08080acc', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.border}55` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={LOGO} alt="Symnaps" style={{ height: 22 }} />
          <span style={{ fontFamily: serif, fontWeight: 300, fontSize: 19, color: '#fff', letterSpacing: '.02em' }}>Symnaps</span>
        </div>
        <a href="/login" className="w-btn" style={{ fontFamily: mono, fontSize: 12, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px' }}>accedi</a>
      </nav>

      {/* ── Hero ── */}
      <header style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 20px 80px' }}>
        <GraphHero />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: `radial-gradient(ellipse 70% 60% at 50% 42%, transparent 28%, ${C.bg}e6 78%)` }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
          <div className="w-in" style={{ fontSize: 11, color: C.faint, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            sistema di pensiero visivo · ricerca finanziaria
          </div>

          <h1 className="w-in" style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(40px, 8vw, 84px)', lineHeight: 1.04, letterSpacing: '-.02em', animationDelay: '.08s' }}>
            <span style={{ display: 'block', color: C.q }}>Questions.</span>
            <span style={{ display: 'block', color: C.t }}>Theses.</span>
            <span style={{ display: 'block', color: C.p }}>Portfolios.</span>
          </h1>

          <p className="w-in" style={{ maxWidth: 560, fontSize: 14.5, lineHeight: 1.7, color: C.muted, animationDelay: '.16s' }}>
            Mappa la tua ricerca finanziaria in un grafo dinamico. Symnaps collega le tue
            ipotesi a macro-scenari e dati ufficiali, organizzando visivamente la tua
            intelligenza.
          </p>

          <div className="w-in" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '.24s' }}>
            <a href="/login" className="w-btn" style={{ background: C.q, color: C.bg, fontFamily: mono, fontWeight: 500, fontSize: 13, borderRadius: 10, padding: '13px 22px', boxShadow: `0 8px 30px ${C.q}40` }}>
              Inizia da una domanda →
            </a>
            <a href="#come" className="w-btn" style={{ color: C.text, fontFamily: mono, fontSize: 13, borderRadius: 10, padding: '13px 22px', border: `1px solid ${C.border}` }}>
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

      {/* ── Anteprima interfaccia (placeholder per micro-video loop del grafo reale) ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 1000, margin: '0 auto', padding: '0 24px', marginTop: -40 }}>
        <Reveal>
          <div style={{ position: 'relative', borderRadius: 18, border: `1px solid ${C.border}`, background: C.cardSolid, overflow: 'hidden', boxShadow: '0 30px 80px #00000080' }}>
            {/* barra finestra */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 14px', borderBottom: `1px solid ${C.border}88`, background: C.card }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e0557755' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f0a03055' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d39955' }} />
              <span style={{ marginLeft: 10, fontSize: 10.5, color: C.muted, letterSpacing: '.04em' }}>symnaps · il tuo grafo</span>
            </div>
            {/* area video — sostituisci il placeholder con <video src=… autoPlay muted loop playsInline /> */}
            <div style={{ position: 'relative', aspectRatio: '16 / 9', background: `radial-gradient(ellipse 60% 70% at 50% 50%, ${C.t}10, transparent 60%), ${C.bg}` }}>
              {/*
                <video
                  src="/demo/graph-loop.mp4"
                  poster="/demo/graph-loop.jpg"
                  autoPlay muted loop playsInline
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 18, background: C.card }}>▶</div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase' }}>anteprima · il grafo in azione</div>
                <div style={{ fontSize: 10.5, color: C.faint }}>video loop dell'interfaccia reale — in arrivo</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Come funziona ── */}
      <section id="come" style={{ position: 'relative', zIndex: 5, maxWidth: 1040, margin: '0 auto', padding: '90px 24px 40px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, color: C.faint, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>come funziona</div>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(26px, 4vw, 38px)', color: '#fff' }}>
              Tre tipi di nodo, <span style={{ fontStyle: 'italic' }}>un</span> flusso.
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.08}>
              <div className="w-card w-step" style={{ background: C.card, border: `1px solid ${C.border}88`, borderRadius: 16, padding: '28px 24px', height: '100%', position: 'relative' }}>
                <span className="w-stepnum" style={{ position: 'absolute', top: 18, right: 20, fontSize: 11, color: C.faint, opacity: 0.5, transition: 'opacity .25s' }}>0{i + 1}</span>
                <div style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.c + '14', border: `1px solid ${s.c}33`, marginBottom: 18 }}>
                  <Glyph ch={s.g} color={s.c} />
                </div>
                <div style={{ fontSize: 10, color: s.c, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>{s.k}</div>
                <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 20, color: '#fff', marginBottom: 12 }}>{s.h}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: C.muted }}>{s.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Demo animata ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 1040, margin: '0 auto', padding: '40px 24px 20px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 11, color: C.faint, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>guardalo lavorare</div>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(24px, 4vw, 34px)', color: '#fff' }}>
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
            <div style={{ fontSize: 11, color: C.faint, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>cosa ti dà</div>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(26px, 4vw, 38px)', color: '#fff' }}>
              Non un editor di note. Un <span style={{ fontStyle: 'italic' }}>sistema visivo</span> che connette i dati.
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.h} delay={(i % 3) * 0.07}>
              <div className="w-card" style={{ background: C.card, border: `1px solid ${C.border}88`, borderRadius: 14, padding: '22px 22px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: f.c + '14', border: `1px solid ${f.c}30`, color: f.c, fontSize: 14 }}>{f.g}</span>
                  <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 17, color: '#fff' }}>{f.h}</h3>
                </div>
                <p style={{ fontSize: 12.5, lineHeight: 1.65, color: C.muted }}>{f.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA finale ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 760, margin: '0 auto', padding: '80px 24px 70px' }}>
        <Reveal>
          <div style={{ position: 'relative', borderRadius: 22, border: `1px solid ${C.border}`, background: `linear-gradient(180deg, ${C.card}, ${C.bg})`, padding: '52px 32px', textAlign: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 60% 80% at 50% 0%, ${C.t}1f, transparent 60%)` }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 'clamp(24px, 4vw, 34px)', color: '#fff', marginBottom: 14, lineHeight: 1.2 }}>
                Inizia da una domanda.<br /><span style={{ fontStyle: 'italic', color: C.muted }}>Al resto pensa la struttura.</span>
              </h2>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 26 }}>Gratis per iniziare. Nessuna carta richiesta.</p>
              <a href="/login" className="w-btn" style={{ display: 'inline-block', background: C.q, color: C.bg, fontFamily: mono, fontWeight: 500, fontSize: 13, borderRadius: 10, padding: '14px 26px', boxShadow: `0 8px 30px ${C.q}40` }}>
                [ crea il tuo grafo → ]
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
