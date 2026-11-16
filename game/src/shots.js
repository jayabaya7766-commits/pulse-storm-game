// Pulse Orchard — the screenshot scenes behind ?shot=start|play|win|over. Each one drives the real
// rules forward from a fresh world with a small autopilot, so the frame is what a real game looks
// like and the same seed always gives the same frame. The play pilot zaps every blossom in time; the
// over pilot reacts late and eventually loses all its lives; the win pilot is nearly perfect and runs
// the whole orchard to the victory screen.
import { FIELD, GRID, STEP, WIN_WAVES } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 1.2; // let the first blossoms bloom on the title screen
const PLAY_SECONDS = 30;
const OVER_SECONDS = 60;

function aimFor(cell) {
  return cell ? cell.x : FIELD.width / 2;
}

/** The lowest blossom of the current pulse colour, wherever it is. */
function lowestOfColor(state, cells) {
  const color = state.queue[0];
  let target = null;
  let bestY = -Infinity;
  for (const cell of cells) {
    if (cell.dead || !cell.active) continue;
    if (cell.color !== color) continue;
    if (cell.y > bestY) { bestY = cell.y; target = cell; }
  }
  return target;
}

/** A decent pilot: aim at the lowest blossom of the pulse colour, hold fire while it is near. */
function playPilot(state, cells) {
  const target = lowestOfColor(state, cells);
  return { aimX: aimFor(target), fire: !!target && target.y > FIELD.soilY - 340 };
}

/** A nearly perfect pilot that never lets a real blossom reach the soil. */
function winPilot(state, cells) {
  const target = lowestOfColor(state, cells);
  return { aimX: aimFor(target), fire: !!target && target.y > GRID.topY };
}

/** A panicky pilot for the loss scene: only the leftmost column, late to react, misses everything. */
function overPilot(state, cells) {
  const color = state.queue[0];
  let target = null;
  for (const cell of cells) {
    if (cell.dead || !cell.active) continue;
    if (cell.col !== 0) continue; // only watch one column
    if (cell.color !== color) continue;
    target = cell;
  }
  // Fire only once a blossom has already reached the soil — too late to save it.
  return { aimX: target ? target.x : FIELD.width / 2, fire: !!target && target.y > FIELD.soilY - 30 };
}

/** Run the chosen pilot for a number of seconds; return the screen it ends on. */
function runPilot(world, pilot, seconds) {
  let won = false;
  let over = false;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const { aimX, fire } = pilot(world.state, world.cells);
    const events = world.step(STEP, aimX, fire);
    if (events & EVENT_WIN) { won = true; break; }
    if (events & EVENT_OVER) { over = true; break; }
  }
  if (won) return SCREEN_WIN;
  if (over || world.state.lives <= 0) return SCREEN_OVER;
  return SCREEN_PLAY;
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'win') {
    const screen = runPilot(world, winPilot, WIN_WAVES * 40);
    return { screen, best: world.state.score };
  }
  if (name === 'over') {
    const screen = runPilot(world, overPilot, OVER_SECONDS);
    return { screen, best: world.state.score };
  }
  if (name === 'play') {
    const screen = runPilot(world, playPilot, PLAY_SECONDS);
    return { screen, best: world.state.score };
  }
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, FIELD.width / 2, false);
  return { screen: SCREEN_TITLE, best: 0 };
}
