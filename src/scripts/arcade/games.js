// NARROW. ARCADE — game registry.
//
// Each entry is a factory returning a self-contained engine implementing:
//   reset(w,h)                        prepare a fresh round
//   step(dt, input, w, h, demo)       advance one sub-step (demo = self-play)
//   render(ctx, w, h)                 paint the virtual field
//   score()                           current score (number)
//   .over                             true once the round has ended
//
// Coordinates are always the 480x320 virtual field (see engine.js). `input`
// exposes { keys, pressed, pointer{x,y,down,active}, tapped, ax, ay }.

import { clamp } from './engine.js';
import { META } from './catalog.js';

/* ---------- tiny shared draw helpers ---------- */

const MONO = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

function text(ctx, str, x, y, size, color, align = 'left') {
  ctx.font = `700 ${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function fieldBg(ctx, w, h, tint) {
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, w, h);
  // faint scan grid for that phosphor-terminal feel
  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.06;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 24) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += 24) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function gameOverBanner(ctx, w, h, accent, score) {
  ctx.fillStyle = 'rgba(3,4,8,0.72)';
  ctx.fillRect(0, h / 2 - 46, w, 92);
  text(ctx, 'GAME OVER', w / 2, h / 2 - 8, 28, accent, 'center');
  text(ctx, `SCORE ${score}`, w / 2, h / 2 + 20, 14, '#e8e4da', 'center');
  text(ctx, 'TAP / SPACE TO RETRY', w / 2, h / 2 + 40, 10, '#8a867c', 'center');
}

const rand = (a, b) => a + Math.random() * (b - a);

/* =====================================================================
   1. PONG — endless rally. +1 per return, miss and you're out.
   ===================================================================== */

function pong() {
  const PW = 9,
    PH = 30, // paddle half-height
    R = 6;
  return {
    ...META.pong,
    reset() {
      this.ly = 160;
      this.ry = 160;
      this.bx = 240;
      this.by = 160;
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.speed = 170;
      this.bvx = dir * this.speed;
      this.bvy = rand(-90, 90);
      this.returns = 0;
      this.over = false;
    },
    step(dt, input, w, h, demo) {
      if (this.over) return;
      // --- left paddle: keyboard wins, then pointer, else AI assist ---
      const pspeed = 300;
      if (!demo && input.ay) {
        this.ly += input.ay * pspeed * dt;
      } else if (!demo && input.pointer.active) {
        this.ly += clamp(input.pointer.y - this.ly, -pspeed * dt, pspeed * dt);
      } else {
        // demo, or no input yet: track the ball with a little lag
        const target = this.bvx < 0 ? this.by : 160;
        this.ly += clamp(target - this.ly, -pspeed * dt, pspeed * dt);
      }
      this.ly = clamp(this.ly, PH, h - PH);

      // --- right paddle: AI opponent, near-perfect ---
      const target = this.bvx > 0 ? this.by : 160;
      this.ry += clamp(target - this.ry, -280 * dt, 280 * dt);
      this.ry = clamp(this.ry, PH, h - PH);

      // --- ball ---
      this.bx += this.bvx * dt;
      this.by += this.bvy * dt;
      if (this.by < R) {
        this.by = R;
        this.bvy = Math.abs(this.bvy);
      }
      if (this.by > h - R) {
        this.by = h - R;
        this.bvy = -Math.abs(this.bvy);
      }

      // left paddle plane
      if (this.bx - R < 18 + PW && this.bvx < 0) {
        if (Math.abs(this.by - this.ly) < PH + R) {
          this.bx = 18 + PW + R;
          this.speed = Math.min(this.speed + 14, 460);
          this.bvx = this.speed;
          this.bvy = (this.by - this.ly) * 6;
          this.returns++;
        } else if (this.bx < 6) {
          this.over = true;
        }
      }
      // right paddle plane
      if (this.bx + R > w - 18 - PW && this.bvx > 0) {
        if (Math.abs(this.by - this.ry) < PH + R) {
          this.bx = w - 18 - PW - R;
          this.bvx = -this.speed;
          this.bvy = (this.by - this.ry) * 6;
        } else if (this.bx > w - 6) {
          // AI missed — bounce off the wall so the rally continues
          this.bx = w - 6 - R;
          this.bvx = -this.speed;
        }
      }
    },
    render(ctx, w, h) {
      fieldBg(ctx, w, h, this.accent);
      ctx.strokeStyle = 'rgba(232,228,218,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.accent;
      ctx.fillRect(18, this.ly - PH, PW, PH * 2);
      ctx.fillStyle = '#8a867c';
      ctx.fillRect(w - 18 - PW, this.ry - PH, PW, PH * 2);
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(this.bx - R, this.by - R, R * 2, R * 2);
      text(ctx, String(this.returns).padStart(3, '0'), w / 2, 34, 22, this.accent, 'center');
      if (this.over) gameOverBanner(ctx, w, h, this.accent, this.returns);
    },
    score() {
      return this.returns;
    }
  };
}

/* =====================================================================
   2. BREAKOUT — clear bricks, endless with speed ramp, 3 lives.
   ===================================================================== */

function breakout() {
  const COLS = 10,
    ROWS = 6,
    BW = 40,
    BH = 14,
    GAP = 4,
    LEFT = 20,
    TOP = 44,
    PW = 64,
    R = 5;
  return {
    ...META.breakout,
    _buildWall() {
      this.bricks = [];
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          this.bricks.push({
            x: LEFT + c * (BW + GAP),
            y: TOP + r * (BH + GAP),
            row: r,
            alive: true
          });
    },
    _launch() {
      this.bx = this.px;
      this.by = 260;
      this.bvx = rand(-120, 120);
      this.bvy = -this.speed;
    },
    reset(w) {
      this.px = w / 2;
      this.speed = 220;
      this.lives = 3;
      this.pts = 0;
      this.over = false;
      this._buildWall();
      this._launch();
    },
    step(dt, input, w, h, demo) {
      if (this.over) return;
      const pspeed = 380;
      if (demo) {
        this.px += clamp(this.bx - this.px, -pspeed * dt, pspeed * dt);
      } else if (input.pointer.active && !input.ax) {
        this.px += clamp(input.pointer.x - this.px, -pspeed * dt, pspeed * dt);
      } else {
        this.px += input.ax * pspeed * dt;
      }
      this.px = clamp(this.px, PW / 2, w - PW / 2);

      this.bx += this.bvx * dt;
      this.by += this.bvy * dt;
      if (this.bx < R) {
        this.bx = R;
        this.bvx = Math.abs(this.bvx);
      }
      if (this.bx > w - R) {
        this.bx = w - R;
        this.bvx = -Math.abs(this.bvx);
      }
      if (this.by < R) {
        this.by = R;
        this.bvy = Math.abs(this.bvy);
      }
      // paddle
      const py = h - 18;
      if (
        this.bvy > 0 &&
        this.by + R >= py &&
        this.by + R <= py + 12 &&
        Math.abs(this.bx - this.px) < PW / 2 + R
      ) {
        this.by = py - R;
        this.bvy = -Math.abs(this.bvy);
        this.bvx = (this.bx - this.px) * 5;
      }
      // fell off the bottom
      if (this.by > h + R) {
        this.lives--;
        if (this.lives <= 0) this.over = true;
        else this._launch();
        return;
      }
      // bricks
      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (
          this.bx + R > b.x &&
          this.bx - R < b.x + BW &&
          this.by + R > b.y &&
          this.by - R < b.y + BH
        ) {
          b.alive = false;
          this.pts += (ROWS - b.row) * 5;
          // reflect on the shallower axis of penetration
          const ox = Math.min(this.bx + R - b.x, b.x + BW - (this.bx - R));
          const oy = Math.min(this.by + R - b.y, b.y + BH - (this.by - R));
          if (ox < oy) this.bvx = -this.bvx;
          else this.bvy = -this.bvy;
          break;
        }
      }
      if (this.bricks.every((b) => !b.alive)) {
        this.speed = Math.min(this.speed + 40, 400);
        this._buildWall();
        this._launch();
      }
    },
    render(ctx, w, h) {
      fieldBg(ctx, w, h, this.accent);
      const hues = ['#ff5e7a', '#f5a524', '#f5d14a', '#5ee06a', '#37e0c8', '#7aa2ff'];
      for (const b of this.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = hues[b.row % hues.length];
        ctx.fillRect(b.x, b.y, BW, BH);
      }
      ctx.fillStyle = this.accent;
      ctx.fillRect(this.px - PW / 2, h - 18, PW, 8);
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(this.bx - R, this.by - R, R * 2, R * 2);
      text(ctx, `SCORE ${this.pts}`, 12, 22, 13, this.accent);
      text(ctx, '♥'.repeat(Math.max(0, this.lives)), w - 12, 22, 14, '#ff5e7a', 'right');
      if (this.over) gameOverBanner(ctx, w, h, this.accent, this.pts);
    },
    score() {
      return this.pts;
    }
  };
}

/* =====================================================================
   3. SNAKE — grid classic, speeds up as it grows.
   ===================================================================== */

function snake() {
  const CELL = 20,
    GW = 24,
    GH = 16;
  return {
    ...META.snake,
    _placeFood() {
      let f;
      do {
        f = { x: (Math.random() * GW) | 0, y: (Math.random() * GH) | 0 };
      } while (this.body.some((s) => s.x === f.x && s.y === f.y));
      this.food = f;
    },
    reset() {
      this.body = [
        { x: 8, y: 8 },
        { x: 7, y: 8 },
        { x: 6, y: 8 }
      ];
      this.dir = { x: 1, y: 0 };
      this.next = { x: 1, y: 0 };
      this.acc = 0;
      this.interval = 0.13;
      this.eaten = 0;
      this.over = false;
      this._placeFood();
    },
    _turn(dx, dy) {
      // reject 180° reversals
      if (dx === -this.dir.x && dy === -this.dir.y) return;
      this.next = { x: dx, y: dy };
    },
    step(dt, input, w, h, demo) {
      if (this.over) return;
      if (demo) {
        this._aiSteer();
      } else if (input.ax || input.ay) {
        if (input.ax) this._turn(Math.sign(input.ax), 0);
        else this._turn(0, Math.sign(input.ay));
      } else if (input.pointer.down) {
        const hx = this.body[0].x * CELL + CELL / 2;
        const hy = this.body[0].y * CELL + CELL / 2;
        const dx = input.pointer.x - hx;
        const dy = input.pointer.y - hy;
        if (Math.abs(dx) > Math.abs(dy)) this._turn(Math.sign(dx), 0);
        else this._turn(0, Math.sign(dy));
      }
      this.acc += dt;
      if (this.acc < this.interval) return;
      this.acc -= this.interval;
      this.dir = this.next;
      const head = {
        x: this.body[0].x + this.dir.x,
        y: this.body[0].y + this.dir.y
      };
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= GW ||
        head.y >= GH ||
        this.body.some((s) => s.x === head.x && s.y === head.y)
      ) {
        this.over = true;
        return;
      }
      this.body.unshift(head);
      if (head.x === this.food.x && head.y === this.food.y) {
        this.eaten++;
        this.interval = Math.max(0.06, 0.13 - this.eaten * 0.004);
        this._placeFood();
      } else {
        this.body.pop();
      }
    },
    _safe(nx, ny) {
      return (
        nx >= 0 &&
        ny >= 0 &&
        nx < GW &&
        ny < GH &&
        !this.body.slice(0, -1).some((s) => s.x === nx && s.y === ny)
      );
    },
    _aiSteer() {
      const head = this.body[0];
      const options = [
        { x: Math.sign(this.food.x - head.x), y: 0 },
        { x: 0, y: Math.sign(this.food.y - head.y) },
        { x: this.dir.x, y: this.dir.y },
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ];
      for (const o of options) {
        if (!o.x && !o.y) continue;
        if (o.x === -this.dir.x && o.y === -this.dir.y) continue;
        if (this._safe(head.x + o.x, head.y + o.y)) {
          this.next = o;
          return;
        }
      }
    },
    render(ctx, w, h) {
      fieldBg(ctx, w, h, this.accent);
      ctx.fillStyle = '#ff5e7a';
      ctx.fillRect(this.food.x * CELL + 3, this.food.y * CELL + 3, CELL - 6, CELL - 6);
      this.body.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#e8e4da' : this.accent;
        ctx.globalAlpha = i === 0 ? 1 : clamp(1 - i / (this.body.length + 6), 0.35, 1);
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.globalAlpha = 1;
      text(ctx, `SCORE ${this.eaten * 10}`, 10, 18, 13, this.accent);
      if (this.over) gameOverBanner(ctx, w, h, this.accent, this.eaten * 10);
    },
    score() {
      return this.eaten * 10;
    }
  };
}

/* =====================================================================
   4. STARFALL — dodge the falling blocks, survive for score.
   ===================================================================== */

function dodge() {
  const SW = 24,
    SH = 12;
  return {
    ...META.dodge,
    reset(w, h) {
      this.x = w / 2;
      this.y = h - 22;
      this.blocks = [];
      this.spawn = 0;
      this.rate = 0.7;
      this.fall = 120;
      this.t = 0;
      this.over = false;
    },
    step(dt, input, w, h, demo) {
      if (this.over) return;
      this.t += dt;
      this.fall = 120 + this.t * 8;
      this.rate = Math.max(0.28, 0.7 - this.t * 0.012);
      const sp = 320;
      if (demo) {
        this.x += clamp(this._safest(w) - this.x, -sp * dt, sp * dt);
      } else if (input.pointer.active && !input.ax) {
        this.x += clamp(input.pointer.x - this.x, -sp * dt, sp * dt);
      } else {
        this.x += input.ax * sp * dt;
      }
      this.x = clamp(this.x, SW / 2, w - SW / 2);

      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.spawn = this.rate;
        const bw = rand(26, 70);
        this.blocks.push({ x: rand(0, w - bw), y: -20, w: bw, h: 16 });
      }
      for (const b of this.blocks) b.y += this.fall * dt;
      this.blocks = this.blocks.filter((b) => b.y < h + 24);
      // collision
      for (const b of this.blocks) {
        if (
          this.x + SW / 2 > b.x &&
          this.x - SW / 2 < b.x + b.w &&
          this.y + SH / 2 > b.y &&
          this.y - SH / 2 < b.y + b.h
        ) {
          this.over = true;
          return;
        }
      }
    },
    _safest(w) {
      // pick the x with the most vertical breathing room among near blocks
      let best = this.x,
        bestGap = -1;
      for (let x = SW; x < w - SW; x += 16) {
        let gap = 999;
        for (const b of this.blocks) {
          if (b.y > this.y) continue;
          if (x + SW / 2 > b.x && x - SW / 2 < b.x + b.w)
            gap = Math.min(gap, this.y - b.y);
        }
        if (gap > bestGap) {
          bestGap = gap;
          best = x;
        }
      }
      return best;
    },
    render(ctx, w, h) {
      fieldBg(ctx, w, h, this.accent);
      ctx.fillStyle = '#8a867c';
      for (const b of this.blocks) ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = this.accent;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - SH / 2);
      ctx.lineTo(this.x + SW / 2, this.y + SH / 2);
      ctx.lineTo(this.x - SW / 2, this.y + SH / 2);
      ctx.closePath();
      ctx.fill();
      text(ctx, `${(this.t * 10) | 0}`.padStart(4, '0'), w / 2, 30, 20, this.accent, 'center');
      if (this.over) gameOverBanner(ctx, w, h, this.accent, (this.t * 10) | 0);
    },
    score() {
      return (this.t * 10) | 0;
    }
  };
}

/* =====================================================================
   5. ROADRUNNER — endless jumper, clear the obstacles.
   ===================================================================== */

function runner() {
  const GROUND = 262,
    PX = 70,
    PW = 18,
    PH = 24;
  return {
    ...META.runner,
    reset() {
      this.y = GROUND - PH;
      this.vy = 0;
      this.onGround = true;
      this.obs = [];
      this.spawn = 1.2;
      this.speed = 220;
      this.dist = 0;
      this.over = false;
    },
    _jump() {
      if (this.onGround) {
        this.vy = -430;
        this.onGround = false;
      }
    },
    step(dt, input, w, h, demo) {
      if (this.over) return;
      this.dist += (this.speed * dt) / 10;
      this.speed = Math.min(430, 220 + this.dist * 0.25);

      const nearest = this.obs.find((o) => o.x + o.w > PX);
      if (demo) {
        if (nearest && nearest.x - PX < 90 && this.onGround) this._jump();
      } else if (
        input.pressed.has('Space') ||
        input.pressed.has('ArrowUp') ||
        input.tapped
      ) {
        this._jump();
      }

      this.vy += 1500 * dt;
      this.y += this.vy * dt;
      if (this.y >= GROUND - PH) {
        this.y = GROUND - PH;
        this.vy = 0;
        this.onGround = true;
      }

      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.spawn = rand(0.8, 1.5) * (220 / this.speed);
        const tall = Math.random() < 0.35;
        this.obs.push({ x: w + 10, w: rand(14, 26), h: tall ? 40 : 24 });
      }
      for (const o of this.obs) o.x -= this.speed * dt;
      this.obs = this.obs.filter((o) => o.x + o.w > -10);

      for (const o of this.obs) {
        const oy = GROUND - o.h;
        if (
          PX + PW > o.x &&
          PX < o.x + o.w &&
          this.y + PH > oy
        ) {
          this.over = true;
          return;
        }
      }
    },
    render(ctx, w, h) {
      fieldBg(ctx, w, h, this.accent);
      ctx.strokeStyle = 'rgba(232,228,218,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(w, GROUND);
      ctx.stroke();
      ctx.fillStyle = '#8a867c';
      for (const o of this.obs) ctx.fillRect(o.x, GROUND - o.h, o.w, o.h);
      ctx.fillStyle = this.accent;
      ctx.fillRect(PX, this.y, PW, PH);
      text(ctx, `${this.dist | 0}m`, w - 12, 22, 16, this.accent, 'right');
      if (this.over) gameOverBanner(ctx, w, h, this.accent, this.dist | 0);
    },
    score() {
      return this.dist | 0;
    }
  };
}

/* =====================================================================
   6. GATECRASH — reflex targets, hit them before they vanish.
   ===================================================================== */

function reflex() {
  return {
    ...META.reflex,
    reset() {
      this.targets = [];
      this.spawn = 0.4;
      this.rate = 1.05;
      this.ttl = 1.6;
      this.hits = 0;
      this.lives = 3;
      this.t = 0;
      this.over = false;
    },
    _spawn(w, h) {
      const r = rand(18, 26);
      this.targets.push({
        x: rand(r + 10, w - r - 10),
        y: rand(r + 30, h - r - 10),
        r,
        life: this.ttl
      });
    },
    step(dt, input, w, h, demo) {
      if (this.over) return;
      this.t += dt;
      this.rate = Math.max(0.5, 1.05 - this.t * 0.01);
      this.ttl = Math.max(0.85, 1.6 - this.t * 0.01);

      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.spawn = this.rate;
        this._spawn(w, h);
      }
      for (const t of this.targets) t.life -= dt;

      if (demo) {
        // pop whatever is closest to expiring
        const t = this.targets.filter((t) => t.life > 0).sort((a, b) => a.life - b.life)[0];
        if (t && t.life < 0.6) {
          t.hit = true;
          this.hits++;
        }
      } else if (input.tapped) {
        for (const t of this.targets) {
          if (t.hit) continue;
          if (Math.hypot(input.pointer.x - t.x, input.pointer.y - t.y) < t.r + 4) {
            t.hit = true;
            this.hits++;
            break;
          }
        }
      }
      // expire
      const before = this.targets.length;
      this.targets = this.targets.filter((t) => {
        if (t.hit) return false;
        if (t.life <= 0) {
          this.lives--;
          return false;
        }
        return true;
      });
      void before;
      if (this.lives <= 0) this.over = true;
    },
    render(ctx, w, h) {
      fieldBg(ctx, w, h, this.accent);
      for (const t of this.targets) {
        const k = clamp(t.life / this.ttl, 0, 1);
        ctx.strokeStyle = this.accent;
        ctx.globalAlpha = 0.4 + 0.6 * k;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.stroke();
        // shrinking inner ring is the timer
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      text(ctx, `HITS ${this.hits}`, 12, 22, 13, this.accent);
      text(ctx, '♥'.repeat(Math.max(0, this.lives)), w - 12, 22, 14, '#ff5e7a', 'right');
      if (this.over) gameOverBanner(ctx, w, h, this.accent, this.hits);
    },
    score() {
      return this.hits;
    }
  };
}

/* ---------- registry ---------- */

// Factories keyed by id. Display metadata lives in catalog.js (build-safe);
// portal.js looks a factory up by the data-game id on each cabinet.
export const FACTORIES = { pong, breakout, snake, dodge, runner, reflex };
