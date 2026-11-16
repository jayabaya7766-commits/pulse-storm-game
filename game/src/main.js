// Pulse Orchard — boot and the one loop. Input is read every frame; the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one) and the renderer paints what is there.
// The game moves between five screens: title, play, paused, game over and win. ?seed=N fixes the
// pattern; ?shot=start|play|win|over stages that scene for a screenshot and sets window.__shotReady.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { createWorld, EVENT_CLEAR, EVENT_MATCH, EVENT_OVER, EVENT_STAR, EVENT_WIN, EVENT_WRONG } from './world.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.cells);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let unlocked = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.lives} lives.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `You saved the orchard! Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function react(events) {
    if (events & EVENT_MATCH) audio.bloom(world.state.combo);
    if (events & EVENT_STAR) audio.star();
    if (events & EVENT_WRONG) audio.wrong();
    if (events & EVENT_CLEAR) audio.wave();
    if (events & EVENT_OVER) { audio.over(); endGame(false); }
    else if (events & EVENT_WIN) { audio.win(); endGame(true); }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      audio.ui();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function aimX() {
    const pointer = input.pointer();
    if (pointer.x !== null) {
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / FIELD.width;
      return (pointer.x - rect.left) / scale;
    }
    return world.state.aimX + input.direction() * 14;
  }

  function step() {
    const events = world.step(STEP, aimX(), input.fireHeld());
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, FIELD.width / 2, false); // ambient blossoms drift on the title
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.cells);
  }

  // The first gesture unlocks audio, as browsers require, and starts music.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    audio.unlock();
  }
  canvas.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Pulse Orchard. Zap the blossoms of the pulse colour before they root.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
