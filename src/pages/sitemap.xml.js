// XML sitemap built from real routes. Absolute URLs are derived from the
// configured site, so it is correct at a domain root and under the Pages
// subpath alike.
import { categories } from '../data/categories.js';
import { articles } from '../lib/content.js';
import { href, absolute, withSlash } from '../lib/url.js';
import { isoDate } from '../lib/format.js';

export function GET({ site }) {
  const staticPaths = ['/', '/reviews', '/guides', '/about', '/how-we-test', '/disclosure'];
  const catPaths = categories.map((c) => `/${c.slug}`);

  const urls = [
    ...staticPaths.map((p) => ({ loc: absolute(withSlash(href(p)), site) })),
    ...catPaths.map((p) => ({ loc: absolute(withSlash(href(p)), site) })),
    ...articles.map((a) => ({
      loc: absolute(a.url, site),
      lastmod: isoDate(a.updatedDate || a.publishDate)
    }))
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
