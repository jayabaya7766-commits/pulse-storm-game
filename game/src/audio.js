// All sound and music is synthesized with the Web Audio API — no audio files. unlock() is called on
// the first gesture (browsers block audio before one). Sounds are short envelopes on oscillators
// patched through a master gain; a quiet pentatonic loop runs under the game when music is on.
let ctx = null;
let master = null;
let musicBus = null;
let musicTimer = null;
let nextNote = 0;
let step = 0;
let muted = false;

const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const PATTERN = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 5, 6, 5, 4, 2];
const STEP_SECONDS = 0.28;

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One short tone: `from`/`to` frequencies in Hz, `dur` seconds, `gain` peak, `type` oscillator. */
function tone({ from, to, dur = 0.12, gain = 0.12, type = 'sine', when = 0, music = false }) {
  const c = ensureContext();
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, from), t);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(music ? musicBus : master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function scheduleMusic() {
  const c = ctx;
  while (nextNote < c.currentTime + 0.35) {
    const note = SCALE[PATTERN[step % PATTERN.length]];
    tone({ from: note, dur: STEP_SECONDS * 0.9, gain: 0.5, type: 'triangle', when: nextNote - c.currentTime, music: true });
    if (step % 8 === 0) tone({ from: note / 2, dur: STEP_SECONDS * 3, gain: 0.35, type: 'sine', when: nextNote - c.currentTime, music: true });
    nextNote += STEP_SECONDS;
    step += 1;
  }
}

export function createAudio() {
  return {
    unlock() { ensureContext(); this.startMusic(); },
    startMusic() {
      if (musicTimer) return;
      ensureContext();
      nextNote = ctx.currentTime + 0.1;
      step = 0;
      musicTimer = setInterval(scheduleMusic, 90);
    },
    isMuted() { return muted; },
    setMuted(on) {
      muted = on;
      if (master) master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.01);
    },
    shoot() { tone({ from: 760, to: 480, dur: 0.07, gain: 0.08, type: 'square' }); },
    bloom(combo) {
      const f = 440 * Math.pow(2, (Math.min(combo, 12) - 1) / 12);
      tone({ from: f, dur: 0.14, gain: 0.16, type: 'sine' });
      tone({ from: f * 1.5, dur: 0.18, gain: 0.1, type: 'triangle', when: 0.02 });
    },
    wrong() { tone({ from: 130, to: 92, dur: 0.2, gain: 0.14, type: 'sawtooth' }); },
    star() {
      tone({ from: 300, to: 1400, dur: 0.28, gain: 0.12, type: 'sine' });
      tone({ from: 900, to: 1800, dur: 0.16, gain: 0.07, type: 'triangle', when: 0.03 });
    },
    wither() { tone({ from: 320, to: 110, dur: 0.34, gain: 0.16, type: 'sawtooth' }); },
    wave() { [523.25, 659.25, 784.0].forEach((f, i) => tone({ from: f, dur: 0.16, gain: 0.12, when: i * 0.07 })); },
    win() { [523.25, 659.25, 784.0, 1046.5, 1318.5].forEach((f, i) => tone({ from: f, dur: 0.24, gain: 0.13, when: i * 0.09 })); },
    over() { [392.0, 329.63, 261.63, 196.0].forEach((f, i) => tone({ from: f, to: f * 0.94, dur: 0.34, gain: 0.14, type: 'triangle', when: i * 0.16 })); },
    ui() { tone({ from: 620, to: 520, dur: 0.05, gain: 0.07, type: 'square' }); },
  };
}
