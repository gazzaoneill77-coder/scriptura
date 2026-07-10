// NARROW. ARCADE — portal orchestration (client only).
//
// Progressive enhancement: Astro renders a crawlable wall of <li.cabinet>
// elements (real titles + copy for SEO/LLMs). This script:
//   1. drops a live attract-mode <canvas> preview into each cabinet,
//   2. launches the chosen game into a full-screen CRT overlay on click,
//   3. lets you channel-surf between games without leaving the overlay.

import { GameHost, Preview, readBest, readPlays, bumpPlay } from './engine.js';
import { FACTORIES } from './games.js';
import { CATALOG } from './catalog.js';
import { href } from '../../lib/url.js';

const ORDER = CATALOG.map((g) => g.id);

// Paint each cabinet with this device's own honest stats: best score, play
// count, and a "YOUR TOP" badge on whatever you've played most.
function refreshCabinetStats(wall) {
  const best = readBest();
  const plays = readPlays();
  let topId = null;
  let topN = 0;
  for (const id of ORDER)
    if ((plays[id] || 0) > topN) {
      topN = plays[id] || 0;
      topId = id;
    }
  wall.querySelectorAll('.cabinet').forEach((cab) => {
    const id = cab.dataset.game;
    const b = cab.querySelector('[data-best]');
    if (b) b.textContent = best[id] ? `YOUR BEST ${best[id]}` : 'NOT YET PLAYED';
    const p = cab.querySelector('[data-plays]');
    if (p) p.textContent = plays[id] ? `${plays[id]}×` : '';
    const badge = cab.querySelector('[data-top]');
    if (badge) badge.hidden = !(id === topId && topN > 0);
  });
}

function boot() {
  const wall = document.querySelector('[data-wall]');
  if (!wall) return;

  /* ---------- live previews on every cabinet ---------- */
  const previews = [];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const p = e.target._preview;
        if (p) {
          p._inView = e.isIntersecting;
          p.setVisible(e.isIntersecting && !document.body.classList.contains('playing'));
        }
      }
    },
    { threshold: 0.15 }
  );

  wall.querySelectorAll('.cabinet').forEach((cab) => {
    const id = cab.dataset.game;
    const factory = FACTORIES[id];
    const mount = cab.querySelector('[data-screen]');
    if (!factory || !mount) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'screen-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);
    const preview = new Preview(canvas, factory);
    cab._preview = preview;
    previews.push(preview);
    io.observe(cab);
    cab.querySelector('.cab-launch').addEventListener('click', () => launch(id));
  });

  refreshCabinetStats(wall);

  const resumePreviews = () =>
    previews.forEach((p) => p.setVisible(p._inView && !playing()));
  const pausePreviews = () => previews.forEach((p) => p.setVisible(false));

  /* ---------- the CRT play overlay ---------- */
  const play = buildOverlay();
  document.body.appendChild(play.el);

  const host = new GameHost(play.canvas, { onEject: eject });
  host.onScore = (s) => (play.score.textContent = `SCORE ${s}`);
  host.onStatus = (st) => {
    play.status.dataset.state = st;
    if (st === 'over') play.status.textContent = 'GAME OVER · TAP OR SPACE TO RETRY';
    else if (st === 'ready') play.status.textContent = 'TAP OR PRESS ANY KEY TO START';
    else play.status.textContent = '';
  };

  let current = -1;
  const playing = () => document.body.classList.contains('playing');

  // Show the instructions panel and hold the game paused behind it.
  function showInfo() {
    const meta = CATALOG[current];
    play.infoTitle.textContent = meta.title;
    play.infoGoal.textContent = meta.goal;
    play.infoCtrls.textContent = meta.controls;
    play.info.hidden = false;
    host.paused = true;
  }

  // Dismiss instructions and let the simulation run.
  function begin() {
    if (play.info.hidden) return;
    play.info.hidden = true;
    host.paused = false;
    bumpPlay(ORDER[current]); // count the play only when it actually starts
    // drop any input buffered while the panel was up
    host.input.keys.clear();
    host.input.pressed.clear();
    host.input.tapped = false;
    host.input.pointer.down = false;
    play.hint.classList.remove('gone');
    clearTimeout(play._hintT);
    play._hintT = setTimeout(() => play.hint.classList.add('gone'), 3200);
  }

  function loadIndex(i) {
    current = (i + ORDER.length) % ORDER.length;
    const meta = CATALOG[current];
    host.load(FACTORIES[meta.id]);
    play.el.style.setProperty('--accent', meta.accent);
    play.title.textContent = meta.title;
    play.best.textContent = `BEST ${host.best}`;
    play.score.textContent = 'SCORE 0';
    play.hint.textContent = meta.controls;
    play.ch.textContent = `CH ${String(current + 1).padStart(2, '0')} / ${ORDER.length}`;
    play.status.dataset.state = 'ready';
    play.status.textContent = '';
    // shareable / bookmarkable deep link, no reload
    try {
      history.replaceState(null, '', `#play=${meta.id}`);
    } catch {
      /* history blocked — cosmetic only */
    }
    showInfo();
  }

  function launch(id) {
    document.body.classList.add('playing');
    play.el.hidden = false;
    pausePreviews();
    loadIndex(ORDER.indexOf(id));
    host.start();
    play.canvas.focus?.();
  }

  function surf(dir) {
    if (!playing()) return;
    host.stop();
    loadIndex(current + dir);
    host.start();
  }

  function eject() {
    host.stop();
    play.el.hidden = true;
    document.body.classList.remove('playing');
    refreshCabinetStats(wall); // reflect any new best score on the wall
    resumePreviews();
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* history blocked — cosmetic only */
    }
  }

  async function share() {
    const meta = CATALOG[current];
    const url = `${location.origin}${location.pathname}#play=${meta.id}`;
    const data = {
      title: `NARROW. ARCADE — ${meta.title}`,
      text: `Play ${meta.title} on NARROW. ARCADE. ${meta.goal}`,
      url
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard?.writeText(url);
        flash(play.share, 'LINK COPIED');
      }
    } catch {
      /* user cancelled the share sheet — ignore */
    }
  }

  play.eject.addEventListener('click', eject);
  play.prev.addEventListener('click', () => surf(-1));
  play.next.addEventListener('click', () => surf(1));
  play.full.addEventListener('click', () => toggleFullscreen(play.crt));
  play.share.addEventListener('click', share);
  play.playBtn.addEventListener('click', begin);
  play.infoBtn.addEventListener('click', () => (play.info.hidden ? showInfo() : begin()));
  // First tap / keypress on the screen also begins. The info panel covers the
  // canvas while shown, so it must accept the tap too.
  play.canvas.addEventListener('pointerdown', begin);
  play.info.addEventListener('pointerdown', begin);

  // Channel-surf keys that don't collide with game controls.
  window.addEventListener('keydown', (e) => {
    if (!playing()) return;
    if (e.code === 'BracketRight' || e.code === 'Period') return surf(1);
    if (e.code === 'BracketLeft' || e.code === 'Comma') return surf(-1);
    if (e.code === 'Escape') return; // handled by the host (eject)
    begin(); // any other game key dismisses the instructions panel
  });

  // Number-key quick launch from the wall.
  window.addEventListener('keydown', (e) => {
    if (playing()) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= ORDER.length) launch(ORDER[n - 1]);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !playing()) resumePreviews();
  });

  // Deep link: /arcade#play=snake opens straight into that game — both on
  // first load and on same-document hash navigation (e.g. a shared link
  // clicked while already on the page).
  function handleDeepLink() {
    const deep = (location.hash.match(/play=([a-z]+)/) || [])[1];
    if (!deep || !ORDER.includes(deep)) return;
    if (playing()) {
      if (ORDER[current] !== deep) {
        host.stop();
        loadIndex(ORDER.indexOf(deep));
        host.start();
      }
    } else {
      launch(deep);
    }
  }
  window.addEventListener('hashchange', handleDeepLink);
  handleDeepLink();
}

