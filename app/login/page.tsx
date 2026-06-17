'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// Sfondo: lo stesso flusso che racconta la landing, in sottofondo.
// Non rumore casuale: domande blu a sinistra → tesi viola al centro →
// portafogli verdi a destra, con impulsi che scorrono lungo i legami.
function GraphBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const Q = '#5b9cf6', T = '#a78bfa', P = '#34d399';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    type Node = { x: number; y: number; vx: number; vy: number; r: number; c: string; ph: number; type: 0 | 1 | 2 };
    type Edge = { a: number; b: number; c: string; pulse: number; speed: number };

    const zone = (type: 0 | 1 | 2) => {
      const band = type === 0 ? 0.2 : type === 1 ? 0.5 : 0.8;
      return W * (band + (Math.random() - 0.5) * 0.16);
    };
    const make = (type: 0 | 1 | 2): Node => ({
      x: zone(type), y: H * (0.1 + Math.random() * 0.8),
      vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1,
      r: (type === 0 ? 1.6 : type === 1 ? 2.6 : 3) + Math.random() * 1.2,
      c: type === 0 ? Q : type === 1 ? T : P,
      ph: Math.random() * Math.PI * 2, type,
    });

    const dense = W > 720;
    const nodes: Node[] = [
      ...Array.from({ length: dense ? 16 : 9 }, () => make(0)),
      ...Array.from({ length: dense ? 7 : 4 }, () => make(1)),
      ...Array.from({ length: dense ? 4 : 3 }, () => make(2)),
    ];
    const byType = (ty: 0 | 1 | 2) => nodes.map((n, i) => (n.type === ty ? i : -1)).filter((i) => i >= 0);
    const idxQ = byType(0), idxT = byType(1), idxP = byType(2);
    const nearest = (from: number, pool: number[], k: number) =>
      pool.map((j) => ({ j, d: Math.hypot(nodes[from].x - nodes[j].x, nodes[from].y - nodes[j].y) }))
        .sort((a, b) => a.d - b.d).slice(0, k).map((o) => o.j);

    const edges: Edge[] = [];
    for (const t of idxT)
      for (const q of nearest(t, idxQ, 2 + Math.floor(Math.random() * 2)))
        edges.push({ a: q, b: t, c: T, pulse: Math.random(), speed: 0.003 + Math.random() * 0.004 });
    for (const p of idxP)
      for (const t of nearest(p, idxT, 1 + Math.floor(Math.random() * 2)))
        edges.push({ a: t, b: p, c: P, pulse: Math.random(), speed: 0.0025 + Math.random() * 0.003 });

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;

      if (!reduced)
        for (const n of nodes) {
          n.x += n.vx; n.y += n.vy;
          const home = n.type === 0 ? 0.2 : n.type === 1 ? 0.5 : 0.8;
          n.vx += (W * home - n.x) * 0.000004;
          if (n.y < H * 0.06 || n.y > H * 0.94) n.vy *= -1;
        }

      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, a.c + '00');
        grad.addColorStop(1, e.c + '33');
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.stroke();

        if (!reduced) {
          e.pulse += e.speed; if (e.pulse > 1) e.pulse -= 1;
          const px = a.x + (b.x - a.x) * e.pulse, py = a.y + (b.y - a.y) * e.pulse;
          ctx.beginPath();
          ctx.arc(px, py, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = e.c; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
        }
      }

      for (const n of nodes) {
        const pulse = reduced ? 0.6 : 0.55 + 0.45 * Math.sin(t * 1.3 + n.ph);
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
        glow.addColorStop(0, n.c + '33'); glow.addColorStop(1, n.c + '00');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.4 * pulse; ctx.fill(); ctx.globalAlpha = 1;

        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.c; ctx.globalAlpha = 0.4 + 0.35 * pulse; ctx.fill(); ctx.globalAlpha = 1;
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleAuth() {
    setLoading(true);
    setMsg('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Email confirmation is OFF in Supabase, so the account is active
        // immediately. Sign in right away and go to the app — no "check your
        // email" step needed.
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        // Full reload, NON navigazione SPA: lo script del grafo inietta stato
        // globale (TASKS, NODES, __SYN_INITIALIZED) che deve morire col cambio utente
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#141418', border: '1px solid #2a2a36', borderRadius: 10,
    padding: '12px 14px', color: '#dddde8', fontFamily: "'DM Mono', monospace",
    fontSize: 13, outline: 'none', transition: 'border-color .2s, box-shadow .2s',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#08080a', position: 'relative', overflow: 'hidden', fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&display=swap');
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-text-fill-color: #dddde8 !important;
          -webkit-box-shadow: 0 0 0 1000px #141418 inset !important;
          caret-color: #dddde8;
        }
        input::placeholder { color: #3a3a50; }
        input:focus { border-color: #5b9cf6 !important; box-shadow: 0 0 0 3px #5b9cf61a; }
        @keyframes lgIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .lg-in { animation: lgIn .6s cubic-bezier(.22,1,.36,1) both; }
        .lg-btn { transition: opacity .15s, transform .15s; }
        .lg-btn:hover { opacity: .88; transform: translateY(-1px); }
        .lg-btn:active { transform: translateY(0); }
      `}</style>

      <GraphBackdrop />

      {/* Vignettatura: lascia respirare il centro, scurisce i bordi */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 55% at 50% 45%, transparent 30%, #08080acc 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 20 }}>

        <div className="lg-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animationDelay: '.05s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAeCAYAAADHJYVoAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAACMklEQVR42rWWPWtUURCGn7m7iVmNScRSjVXwAwSxEg2oRbATa7ERCxv9CWpvYWFasRexsBCtFDXYCIKgFkaIYPADQVMpxuw+Fs6VmxB3k911YNh7zt7zzpy573nPQJoaao0uTd2g3ld/qnfU4SiBI8J83gYcA/YDg0B0wC2AFrALmAKaQA24XC+B1QZwBTifi5q5qJMFIDCQ46UEn0At1GF1xj92Td2nblKHcrvtvJHvHVS/JsYX9UBZr1s5eZQeTB1XT6jby4mpBD6X48HcTazTixWBCtQH6vucqKnRQ+ZFYhTlxKJ6PZ/r9NGK/Mrv+A9W1qnRSznagX8EJvMQ2Vd09WKyZSLHA/3CDnUzMAvMAYcjopUas94ytSKitVr2RzL7GXVPD1VYRuVQaxHRVI8DN4FR4CnwInXin1j5+x14DTyMiPmVQkgptepW9ZL6Sv2h/kpfauNVm1aHywDLtrSKPjc6+EZ1VN2vXs0AzzPJWFmzUOvdcl6dVFvqvU4vrku01MFcdyp3cDL6eF4CqEXEkjoLLPT7QNZzJ9Nqq+i3niQFP1WFiz6XZwSIqEwUeYTtpSxZ82fAGKtcT9FNthW2HEq2XCj/3JIcHatcV2umYiXIDvWD+lIdQt2rzmW0WXW8i8xH1NPqQrYXu0vhugGcARazw/oGfK40O+2aIfKa3JmN0AxwNiLeqEU9garMeQvMrwH8r44Dt4G7EfGoLGtEtEolfKw21SelqnVLwypBfgNA68VUmj2DLAAAAABJRU5ErkJggg==" alt="Symnaps" style={{ height: 32, width: 'auto' }} />
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 300, color: '#fff', letterSpacing: '.02em' }}>Symnaps</span>
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 300, fontSize: 15, color: '#7a7a95', textAlign: 'center', lineHeight: 1.5 }}>
            Le tue domande diventano un grafo.<br />Le tesi emergono da sole.
          </div>
        </div>

        <div className="lg-in" style={{ background: '#0e0e12d9', backdropFilter: 'blur(10px)', border: '1px solid #2a2a36', borderRadius: 18, padding: 28, width: '100%', maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '.18s', boxShadow: '0 20px 60px #00000066' }}>
          <div style={{ fontSize: 10, color: '#3a3a50', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
            {mode === 'login' ? 'bentornato' : 'inizia da una domanda'}
          </div>
          <input
            type="email" placeholder="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            style={inputStyle}
          />
          <button
            className="lg-btn"
            onClick={handleAuth} disabled={loading}
            style={{ background: '#5b9cf6', color: '#08080a', border: 'none', borderRadius: 10, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? '...' : mode === 'login' ? 'accedi →' : 'crea account →'}
          </button>
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ background: 'none', border: 'none', color: '#7a7a95', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', padding: 4 }}
          >
            {mode === 'login' ? 'non hai un account? registrati' : 'hai già un account? accedi'}
          </button>
          {msg && <div style={{ fontSize: 11, color: '#f0a030', lineHeight: 1.5 }}>{msg}</div>}
        </div>

        <div className="lg-in" style={{ display: 'flex', gap: 18, fontSize: 10, color: '#3a3a50', letterSpacing: '.04em', animationDelay: '.32s', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>● ogni domanda è un nodo</span>
          <span style={{ color: '#a78bfa66' }}>◆ le tesi si aggiornano da sole</span>
          <span style={{ color: '#34d39966' }}>▤ dalle tesi ai portafogli</span>
        </div>

      </div>
    </div>
  );
}
