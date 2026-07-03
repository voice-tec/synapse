import type { Metadata } from 'next';

// Pagina personale (le mie pubblicazioni): fuori dall'indice.
export const metadata: Metadata = {
  title: 'Le mie pubblicazioni',
  robots: { index: false },
};

export default function MineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
