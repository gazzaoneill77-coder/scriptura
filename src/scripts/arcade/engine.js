// NARROW. ARCADE — game engine core. Pure vanilla, zero dependencies.
//
// Every game draws into a fixed virtual field (VW x VH). The host scales that
// field to whatever canvas size it is handed, so games never think about DPR,
// resize, or letterboxing — they only ever see 480x320 coordinates.
//
// Two consumers share the same game factories:
//   GameHost  — full-screen, player-controlled, HUD + best-score persistence.
//   Preview   — small, self-playing "attract mode", throttled + paused offscreen.

export const VW = 480;
export const VH = 320;

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ---------- honest local persistence ----------
   Everything here is per-device truth: your own best scores and your own play
   counts, kept in localStorage. No fabricated global numbers — a real backend
   can layer aggregate stats on top later, but we never invent them. */

const BEST_KEY = 'narrow.arcade.best';
const PLAYS_KEY = 'narrow.arcade.plays';

function readMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function writeMap(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage disabled — values stay session-only, never throws */
  }
}

export function readBest() {
  return readMap(BEST_KEY);
}

export function saveBest(id, score) {
  const all = readBest();
  if (score <= (all[id] || 0)) return all[id] || 0;
  all[id] = score;
  writeMap(BEST_KEY, all);
  return score;
}

export function readPlays() {
  return readMap(PLAYS_KEY);
}

export function bumpPlay(id) {
  const all = readPlays();
  all[id] = (all[id] || 0) + 1;
  writeMap(PLAYS_KEY, all);
  return all[id];
}

/* ---------- canvas fitting ---------- */

// Size the backing store to the element's box (× dpr) and return the transform
// that maps the VW×VH virtual field onto it, centred with cover-fit letterbox.
function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const scale = Math.min((w * dpr) / VW, (h * dpr) / VH);
  const ox = (w * dpr - VW * scale) / 2;
  const oy = (h * dpr - VH * scale) / 2;
  return { scale, ox, oy, cssW: w, cssH: h, dpr };
}

