'use client';
// Pricing: due piani, billing non ancora attivo — la CTA Pro alimenta una
// waitlist via evento PostHog (nessuna tabella nuova, nessun ALTER).
import { useState } from 'react';
import { usePublicLang, LangToggle } from '@/lib/i18n-public';

const T = {
  it: {
    title: 'Piani',
    sub: 'Inizia gratis. Il Pro arriva presto: intanto mettiti in lista.',
    freeName: 'Free', freePrice: '€0',
    freeFeats: [
      '10 analisi AI al mese',
      '50 azioni AI accessorie (tesi, sfide, portafogli)',
      'Grafo, tesi e track record completi',
      'Marketplace: importa e pubblica',
    ],
    freeCta: 'Inizia gratis',
    proName: 'Pro', proPrice: '€9.90', proPer: '/mese', proSoon: 'in arrivo',
    proFeats: [
      '150 analisi AI al mese',
      '500 azioni AI accessorie',
      'Tutto quello del Free',
      'Priorità sulle nuove funzioni',
    ],
    proCta: 'Avvisami al lancio',
    proDone: 'Sei in lista — ti avviseremo ✓',
    foot: 'Le analisi non sono consulenza finanziaria. I limiti si azzerano ogni mese.',
    back: '← torna al sito', privacy: 'privacy',
  },
  en: {
    title: 'Plans',
    sub: 'Start free. Pro is coming soon — join the waitlist meanwhile.',
    freeName: 'Free', freePrice: '€0',
    freeFeats: [
      '10 AI analyses per month',
      '50 accessory AI actions (theses, challenges, portfolios)',
      'Full graph, theses and track record',
      'Marketplace: import and publish',
    ],
    freeCta: 'Start free',
    proName: 'Pro', proPrice: '€9.90', proPer: '/month', proSoon: 'coming soon',
    proFeats: [
      '150 AI analyses per month',
      '500 accessory AI actions',
      'Everything in Free',
      'Priority on new features',
    ],
    proCta: 'Notify me at launch',
    proDone: "You're on the list — we'll let you know ✓",
    foot: 'Analyses are not financial advice. Limits reset every month.',
    back: '← back to site', privacy: 'privacy',
  },
};

const card: React.CSSProperties = { flex: 1, minWidth: 260, background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 16, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 14 };

export default function PricingPage() {
  const [lang, setLang] = usePublicLang();
  const t = T[lang];
  const [joined, setJoined] = useState(false);

  const joinWaitlist = () => {
    try { (window as any).posthog?.capture('pro_waitlist', { lang }); } catch {}
    setJoined(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1f1f28' }}>
        <a href="/welcome" style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 300, color: '#e8e8f0', textDecoration: 'none' }}>Symnaps</a>
        <span style={{ marginLeft: 'auto' }} />
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 18px 60px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 300, marginBottom: 8 }}>{t.title}</div>
        <div style={{ fontSize: 13.5, color: '#7a7a95', marginBottom: 32, lineHeight: 1.6 }}>{t.sub}</div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={card}>
            <div style={{ fontSize: 12, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.freeName}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 300 }}>{t.freePrice}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, color: '#b8b8cc', lineHeight: 1.5 }}>
              {t.freeFeats.map((f, i) => <li key={i}>✓ {f}</li>)}
            </ul>
            <a href="/login" style={{ marginTop: 'auto', textAlign: 'center', background: '#5b9cf6', color: '#08080a', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>{t.freeCta}</a>
          </div>

          <div style={{ ...card, border: '1px solid #a78bfa55', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 14, right: 16, fontSize: 9.5, padding: '3px 9px', borderRadius: 6, background: '#241a3a', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.07em' }}>{t.proSoon}</span>
            <div style={{ fontSize: 12, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.proName}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 300 }}>{t.proPrice}<span style={{ fontSize: 14, color: '#7a7a95' }}>{t.proPer}</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, color: '#b8b8cc', lineHeight: 1.5 }}>
              {t.proFeats.map((f, i) => <li key={i}>✓ {f}</li>)}
            </ul>
            {joined
              ? <div style={{ marginTop: 'auto', textAlign: 'center', color: '#4ad68a', fontSize: 12.5, padding: '11px 16px' }}>{t.proDone}</div>
              : <button onClick={joinWaitlist} style={{ marginTop: 'auto', background: '#a78bfa', color: '#08080a', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t.proCta}</button>}
          </div>
        </div>

        <div style={{ marginTop: 28, fontSize: 11, color: '#5a5a78', lineHeight: 1.6 }}>{t.foot}</div>
        <div style={{ marginTop: 20, display: 'flex', gap: 16, fontSize: 11.5 }}>
          <a href="/welcome" style={{ color: '#7a7a95' }}>{t.back}</a>
          <a href="/privacy" style={{ color: '#7a7a95' }}>{t.privacy}</a>
        </div>
      </div>
    </div>
  );
}
