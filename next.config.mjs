/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // /synapse non è mai stata una route (il grafo vive su /): redirect per i
  // link vecchi ancora in giro (visto traffico 404 in analytics).
  async redirects() {
    return [{ source: '/synapse', destination: '/', permanent: true }];
  },
};
export default nextConfig;
