import type { Metadata } from 'next';

// Layout server del segmento /market (vale anche per /market/mine e
// /market/a/[ref]). Niente canonical qui: si erediterebbe sulle sottopagine.
export const metadata: Metadata = {
  title: 'Marketplace di tesi',
  description:
    'Tesi di investimento pubbliche con track record misurato su dati reali: importale nel tuo grafo e giudica gli autori dalla loro accuratezza.',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
