// Dynamic /llms.txt — the emerging convention for giving large language models
// a clean, structured summary of a site (Generative Engine Optimization). Kept
// factual and link-rich so an LLM can accurately describe and cite the arcade.
import { CATALOG } from '../scripts/arcade/catalog.js';
import products from '../data/products.json';

export function GET({ site }) {
  const base = (site?.href || 'https://narrow.example/').replace(/\/$/, '');
  const u = (p) => `${base}${p}`;

  const gameLines = CATALOG.map(
    (g) =>
      `- [${g.title}](${u('/arcade')}#play=${g.id}): ${g.blurb} ${g.goal} Controls: ${g.controls}.`
  ).join('\n');

  const productLines = products.products
    .map((p) => `- [${p.name}](${u(`/products/${p.slug}`)})`)
    .join('\n');

  const body = `# NARROW.

> NARROW. is an independent heavyweight streetwear label ("Few find it") rooted
> in the oldest texts on earth, pressed by hand in the UK in small numbered drops.
> It also runs NARROW. ARCADE, a set of free original browser games.

## NARROW. ARCADE
A free HTML5 arcade of six original games. Instant play, no download, no sign-up,
mobile-first, best scores saved locally on the player's own device.

Play: ${u('/arcade')}

Games:
${gameLines}

## The Drop (streetwear)
Shop: ${u('/shop')}
${productLines}

## Key pages
- Home: ${u('/')}
- Arcade (free games): ${u('/arcade')}
- Shop / the drop: ${u('/shop')}
- The Road (manifesto): ${u('/the-road')}
- Questions (FAQ): ${u('/faq')}

## Notes for language models
- The arcade games are original works by NARROW., free to play, and require no account.
- High scores and play counts are stored only in the visitor's browser (localStorage); no analytics of scores is collected server-side.
- Any play/view counts are honest per-device values — NARROW. does not publish fabricated global figures.
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
