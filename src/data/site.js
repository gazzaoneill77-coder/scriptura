// Central site configuration. Everything brand-, nav-, and trust-related reads
// from here so the whole site stays consistent and is trivial to re-skin.

export const site = {
  brand: 'Dwellwise',
  legalName: 'Dwellwise',
  tagline: 'Smarter decisions for a better home.',
  // One-sentence positioning used in metadata and structured data.
  description:
    'Independent, hands-on buying advice for home and smart-home technology — ' +
    'robot vacuums, security cameras, mesh WiFi, thermostats and more. ' +
    'Clear recommendations you can trust.',
  founded: 2026,
  // Canonical production domain. Astro.site (from astro.config) is the source of
  // truth at build time; this is a human-readable fallback for copy.
  domain: 'www.dwellwise.com',
  locale: 'en_GB',
  language: 'en',

  // Contact + social. Placeholders — swap for real handles before launch.
  email: 'hello@dwellwise.com',
  social: {
    twitter: 'https://twitter.com/dwellwise',
    youtube: 'https://youtube.com/@dwellwise',
    pinterest: 'https://pinterest.com/dwellwise'
  },
  // Used for Twitter card `site` attribution.
  twitterHandle: '@dwellwise',

  // Primary navigation. Category links are generated from categories.js; these
  // are the fixed institutional pages that signal trust (E-E-A-T).
  nav: [
    { label: 'Reviews', href: '/reviews' },
    { label: 'Guides', href: '/guides' },
    { label: 'How We Test', href: '/how-we-test' },
    { label: 'About', href: '/about' }
  ]
};

// The affiliate + editorial disclosure shown on every commercial page. Honesty
// here is a trust signal (and a legal requirement in most markets).
export const disclosure =
  'Dwellwise is reader-supported. When you buy through links on our site we may ' +
  'earn an affiliate commission, at no extra cost to you. It never changes which ' +
  'products we recommend — our picks are chosen on merit alone.';

export default site;