// Map a DOM pointer event to virtual field coordinates (clamped to the field).
function toField(canvas, fit, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * fit.dpr;
  const py = (clientY - rect.top) * fit.dpr;
  return {
    x: clamp((px - fit.ox) / fit.scale, 0, VW),
    y: clamp((py - fit.oy) / fit.scale, 0, VH)
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ---------- input snapshot ---------- */

function makeInput() {
  return {
    keys: new Set(),           // codes currently held
    pressed: new Set(),        // codes that went down this frame
    pointer: { x: VW / 2, y: VH / 2, down: false, active: false },
    tapped: false,             // pointer went down this frame
    // Convenience axes read by games, refreshed each frame.
    ax: 0,
    ay: 0
  };
}

function refreshAxes(input) {
  const k = input.keys;
  input.ax =
    (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) -
    (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
  input.ay =
    (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) -
    (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
}

/* ---------- the full-screen host ---------- */

export class GameHost {
  constructor(canvas, { onEject } = {}) {
    this.canvas = canvas;
    this.onEject = onEject || (() => {});
    this.input = makeInput();
    this.game = null;
    this.factory = null;
    this.running = false;
    this.paused = false;
    this.raf = 0;
    this.last = 0;
    this.acc = 0;
    this.best = 0;
    this.onScore = () => {};
    this.onStatus = () => {};
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    // Keyboard lives on window so play works without focusing the canvas.
    this._onKeyDown = (e) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code
        )
      )
        e.preventDefault();
      if (e.code === 'Escape') {
        this.onEject();
        return;
      }
      if (!this.input.keys.has(e.code)) this.input.pressed.add(e.code);
      this.input.keys.add(e.code);
      if (this.game && this.game.over && e.code === 'Space') this._restart();
    };
    this._onKeyUp = (e) => this.input.keys.delete(e.code);

    const setPointer = (e, down) => {
      const fit = this._fit || fitCanvas(c);
      const p = toField(c, fit, e.clientX, e.clientY);
      this.input.pointer.x = p.x;
      this.input.pointer.y = p.y;
      this.input.pointer.active = true;
      if (down === true) {
        if (!this.input.pointer.down) this.input.tapped = true;
        this.input.pointer.down = true;
      } else if (down === false) {
        this.input.pointer.down = false;
      }
    };
    this._onDown = (e) => {
      e.preventDefault();
      setPointer(e, true);
      if (this.game && this.game.over) this._restart();
    };
    this._onMove = (e) => setPointer(e, null);
    this._onUp = (e) => setPointer(e, false);
    this._onBlur = () => {
      this.input.keys.clear();
      this.input.pointer.down = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._onBlur();
    });
  }

  load(factory) {
    this.factory = factory;
    this.game = factory();
    this.best = readBest()[this.game.id] || 0;
    this.game.reset(VW, VH);
    this._reportedOver = false;
    this.onStatus('ready');
  }

  _restart() {
    if (!this.game) return;
    this.game.reset(VW, VH);
    this._reportedOver = false;
    this.onStatus('playing');
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1; // clamp tab-switch spikes
      if (!this.paused) this._advance(dt);
      this._draw();
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  _advance(dt) {
    const g = this.game;
    if (!g) return;
    refreshAxes(this.input);
    // Fixed 120Hz sub-steps keep collisions stable across framerates.
    const STEP = 1 / 120;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= STEP && guard++ < 16) {
      g.step(STEP, this.input, VW, VH, false);
      this.acc -= STEP;
      // Input edges are per-sim-step; clear after first consumed step.
      this.input.pressed.clear();
      this.input.tapped = false;
    }
    const s = g.score();
    if (s !== this._lastScore) {
      this._lastScore = s;
      this.onScore(s);
    }
    if (g.over && !this._reportedOver) {
      this._reportedOver = true;
      this.best = saveBest(g.id, s);
      this.onStatus('over');
    }
  }

  _draw() {
    const c = this.canvas;
    const fit = (this._fit = fitCanvas(c));
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.ox, fit.oy);
    // Clip to the virtual field so games can't bleed into letterbox bars.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    if (this.game) this.game.render(ctx, VW, VH);
    ctx.restore();
  }

  destroy() {
    this.stop();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('blur', this._onBlur);
  }
}

/* ---------- attract-mode preview ---------- */

// Runs a game factory in self-playing demo mode at a capped framerate. Pauses
// itself whenever its canvas scrolls out of view, and stays a static frame
// under prefers-reduced-motion.
export class Preview {
  constructor(canvas, factory) {
    this.canvas = canvas;
    this.game = factory();
    this.game.reset(VW, VH);
    this.input = makeInput();
    this.visible = false;
    this.raf = 0;
    this.last = 0;
    this.fpsInterval = 1 / 20; // demos don't need 60fps
    this.acc = 0;
    this._loop = this._loop.bind(this);
  }

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    if (v && !reduced) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this._loop);
    } else {
      cancelAnimationFrame(this.raf);
      this._render(); // leave a clean frame behind
    }
  }

  _loop(now) {
    if (!this.visible) return;
    this.raf = requestAnimationFrame(this._loop);
    let dt = (now - this.last) / 1000;
    if (dt < this.fpsInterval) return;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    refreshAxes(this.input);
    // Sub-step the demo too, so ball/collision behaviour matches real play.
    let acc = dt;
    const STEP = 1 / 120;
    let guard = 0;
    while (acc >= STEP && guard++ < 24) {
      this.game.step(STEP, this.input, VW, VH, true);
      acc -= STEP;
    }
    if (this.game.over) this.game.reset(VW, VH);
    this._render();
  }

  _render() {
    const c = this.canvas;
    const fit = fitCanvas(c);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.ox, fit.oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    this.game.render(ctx, VW, VH);
    ctx.restore();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.visible = false;
  }
}
