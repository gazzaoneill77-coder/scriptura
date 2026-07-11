// Prefix root-relative paths with the configured base so the site works both
// at a domain root and under a subpath (GitHub Pages project sites).
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const href = (path) => `${BASE}${path}` || '/';

// Ensure a directory-style path ends with a trailing slash, to match the
// canonical URLs Astro emits (build format: directory). Used so sitemap, RSS
// and llms.txt list exactly the same URLs the pages declare as canonical.
export const withSlash = (p) => (p.endsWith('/') ? p : `${p}/`);

// Build an absolute URL from a (already base-prefixed) path and the configured
// site. Used for canonical tags, Open Graph, sitemaps and JSON-LD, where
// engines and LLMs need fully-qualified URLs. `new URL` takes only the origin
// from `site`, so this stays correct whether the site is at a domain root or a
// project subpath.
export const absolute = (path, site) =>
  site ? new URL(path, site).href : path;
