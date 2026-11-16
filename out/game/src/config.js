// Pulse Orchard — every tuning number, colour and bit of geometry in one place. The playfield is a
// fixed 1280x720 logical area the renderer scales to the window, so no rule below depends on the
// screen size.

export const FIELD = { width: 1280, height: 720, soilY: 636 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

// The grid of blossoms the seedling zaps: fixed columns, rows that descend toward the soil.
const COLS = 5;
const RADIUS = 34;
const SPACING = 200;
const SPAN = (COLS - 1) * SPACING + RADIUS * 2;
const LEFT = (FIELD.width - SPAN) / 2;

export const GRID = {
  cols: COLS,
  radius: RADIUS,
  spacing: SPACING,
  rowGap: 78,
  topY: 110,
  rowsBase: 2,
  rowsMax: 3,
  centers: Array.from({ length: COLS }, (_, i) => LEFT + RADIUS + i * SPACING),
};

export const SEEDLING = { y: FIELD.soilY - 40, speed: 640, snap: 44 };

export const SHOOT = { cooldown: 0.24, beamDuration: 0.13 };

export const DESCEND = { base: 16, perWave: 3, max: 32 };

export const LIVES = 3;
export const WIN_WAVES = 9;
export const TARGET_QUEUE = 3; // the pulse colour plus the two shown ahead
export const POINTS = { bloom: 10, star: 50, starClear: 10, comboStep: 2, lifeBonus: 100 };
export const STAR_CHANCE = 0.06; // off-waves may carry a bonus star; even waves get one for sure
export const AIM_RADIUS = 1.3; // times GRID.radius: how forgiving the beam's reach is

// The blossom colours, used in order as a wave adds more (3, then 4, 5, and 6).
export const COLORS = [
  { name: 'cyan', core: '#e6fbff', fill: '#4dd9ff', glow: '#0e8fbe' },
  { name: 'magenta', core: '#ffe6fa', fill: '#ff5bd6', glow: '#b4258f' },
  { name: 'gold', core: '#fff6d9', fill: '#ffcf4d', glow: '#c08a00' },
  { name: 'lime', core: '#eaffe8', fill: '#86ff7d', glow: '#2f9c2f' },
  { name: 'coral', core: '#ffe9e6', fill: '#ff7a6b', glow: '#c23a2a' },
  { name: 'violet', core: '#f3ecff', fill: '#c49bff', glow: '#7a45c9' },
];

// The sentinel colour index of a bonus star: one past the last real colour, so it can never clash.
export const STAR_KIND = COLORS.length;
export const STAR_COLOR = { core: '#fffdf2', fill: '#ffe27a', glow: '#c99a00' };

export const activeColorCount = (wave) => Math.min(COLORS.length, 3 + Math.floor((wave - 1) / 2));
export const descendSpeed = (wave) => Math.min(DESCEND.max, DESCEND.base + DESCEND.perWave * (wave - 1));

export const PALETTE = {
  backdrop: '#080a14',
  skyTop: '#0b0d1c',
  skyBottom: '#1a1e34',
  panelLine: '#2a3050',
  text: '#eef1f8',
  muted: '#8b93a8',
  gold: '#ffcf4d',
  soil: '#0d1410',
  soilLine: '#2fe0a8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'pulse-orchard.best';
