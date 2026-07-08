import type { Metadata } from 'next';

// Layout server del segmento /market (vale anche per /market/mine e
// /market/a/[ref]). Niente canonical qui: si erediterebbe sulle sottopagine.
export const metadata: Metadata = {
  title: 'Marketplace di tesi',
  description:
    'Tesi di investimento pubbliche con track record misurato su dati reali: evolvile nel tuo grafo e giudica gli autori dalla loro accuratezza.',
};

// Motion condiviso delle pagine market: hover discreti, fade scaglionato,
// marquee della strip attività, shimmer di caricamento. Un solo posto, classi
// mk-*; prefers-reduced-motion spegne tutto.
const MK_CSS = `
.mk-card{transition:transform .15s cubic-bezier(.2,.6,.2,1),border-color .15s ease}
.mk-card:hover{transform:translateY(-2px);border-color:#a78bfa66!important}
@keyframes mkFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.mk-fade{opacity:0;animation:mkFadeUp .4s cubic-bezier(.2,.6,.2,1) forwards}
@keyframes mkMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.mk-tape{display:flex;gap:28px;width:max-content;animation:mkMarquee 40s linear infinite}
.mk-tape:hover{animation-play-state:paused}
@keyframes mkShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
.mk-skel{border-radius:14px;background:linear-gradient(90deg,#0e0e12 25%,#16161e 50%,#0e0e12 75%);background-size:200% 100%;animation:mkShimmer 1.4s linear infinite}
@media (prefers-reduced-motion: reduce){
  .mk-card,.mk-card:hover{transition:none;transform:none}
  .mk-fade{animation:none;opacity:1}
  .mk-tape{animation:none}
  .mk-skel{animation:none}
}`;

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MK_CSS }} />
      {children}
    </>
  );
}
