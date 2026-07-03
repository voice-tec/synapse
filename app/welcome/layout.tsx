import type { Metadata } from 'next';

// Layout server del segmento: esiste solo per i metadata SEO (la page è client
// e non può esportarli). Descrizioni in italiano, lingua primaria del sito.
export const metadata: Metadata = {
  title: { absolute: 'Symnaps — il grafo per la tua ricerca finanziaria' },
  description:
    'Mappa la tua ricerca finanziaria in un grafo: le domande diventano nodi, le tesi hanno confidenza e track record misurati su dati ufficiali (FRED, Twelve Data, FMP).',
  alternates: { canonical: '/welcome' },
};

const JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Symnaps',
      url: 'https://symnaps.com',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Symnaps',
      url: 'https://symnaps.com',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description:
        'Sistema di pensiero visivo per la ricerca finanziaria: domande, tesi con track record su dati reali, portafogli e marketplace di tesi.',
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'EUR' },
        { '@type': 'Offer', name: 'Pro', price: '9.90', priceCurrency: 'EUR' },
      ],
    },
  ],
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
      {children}
    </>
  );
}
