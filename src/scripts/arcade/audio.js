// NARROW. ARCADE — sound. A tiny WebAudio synth: no assets, no requests.
//
// The AudioContext is created lazily on the first user gesture (browser
// autoplay policies require it), every effect is a short oscillator envelope,
// and the mute preference persists across visits. All entry points are no-ops
// when muted or before the context exists, so callers never need to check.

const MUTE_KEY = 'narrow.arcade.muted';

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage disabled — default to sound on */
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage disabled — session-only preference */
  }
  return muted;
}

// Call from a user-gesture handler (click/keydown) before playing anything.
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
}

// One enveloped tone. freq can be [start, end] for a sweep.
function tone(freq, dur, { type = 'square', gain = 0.08, at = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  // discrete score tick (brick, food, return, ring)
  blip: () => tone(660, 0.07),
  // UI actions: launch / channel surf
  click: () => tone(240, 0.05, { type: 'triangle', gain: 0.06 }),
  // round begins
  start: () => {
    tone([330, 660], 0.12, { type: 'triangle' });
    tone(880, 0.08, { at: 0.1, gain: 0.05 });
  },
  // round ends
  over: () => tone([320, 70], 0.4, { type: 'sawtooth', gain: 0.06 })
};
