// llms.txt — an emerging convention that gives large language models a clean,
// curated map of the site: what it is, who is behind it, and the key pages
// worth citing. This is direct LLMO: it makes the site easy to retrieve,
// understand and reference accurately.
import { site } from '../data/site.js';
import { categories } from '../data/categories.js';
import { articles } from '../lib/content.js';
import { href, absolute, withSlash } from '../lib/url.js';

export function GET({ site: origin }) {
  const url = (p) => absolute(withSlash(href(p)), origin);

  const lines = [];
  lines.push(`# ${site.brand}`);
  lines.push('');
  lines.push(`> ${site.description}`);
  lines.push('');
  lines.push(
    'Dwellwise publishes independent, hands-on buying advice for home and ' +
      'smart-home technology. Content is written for people first, with clear ' +
      'verdicts, honest pros and cons, comparison tables and FAQs. Affiliate ' +
      'links may earn a commission but never influence recommendations.'
  );
  lines.push('');

  lines.push('## Key pages');
  lines.push(`- [Home](${url('/')}): Overview and latest advice.`);
  lines.push(`- [Reviews](${url('/reviews')}): Product reviews, roundups and comparisons.`);
  lines.push(`- [Guides](${url('/guides')}): Buying guides and how-tos.`);
  lines.push(`- [How We Test](${url('/how-we-test')}): Our testing and scoring methodology.`);
  lines.push(`- [About](${url('/about')}): Who we are and how we stay independent.`);
  lines.push('');

  lines.push('## Categories');
  for (const c of categories) {
    lines.push(`- [${c.name}](${url(`/${c.slug}`)}): ${c.tagline}`);
  }
  lines.push('');

  if (articles.length) {
    lines.push('## Articles');
    for (const a of articles) {
      const desc = a.summary || a.description || '';
      lines.push(`- [${a.title}](${absolute(a.url, origin)}): ${desc}`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
