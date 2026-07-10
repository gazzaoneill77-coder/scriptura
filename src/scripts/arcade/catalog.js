// NARROW. ARCADE — single source of truth for game metadata.
//
// Pure data, ZERO browser/DOM references, so it is safe to import from Astro
// frontmatter (build time) to render crawlable HTML AND from the client engine.
// Both the SEO markup and the runtime read the same list — they cannot drift.

export const META = {
  pong: {
    id: 'pong',
    scoreBlip: true,
    title: 'RALLY',
    blurb: 'Endless pong. Return the ball forever against a relentless AI.',
    goal: 'Keep the ball in play. Every return you make scores a point — miss it once and the round ends.',
    controls: 'Pointer / ↑ ↓ — move paddle',
    accent: '#37e0c8'
  },
  breakout: {
    id: 'breakout',
    scoreBlip: true,
    title: 'SIEGE',
    blurb: 'Break every brick, then break more. Three lives, rising speed.',
    goal: 'Bounce the ball off your bat to smash every brick. You have three lives before the siege breaks.',
    controls: 'Pointer / ← → — move bat',
    accent: '#f5a524'
  },
  snake: {
    id: 'snake',
    scoreBlip: true,
    title: 'SERPENT',
    blurb: 'The classic grid snake. Grow long, never eat yourself.',
    goal: 'Eat the red squares to grow longer. Hit a wall or your own tail and it is over.',
    controls: 'Arrows / WASD — steer',
    accent: '#5ee06a'
  },
  dodge: {
    id: 'dodge',
    title: 'STARFALL',
    blurb: 'Dodge the falling wall of blocks. Survive as long as you can.',
    goal: 'Weave your ship through the falling blocks. Your score is how long you survive — do not get hit.',
    controls: 'Pointer / ← → — move',
    accent: '#ff5e7a'
  },
  runner: {
    id: 'runner',
    title: 'ROADRUNNER',
    blurb: 'An endless runner down the hard road. Jump every obstacle.',
    goal: 'Jump the obstacles on the road. Distance is your score — a single collision ends the run.',
    controls: 'Tap / Space — jump',
    accent: '#7aa2ff'
  },
  reflex: {
    id: 'reflex',
    scoreBlip: true,
    title: 'GATECRASH',
    blurb: 'A reflex test. Hit each gate ring before it closes.',
    goal: 'Tap each ring before its timer closes. Let three slip past and you are out.',
    controls: 'Tap / click the rings',
    accent: '#c77dff'
  }
};

// Ordered list for building the wall and the sitemap/JSON-LD.
export const CATALOG = ['pong', 'breakout', 'snake', 'dodge', 'runner', 'reflex'].map(
  (id) => META[id]
);
