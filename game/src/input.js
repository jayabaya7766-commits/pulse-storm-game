// Keyboard, pointer and focus input. Held keys give a steering direction and a fire hold; one-shot
// presses (start/restart, pause, mute) are queued as bit flags and taken once by the loop, so a
// press between frames is never lost and never counted twice. The pointer reports its last client
// position and whether the button is down, so the mouse can aim and fire too.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE = new Set(['KeyW', 'ArrowUp']); // Space is handled below so it also confirms
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false;
  let right = false;
  let fireKey = false;
  let pointerDown = false;
  let actions = 0;
  let pointerX = null;
  let pointerY = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (event.code === 'Space') { fireKey = true; if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (FIRE.has(event.code)) fireKey = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (FIRE.has(event.code) || event.code === 'Space') fireKey = false;
  });

  window.addEventListener('blur', () => {
    left = false;
    right = false;
    fireKey = false;
    pointerDown = false;
  });

  target.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { pointerDown = false; });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() { return (right ? 1 : 0) - (left ? 1 : 0); },
    fireHeld() { return fireKey || pointerDown; },
    pointer() { return { x: pointerX, y: pointerY }; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
