// Pulse Orchard — drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled with the backdrop.
// The field is a gradient sky over the soil; blossoms are petal circles with a glowing core; the
// seedling is a little sprout that shoots a beam to the blossom it zaps. Every effect (flash, zap,
// comet, shake, popup) is transient state on the world, so this file never runs its own timer.
import { COLORS, FIELD, FONT, GRID, LIVES, PALETTE, SEEDLING, STAR_COLOR, STAR_KIND, WIN_WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 92, line: 34, bottom: 84 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight = 'normal', alpha = 1) {
    context.font = `${weight} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.globalAlpha = alpha;
    context.fillText(value, x, y);
    context.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawSky() {
    const g = context.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // A few faint stars in the upper sky, steady by position.
    context.fillStyle = 'rgba(238,241,248,0.14)';
    for (let i = 0; i < 40; i += 1) {
      const x = ((i * 379) % FIELD.width);
      const y = ((i * 137) % (FIELD.soilY - 120)) + 20;
      const s = (i % 3) + 1;
      context.fillRect(x, y, s, s);
    }
  }

  function drawSoil() {
    context.fillStyle = PALETTE.soil;
    context.fillRect(0, FIELD.soilY, FIELD.width, FIELD.height - FIELD.soilY);
    // The glowing soil line the blossoms must not cross.
    context.fillStyle = PALETTE.soilLine;
    context.fillRect(0, FIELD.soilY - 3, FIELD.width, 3);
    context.fillStyle = 'rgba(47,224,168,0.25)';
    context.fillRect(0, FIELD.soilY, FIELD.width, 8);
  }

  function colorOf(kind) {
    if (kind === STAR_KIND) return STAR_COLOR;
    return COLORS[kind % COLORS.length];
  }

  function drawBlossom(cell) {
    const c = colorOf(cell.color);
    const x = cell.x;
    const y = cell.y;
    const pulse = 1 + Math.sin((x * 0.7 + y * 0.5) + performance.now() * 0.003) * 0.04;
    const r = GRID.radius * pulse;
    // Soft glow behind the petals.
    context.fillStyle = c.glow;
    context.globalAlpha = 0.22;
    context.beginPath();
    context.arc(x, y, r * 1.35, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    // Petals: a ring of circles around a bright core.
    context.fillStyle = c.fill;
    const petals = cell.color === STAR_KIND ? 5 : 6;
    for (let p = 0; p < petals; p += 1) {
      const a = (p / petals) * Math.PI * 2 + cell.col;
      context.beginPath();
      context.arc(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, r * 0.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = c.core;
    context.beginPath();
    context.arc(x, y, r * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawSeedling(state) {
    const x = state.aimX;
    const y = SEEDLING.y;
    // Stem and leaves.
    context.strokeStyle = '#5ce8b4';
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, FIELD.soilY + 6);
    context.quadraticCurveTo(x - 2, y + 26, x, y - 8);
    context.stroke();
    context.fillStyle = '#5ce8b4';
    context.beginPath();
    context.ellipse(x - 16, y + 26, 16, 7, -0.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(x + 16, y + 26, 16, 7, 0.5, 0, Math.PI * 2);
    context.fill();
    // The aiming ring around the seedling's head.
    const pulse = state.queue[0] !== undefined ? colorOf(state.queue[0]).fill : PALETTE.text;
    context.strokeStyle = pulse;
    context.lineWidth = 3;
    context.globalAlpha = 0.8;
    context.beginPath();
    context.arc(x, y - 6, 14 + Math.sin(performance.now() * 0.006) * 2, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawBeam(state) {
    if (state.beamTimer <= 0) return;
    const c = state.queue[0] !== undefined ? colorOf(state.queue[0]).fill : '#bff';
    const x = state.aimX;
    const y1 = state.beamY > 0 ? state.beamY : FIELD.soilY - 30;
    const g = context.createLinearGradient(x, SEEDLING.y - 6, x, y1);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.2, c);
    g.addColorStop(1, 'rgba(255,255,255,0.1)');
    context.strokeStyle = g;
    context.lineWidth = 7;
    context.globalAlpha = 0.9;
    context.beginPath();
    context.moveTo(x, SEEDLING.y - 6);
    context.lineTo(x, y1);
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = 'rgba(255,255,255,0.8)';
    context.beginPath();
    context.arc(x, y1, 6, 0, Math.PI * 2);
    context.fill();
  }

  function drawEffects(state) {
    if (state.flash) {
      const c = colorOf(state.flash.color);
      context.globalAlpha = Math.max(0, state.flash.t / 0.18);
      context.fillStyle = c.core;
      context.beginPath();
      context.arc(state.flash.x, state.flash.y, GRID.radius * 1.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    if (state.zap) {
      const c = colorOf(state.zap.color);
      context.globalAlpha = Math.max(0, state.zap.t / 0.14);
      context.fillStyle = c.fill;
      context.beginPath();
      context.arc(state.zap.x, state.zap.y0, GRID.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    if (state.comet) {
      const k = state.comet.t;
      context.globalAlpha = 1 - k * 0.4;
      context.fillStyle = '#ffe066';
      context.beginPath();
      context.arc(state.comet.x, state.comet.y, 10 - k * 4, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
  }

  function drawHud(state, best) {
    text(`Score ${state.score}`, 28, 30, 30, PALETTE.text, 'left', '700');
    text(`Wave ${state.wave} / ${WIN_WAVES}`, FIELD.width / 2, 30, 30, PALETTE.text, 'center', '700');
    text(`Best ${best}`, FIELD.width - 28, 30, 30, PALETTE.text, 'right', '700');
    // Lives as glowing buds.
    const budColor = PALETTE.soilLine;
    for (let i = 0; i < LIVES; i += 1) {
      const x = FIELD.width - 28 - (LIVES - 1 - i) * 34;
      const alive = i < state.lives;
      context.globalAlpha = alive ? 1 : 0.22;
      context.fillStyle = budColor;
      context.beginPath();
      context.arc(x, 64, 10, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    // The pulse strip: current colour large, the next two smaller and dimmer.
    const qx = 28;
    for (let i = 0; i < state.queue.length; i += 1) {
      const kind = state.queue[i];
      const c = colorOf(kind);
      const isNow = i === 0;
      const cx = qx + i * 60 + (isNow ? 20 : 0);
      const cy = 66;
      const r = isNow ? 20 : 13;
      context.fillStyle = c.fill;
      context.globalAlpha = isNow ? 1 : 0.5;
      context.beginPath();
      context.arc(cx, cy, r, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      if (isNow) {
        context.strokeStyle = '#fff';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(cx, cy, r + 4, 0, Math.PI * 2);
        context.stroke();
      }
    }
    if (state.combo > 1) {
      text(`Combo ×${state.combo}`, qx, 108, 22, PALETTE.gold, 'left', '700');
    }
  }

  function drawTitle(state, best) {
    const lines = [
      'Blossoms drift toward the soil. Your pulse cycles their colours.',
      'Aim with ← → or the mouse — fire with W, ↑, Space or click.',
      'Zap the lowest blossom of the pulse colour before it roots.',
      'Clear all nine waves to save the orchard.',
    ];
    drawPanel('Pulse Orchard', lines, `Best ${best}  ·  Press Space or click to begin`);
  }

  function drawMessage(state) {
    if (!state.message) return;
    const alpha = Math.min(1, state.messageTimer * 2);
    text(state.message.text, FIELD.width / 2, 150, 30, state.message.color, 'center', '700', alpha);
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(13,17,31,0.9)';
    roundRect(x, y, PANEL.width, height, 20);
    context.fill();
    context.strokeStyle = PALETTE.panelLine;
    context.lineWidth = 2;
    roundRect(x, y, PANEL.width, height, 20);
    context.stroke();
    text(title, FIELD.width / 2, y + 92, 56, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + 40 + i * PANEL.line, 24, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 40, 26, PALETTE.gold, 'center', '700');
  }

  function draw(state, screen, best, allCells) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (state.shake > 0) {
      context.translate((Math.random() - 0.5) * state.shake * 14, (Math.random() - 0.5) * state.shake * 14);
    }
    drawSky();
    for (const cell of allCells) if (!cell.dead && cell.active) drawBlossom(cell);
    drawSoil();
    drawSeedling(state);
    drawBeam(state);
    drawEffects(state);

    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state, best);
    drawMessage(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The orchard waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('The orchard has rooted', [`Score ${state.score}`, `Best ${best}`, `Reached wave ${state.wave} of ${WIN_WAVES}`], 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('The orchard is saved!', [`Score ${state.score}`, `Best ${best}`, `Lives kept ${state.lives}  ·  Stars ${state.stars}`], 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
