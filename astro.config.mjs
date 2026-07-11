import { defineConfig } from 'astro/config';

// BASE_PATH/SITE_URL come from the deploy workflow (GitHub Pages serves the
// site under /<repo>). Local dev and root-domain hosts leave both unset.
const base = process.env.BASE_PATH || '/';
const site = process.env.SITE_URL
  ? `${process.env.SITE_URL}${process.env.BASE_PATH ?? ''}`
  : 'https://www.dwellwise.com';

export default defineConfig({
  output: 'static',
  site,
  base
});
