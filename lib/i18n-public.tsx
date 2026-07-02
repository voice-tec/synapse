'use client';
// i18n leggero per le SOLE superfici pubbliche (/welcome, /pricing, /privacy):
// dizionario per pagina, lingua da localStorage o dal browser, toggle IT/EN.
// L'app interna e l'output AI restano in italiano (fase 2 post-beta).
import { useEffect, useState } from 'react';

export type Lang = 'it' | 'en';
const KEY = 'syn-lang';

export function usePublicLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>('it');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'it' || saved === 'en') { setLangState(saved); return; }
      if (!String(navigator.language || 'it').toLowerCase().startsWith('it')) setLangState('en');
    } catch {}
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  };
  return [lang, setLang];
}

export function LangToggle({ lang, setLang, style }: { lang: Lang; setLang: (l: Lang) => void; style?: React.CSSProperties }) {
  const btn = (l: Lang): React.CSSProperties => ({
    background: lang === l ? '#241a3a' : 'transparent',
    color: lang === l ? '#a78bfa' : '#7a7a95',
    border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer',
  });
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 8, padding: 2, ...style }}>
      <button onClick={() => setLang('it')} style={btn('it')}>IT</button>
      <button onClick={() => setLang('en')} style={btn('en')}>EN</button>
    </div>
  );
}
