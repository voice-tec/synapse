import type { Metadata } from 'next';

// Layout server del segmento: solo metadata SEO (la page è client).
export const metadata: Metadata = {
  title: 'Prezzi',
  description:
    'Symnaps Free: 10 analisi al mese, grafo e marketplace completi. Pro in arrivo a €9.90/mese con 150 analisi. Nessuna carta richiesta.',
  alternates: { canonical: '/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
