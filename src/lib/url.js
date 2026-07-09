// Prefix root-relative paths with the configured base so the site works both
// at a domain root and under a subpath (GitHub Pages project sites).
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const href = (path) => `${BASE}${path}` || '/';
