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
        <svg width="26" height="32" viewBox="0 0 24 30" fill="none">
          <path d="M18 8C18 5.2 15.4 3.5 12 3.5C8.6 3.5 6 5.2 6 8C6 10.8 8.6 12 12 13C15.4 14 18 15.4 18 18.2C18 21 15.4 22.5 12 22.5C8.6 22.5 6 20.8 6 18.2" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="18" cy="8" r="2.6" fill="white" />
          <circle cx="6" cy="18.2" r="2.6" fill="white" />
        </svg>
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
