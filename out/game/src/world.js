// Pulse Orchard — the rules and state, with no drawing, sound or browser in it. Blossoms of a few
// colours descend from the sky toward the soil; the "pulse" cycles through those colours one at a
// time. The player aims the seedling and fires, zapping the lowest blossom of the pulse colour near
// the aim; each zap advances the pulse to the next colour. A blossom that reaches the soil roots and
// costs a life (and is gone). Clear every blossom in a wave to grow the orchard; more colours and a
// faster fall each wave, three lives, nine waves to win. step() advances one fixed step and returns
// what happened as bit flags so the caller can react without the world knowing about screens or sound.
import {
  COLORS, FIELD, GRID, LIVES, POINTS, SEEDLING, SHOOT, STAR_CHANCE, STAR_COLOR, STAR_KIND, TARGET_QUEUE, WIN_WAVES,
  AIM_RADIUS, activeColorCount, descendSpeed,
} from './config.js';
import { createRandom, makeShuffle } from './random.js';

export const EVENT_MATCH = 1;   // a blossom was zapped
export const EVENT_STAR = 2;    // a star blossom was zapped
export const EVENT_WRONG = 4;   // a blossom rooted: a life was lost
export const EVENT_CLEAR = 8;   // the wave is cleared
export const EVENT_OVER = 16;   // out of lives
export const EVENT_WIN = 32;    // the orchard is saved

