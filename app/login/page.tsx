'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleAuth() {
    setLoading(true);
    setMsg('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account creato! Controlla la mail per confermare, poi accedi.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 20 }}>
      <style>{`
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-text-fill-color: #dddde8 !important;
          -webkit-box-shadow: 0 0 0 1000px #141418 inset !important;
          caret-color: #dddde8;
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAeCAYAAADHJYVoAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAACMklEQVR42rWWPWtUURCGn7m7iVmNScRSjVXwAwSxEg2oRbATa7ERCxv9CWpvYWFasRexsBCtFDXYCIKgFkaIYPADQVMpxuw+Fs6VmxB3k911YNh7zt7zzpy573nPQJoaao0uTd2g3ld/qnfU4SiBI8J83gYcA/YDg0B0wC2AFrALmAKaQA24XC+B1QZwBTifi5q5qJMFIDCQ46UEn0At1GF1xj92Td2nblKHcrvtvJHvHVS/JsYX9UBZr1s5eZQeTB1XT6jby4mpBD6X48HcTazTixWBCtQH6vucqKnRQ+ZFYhTlxKJ6PZ/r9NGK/Mrv+A9W1qnRSznagX8EJvMQ2Vd09WKyZSLHA/3CDnUzMAvMAYcjopUas94ytSKitVr2RzL7GXVPD1VYRuVQaxHRVI8DN4FR4CnwInXin1j5+x14DTyMiPmVQkgptepW9ZL6Sv2h/kpfauNVm1aHywDLtrSKPjc6+EZ1VN2vXs0AzzPJWFmzUOvdcl6dVFvqvU4vrku01MFcdyp3cDL6eF4CqEXEkjoLLPT7QNZzJ9Nqq+i3niQFP1WFiz6XZwSIqEwUeYTtpSxZ82fAGKtcT9FNthW2HEq2XCj/3JIcHatcV2umYiXIDvWD+lIdQt2rzmW0WXW8i8xH1NPqQrYXu0vhugGcARazw/oGfK40O+2aIfKa3JmN0AxwNiLeqEU9garMeQvMrwH8r44Dt4G7EfGoLGtEtEolfKw21SelqnVLwypBfgNA68VUmj2DLAAAAABJRU5ErkJggg==" alt="Symnaps" style={{ height: 30, width: 'auto' }} />
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 300, color: '#fff' }}>Symnaps</span>
      </div>

      <div style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 18, padding: 28, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email" placeholder="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ background: '#141418', border: '1px solid #2a2a36', borderRadius: 10, padding: '11px 14px', color: '#dddde8', fontFamily: 'DM Mono', fontSize: 13, outline: 'none' }}
        />
        <input
          type="password" placeholder="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          style={{ background: '#141418', border: '1px solid #2a2a36', borderRadius: 10, padding: '11px 14px', color: '#dddde8', fontFamily: 'DM Mono', fontSize: 13, outline: 'none' }}
        />
        <button
          onClick={handleAuth} disabled={loading}
          style={{ background: '#5b9cf6', color: '#08080a', border: 'none', borderRadius: 10, padding: '11px', fontFamily: 'DM Mono', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? '...' : mode === 'login' ? 'accedi' : 'crea account'}
        </button>
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{ background: 'none', border: 'none', color: '#7a7a95', fontFamily: 'DM Mono', fontSize: 11, cursor: 'pointer' }}
        >
          {mode === 'login' ? 'non hai un account? registrati' : 'hai già un account? accedi'}
        </button>
        {msg && <div style={{ fontSize: 11, color: '#f0a030', lineHeight: 1.5 }}>{msg}</div>}
      </div>
    </div>
  );
}