// Briefly swap a button's label to confirm an action (e.g. "LINK COPIED").
function flash(btn, msg) {
  const prev = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = prev), 1400);
}

/* ---------- overlay construction ---------- */

function buildOverlay() {
  const el = document.createElement('div');
  el.className = 'play';
  el.hidden = true;
  el.innerHTML = `
    <div class="crt" data-crt tabindex="-1">
      <canvas class="crt-canvas" tabindex="0" aria-label="Game screen"></canvas>
      <div class="crt-glass" aria-hidden="true"></div>
      <div class="crt-hud">
        <span class="hud-title"></span>
        <span class="hud-nums"><span class="hud-score">SCORE 0</span><span class="hud-best">BEST 0</span></span>
      </div>
      <div class="crt-info" data-info>
        <h4 class="info-title"></h4>
        <p class="info-goal"></p>
        <p class="info-controls"></p>
        <button class="pb info-play" data-play>▶ PLAY</button>
        <span class="info-tip">Tap the screen or press any key to begin</span>
      </div>
      <div class="crt-status" data-state="ready"></div>
      <div class="crt-hint"></div>
    </div>
    <div class="play-bar">
      <button class="pb" data-eject aria-label="Exit game">⏏ EXIT</button>
      <div class="pb-surf">
        <button class="pb" data-prev aria-label="Previous game">◀ CH</button>
        <span class="ch-label" data-ch>CH 01 / ${CATALOG.length}</span>
        <button class="pb" data-next aria-label="Next game">CH ▶</button>
      </div>
      <button class="pb" data-info-btn aria-label="How to play">? HOW</button>
      <button class="pb" data-share aria-label="Share this game">↗ SHARE</button>
      <button class="pb" data-full aria-label="Toggle fullscreen">⛶ FULL</button>
      <a class="pb pb-funnel" href="${href('/shop')}">THE DROP →</a>
    </div>`;
  return {
    el,
    crt: el.querySelector('[data-crt]'),
    canvas: el.querySelector('.crt-canvas'),
    title: el.querySelector('.hud-title'),
    score: el.querySelector('.hud-score'),
    best: el.querySelector('.hud-best'),
    status: el.querySelector('.crt-status'),
    hint: el.querySelector('.crt-hint'),
    info: el.querySelector('[data-info]'),
    infoTitle: el.querySelector('.info-title'),
    infoGoal: el.querySelector('.info-goal'),
    infoCtrls: el.querySelector('.info-controls'),
    playBtn: el.querySelector('[data-play]'),
    infoBtn: el.querySelector('[data-info-btn]'),
    ch: el.querySelector('[data-ch]'),
    eject: el.querySelector('[data-eject]'),
    prev: el.querySelector('[data-prev]'),
    next: el.querySelector('[data-next]'),
    full: el.querySelector('[data-full]'),
    share: el.querySelector('[data-share]')
  };
}

function toggleFullscreen(node) {
  try {
    if (!document.fullscreenElement) node.requestFullscreen?.();
    else document.exitFullscreen?.();
  } catch {
    /* fullscreen blocked — no-op */
  }
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', boot);
else boot();
