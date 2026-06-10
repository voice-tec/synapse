'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// Sfondo: mini-grafo che deriva lentamente — un assaggio del prodotto.
// Nodi nei tre colori dell'app (task blu, tesi viola, portafogli verdi),
// archi che appaiono solo tra nodi vicini.
function GraphBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#5b9cf6', '#5b9cf6', '#5b9cf6', '#a78bfa', '#34d399'];
    const N = Math.min(34, Math.floor(window.innerWidth / 38));
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 1.5 + Math.random() * 2.2,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      ph: Math.random() * Math.PI * 2,
    }));

    const loop = () => {
      const W = window.innerWidth, H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
      }

      // Archi tra nodi vicini, alpha decrescente con la distanza
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 150) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = '#5b9cf6';
            ctx.globalAlpha = (1 - d / 150) * 0.13;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      for (const n of nodes) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.4 + n.ph);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.c;
        ctx.globalAlpha = 0.25 + 0.3 * pulse;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

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
