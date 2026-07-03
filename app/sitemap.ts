import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://symnaps.com';
  return [
    { url: `${base}/welcome`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/market`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
