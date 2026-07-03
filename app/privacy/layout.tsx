import type { Metadata } from 'next';

// Layout server del segmento: solo metadata SEO (la page è client).
export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Privacy policy di Symnaps: quali dati raccogliamo, dove vanno e i tuoi diritti GDPR.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
