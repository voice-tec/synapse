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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="28" height="36" viewBox="0 0 22 28" fill="none">
          <path d="M17 6.5C17 4.5 15 3 11 3C7 3 5 4.8 5 7C5 9.2 7.5 10.2 11 11C14.5 11.8 17 13 17 15.5C17 18 14.5 19.5 11 19.5C7.5 19.5 5 18 5 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17" cy="6.5" r="2.2" fill="white" />
          <circle cx="5" cy="16" r="2.2" fill="white" />
        </svg>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 300 }}>Synapse</span>
      </div>

      <div style={{ background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 18, padding: 28, width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
