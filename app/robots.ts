import type { MetadataRoute } from 'next';

// Indicizzabili: superfici pubbliche. Escluse: API e snapshot condivisi /g/
// (link privati per scelta di chi condivide, non contenuto da motore di ricerca).
// La home "/" non serve escluderla: da anonimi redirige a /welcome (middleware).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/g/'] }],
    sitemap: 'https://symnaps.com/sitemap.xml',
  };
}