export function createWorld(seed) {
  const rng = createRandom(seed);
  const shuffle = makeShuffle(rng);
  const cells = [];
  for (let c = 0; c < GRID.cols; c += 1) {
    for (let r = 0; r < GRID.rowsMax; r += 1) {
      cells.push({ col: c, row: r, color: 0, dead: true, spawn: 0, x: GRID.centers[c], y: GRID.topY, active: false });
    }
  }

  const state = {
    wave: 1,
    colorIndex: 0,
    queue: Array.from({ length: TARGET_QUEUE }, () => 0),
    aimX: FIELD.width / 2,
    shootCooldown: 0,
    beamTimer: 0,
    beamY: 0,
    score: 0,
    lives: LIVES,
    combo: 0,
    maxCombo: 0,
    matches: 0,
    stars: 0,
    shake: 0,
    flash: null,
    zap: null,
    comet: null,
    message: null,
    messageTimer: 0,
  };

  function liveBlooms() {
    return cells.filter((c) => !c.dead);
  }

  function popup(text, color) {
    state.message = { text, color };
    state.messageTimer = 0.95;
  }

  function reset() {
    for (const c of cells) { c.dead = true; c.active = false; }
    state.wave = 1;
    state.colorIndex = 0;
    state.aimX = FIELD.width / 2;
    state.shootCooldown = 0;
    state.beamTimer = 0;
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.maxCombo = 0;
    state.matches = 0;
    state.stars = 0;
    state.shake = 0;
    state.flash = null;
    state.zap = null;
    state.comet = null;
    state.message = null;
    state.messageTimer = 0;
    startWave();
  }

  /** Lay out one wave: a stack of blossoms per column, each column fanned in a little after the last. */
  function startWave() {
    const wave = state.wave;
    const colorCount = activeColorCount(wave);
    const rows = GRID.rowsBase; // two rows in every wave: difficulty comes from colour count and fall speed
    // Row 0 (the lowest) holds one of every colour in the wave, shuffled, so the first pulse is always
    // zappable in every column; each column's stack is that order, rotated so each column's bottom
    // colour differs, then wrapped past the colour count so later rows still vary.
    const starColumn = wave % 2 === 0 ? Math.floor(rng() * GRID.cols) : -1;
    const extraStar = starColumn < 0 && rng() < STAR_CHANCE ? Math.floor(rng() * GRID.cols) : -1;
    const order = shuffle([...Array(colorCount).keys()]);

    for (let c = 0; c < GRID.cols; c += 1) {
      const columnDelay = c * 0.22 + rng() * 0.2;
      const colors = [];
      for (let r = 0; r < rows; r += 1) colors.push(order[(c + r) % colorCount]);
      if (c === starColumn || c === extraStar) colors[rows - 1] = STAR_KIND; // top blossom is the bonus star

      for (let r = 0; r < rows; r += 1) {
        const cell = cells[c * GRID.rowsMax + r];
        cell.dead = false;
        cell.active = false;
        cell.color = colors[r];
        cell.spawn = columnDelay + r * 0.16;
        cell.x = GRID.centers[c];
        cell.y = GRID.topY - 30 - r * GRID.rowGap;
      }
    }
    state.colorIndex = order[0];
    buildQueue();
  }

  function colorCountNow() {
    return activeColorCount(state.wave);
  }

  function buildQueue() {
    const count = colorCountNow();
    for (let i = 0; i < TARGET_QUEUE; i += 1) {
      state.queue[i] = (state.colorIndex + i) % count;
    }
  }

  function step(dt, aimX, fireHeld) {
    let events = 0;
    state.shake = Math.max(0, state.shake - dt);
    state.beamTimer = Math.max(0, state.beamTimer - dt);
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = null;
    if (state.flash) { state.flash.t -= dt; if (state.flash.t <= 0) state.flash = null; }
    if (state.zap) { state.zap.t -= dt; if (state.zap.t <= 0) state.zap = null; }
    state.aimX = Math.max(0, Math.min(FIELD.width, aimX));

    const speed = descendSpeed(state.wave);
    let rooted = null;
    for (const cell of cells) {
      if (cell.dead) continue;
      if (!cell.active) {
        cell.spawn -= dt;
        if (cell.spawn <= 0) { cell.active = true; cell.y = GRID.topY; }
        continue;
      }
      cell.y += speed * dt;
      if (cell.y >= FIELD.soilY + 6) {
        cell.dead = true;
        if (cell.color === STAR_KIND) {
          popup('Star missed', STAR_COLOR.fill); // a bonus, never a life
        } else if (!rooted) {
          rooted = cell;
          // The next blossom up takes its place at the top of the screen, so a column the player
          // is ignoring stays dense and every colour still has a zappable blossom to return to.
          for (let rr = cell.row - 1; rr >= 0; rr -= 1) {
            const above = cells[cell.col * GRID.rowsMax + rr];
            if (above.dead) continue;
            above.dead = true;
            above.active = true;
            above.y = GRID.topY;
            break;
          }
        }
      }
    }

    if (rooted) events |= onRoot();

    state.shootCooldown -= dt;
    if (fireHeld && state.shootCooldown <= 0) {
      events |= fireBeam();
    }

    if (state.comet) {
      const c = state.comet;
      c.t += dt / c.dur;
      if (c.t >= 1) state.comet = null;
      else {
        const k = c.t;
        c.x = c.x0 + (c.x1 - c.x0) * k;
        c.y = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 70;
      }
    }

    if (liveBlooms().length === 0) {
      events |= finishWave();
    }
    return events;
  }

  function onRoot() {
    state.lives -= 1;
    state.combo = 0;
    state.shake = 0.5;
    popup('A blossom rooted', '#ff7a6b');
    let events = EVENT_WRONG;
    if (state.lives <= 0) events |= EVENT_OVER;
    return events;
  }

  /** Zap the lowest live blossom of the pulse colour near the aim; advance the pulse past empty colours. */
  function fireBeam() {
    state.shootCooldown = SHOOT.cooldown;
    state.beamTimer = SHOOT.beamDuration;
    const color = state.queue[0];
    let target = null;
    let bestY = -Infinity;
    let bestDist = Infinity;
    for (const cell of cells) {
      if (cell.dead || !cell.active) continue;
      if (cell.color !== color) continue;
      const d = Math.abs(cell.x - state.aimX);
      if (d > GRID.radius * AIM_RADIUS) continue;
      if (cell.y > bestY || (cell.y === bestY && d < bestDist)) {
        bestY = cell.y;
        bestDist = d;
        target = cell;
      }
    }
    if (!target) {
      // If that colour is already gone, move the pulse on rather than leaving the player stuck.
      if (!cells.some((c) => !c.dead && c.active && c.color === color)) advancePulse();
      state.combo = 0; // a missed shot drops the combo; a waiting shot costs nothing
      return 0;
    }

    target.dead = true;
    const star = target.color === STAR_KIND;
    state.flash = { x: target.x, y: target.y, t: 0.18, color: target.color };
    state.zap = { x: target.x, y0: target.y, y1: FIELD.soilY - 30, t: 0.14, color: target.color };
    state.beamY = target.y;

    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.matches += 1;
    const base = star ? POINTS.star : POINTS.bloom;
    state.score += base + (state.combo - 1) * POINTS.comboStep;
    if (star) {
      state.stars += 1;
      popup(`Star +${base + (state.combo - 1) * POINTS.comboStep}`, STAR_COLOR.fill);
      state.comet = { x0: target.x, y0: target.y, x1: state.aimX, y1: SEEDLING.y, t: 0, dur: 0.3 };
    }
    advancePulse();
    return star ? EVENT_MATCH | EVENT_STAR : EVENT_MATCH;
  }

  function advancePulse() {
    const count = colorCountNow();
    // Skip to the next colour that still has a blossom to zap, so the pulse never dead-ends.
    for (let step = 1; step <= count; step += 1) {
      const next = (state.colorIndex + step) % count;
      if (cells.some((c) => !c.dead && c.color === next)) {
        state.colorIndex = next;
        buildQueue();
        return;
      }
    }
    state.colorIndex = (state.colorIndex + 1) % count;
    buildQueue();
  }

  function finishWave() {
    let events = EVENT_CLEAR;
    state.score += POINTS.starClear + (state.wave - 1) * 5;
    popup(`Wave ${state.wave} cleared`, '#86ff7d');
    if (state.wave >= WIN_WAVES) {
      state.score += state.lives * POINTS.lifeBonus;
      events |= EVENT_WIN;
      return events;
    }
    state.wave += 1;
    startWave();
    return events;
  }

  reset();
  return { state, step, reset, liveBlooms, cells };
}
