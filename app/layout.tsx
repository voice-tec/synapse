import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://symnaps.com'),
  title: { default: 'Symnaps', template: '%s — Symnaps' },
  description: 'Domande, tesi, portafogli: il grafo visivo che trasforma le tue domande di finanza in convinzioni con un track record misurato su dati reali.',
  openGraph: {
    title: 'Symnaps — financial intelligence a grafo',
    description: 'Fai una domanda di finanza: diventa un nodo. Le domande si collegano, emergono tesi con confidenza e track record su dati reali.',
    url: 'https://symnaps.com',
    siteName: 'Symnaps',
    locale: 'it_IT',
    type: 'website',
    // L'immagine OG è generata a runtime da app/opengraph-image.tsx
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Prevent the browser's own pinch-zoom so our graph can handle pinch itself
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* PostHog analytics — pageviews, session replay, and custom events.
            Loaded inline so it works without an extra npm dependency. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture identify reset register register_once unregister getFeatureFlag isFeatureEnabled onFeatureFlags reloadFeatureFlags group get_distinct_id startSessionRecording stopSessionRecording captureException".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_qK6LDiYy3pdeNvh983GoJqrGyVQiQMNHEdEWawUBo9iu',{api_host:'https://eu.i.posthog.com',person_profiles:'identified_only'});`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
