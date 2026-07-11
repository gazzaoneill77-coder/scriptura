// robots.txt — welcomes traditional crawlers and AI/answer-engine crawlers
// alike, and points them all at the sitemap with an absolute URL. Being
// explicitly open to AI crawlers is part of being citable by them.
import { href, absolute } from '../lib/url.js';

export function GET({ site }) {
  const sitemap = absolute(href('/sitemap.xml'), site);
  const body = `# Dwellwise — open to search and AI crawlers.
User-agent: *
Allow: /

Sitemap: ${sitemap}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
