import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Symnaps',
  description: 'Questions. Theses. Portfolios. — visual thinking system for financial research',
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
      <body>{children}</body>
    </html>
  );
}
