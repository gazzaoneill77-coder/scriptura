// Dynamic sitemap — pre-rendered to /sitemap.xml at build. Uses the configured
// `site` (origin + Pages base) so URLs are correct on every host.
import products from '../data/products.json';

const ROUTES = ['/', '/shop', '/arcade', '/the-road', '/faq', '/gate', '/cart'];

export function GET({ site }) {
  const base = (site?.href || 'https://narrow.example/').replace(/\/$/, '');
  const urls = [
    ...ROUTES,
    ...products.products.map((p) => `/products/${p.slug}`)
  ].map((path) => `${base}${path === '/' ? '/' : path + '/'}`);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
