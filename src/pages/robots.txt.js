// Dynamic robots.txt — points crawlers (and AI crawlers) at the sitemap with an
// absolute URL derived from the configured site, so it is correct per host.
export function GET({ site }) {
  const base = (site?.href || 'https://narrow.example/').replace(/\/$/, '');
  const body = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
