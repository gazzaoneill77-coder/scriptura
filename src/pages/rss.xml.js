// RSS 2.0 feed of the latest articles. A feed is a small, durable trust and
// distribution signal — and an easy way for readers and aggregators to follow.
import { site } from '../data/site.js';
import { articles } from '../lib/content.js';
import { href, absolute } from '../lib/url.js';

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function GET({ site: origin }) {
  const home = absolute(href('/'), origin);
  const self = absolute(href('/rss.xml'), origin);

  const items = articles
    .slice(0, 50)
    .map((a) => {
      const link = absolute(a.url, origin);
      const date = new Date(a.updatedDate || a.publishDate || Date.now()).toUTCString();
      return (
        `    <item>\n` +
        `      <title>${esc(a.title)}</title>\n` +
        `      <link>${link}</link>\n` +
        `      <guid isPermaLink="true">${link}</guid>\n` +
        `      <pubDate>${date}</pubDate>\n` +
        `      <description>${esc(a.summary || a.description || '')}</description>\n` +
        `    </item>`
      );
    })
    .join('\n');

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n` +
    `  <channel>\n` +
    `    <title>${esc(site.brand)}</title>\n` +
    `    <link>${home}</link>\n` +
    `    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${self}" rel="self" type="application/rss+xml" />\n` +
    `    <description>${esc(site.description)}</description>\n` +
    `    <language>en-gb</language>\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
