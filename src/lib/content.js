// Loads every article from src/content/articles and normalises it into a single
// shape the pages and layouts consume. Articles are plain Markdown with rich
// frontmatter — the frontmatter drives all the structured/answer-engine
// elements (summaries, key takeaways, comparison tables, FAQs, schema), while
// the Markdown body carries the prose. One place to change how content loads.

import { href, withSlash } from './url.js';

// Eagerly import all article Markdown. Each module exposes `frontmatter` and a
// `Content` component we render in the article layout.
const modules = import.meta.glob('../content/articles/*.md', { eager: true });

const isProd = import.meta.env.PROD;

function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '');
}

const all = Object.entries(modules)
  .map(([path, mod]) => {
    const fm = mod.frontmatter || {};
    const slug = fm.slug || slugFromPath(path);
    return {
      ...fm,
      slug,
      Content: mod.Content,
      headings: mod.getHeadings ? mod.getHeadings() : [],
      url: withSlash(href(`/${fm.category}/${slug}`))
    };
  })
  // Drafts never ship in a production build; they stay visible in dev.
  .filter((a) => !(isProd && a.draft))
  // Newest updates first.
  .sort(
    (a, b) =>
      new Date(b.updatedDate || b.publishDate || 0) -
      new Date(a.updatedDate || a.publishDate || 0)
  );

export const articles = all;

export const getArticlesByCategory = (category) =>
  all.filter((a) => a.category === category);

export const getArticleBySlug = (slug) => all.find((a) => a.slug === slug);

// Article "type" groupings used by the top-level /reviews and /guides hubs.
const REVIEW_TYPES = ['review', 'roundup', 'comparison'];
const GUIDE_TYPES = ['guide', 'how-to'];

export const getReviews = () => all.filter((a) => REVIEW_TYPES.includes(a.type));
export const getGuides = () => all.filter((a) => GUIDE_TYPES.includes(a.type));

// Related articles: same category first, then anything else, excluding self.
export function getRelated(article, limit = 3) {
  const sameCat = all.filter(
    (a) => a.category === article.category && a.slug !== article.slug
  );
  const rest = all.filter(
    (a) => a.category !== article.category && a.slug !== article.slug
  );
  return [...sameCat, ...rest].slice(0, limit);
}

export default articles;
