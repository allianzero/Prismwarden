// PRISMWARDEN — every tuning number and colour in one place.
// The arena is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run holds; clearing the last one wins the game. */
export const TOTAL_WAVES = 8;

export const PLAYER = {
  radius: 16,
  speed: 300,
  maxHp: 100,
  fireInterval: 0.16,
  boltSpeed: 720,
  boltDamage: 12,
  boltRadius: 5,
  invulnerable: 1.0,
  pickupRadius: 26,
};

/** Enemy kinds, each with its own behaviour, colour and threat. */
export const ENEMIES = {
  darter: { radius: 13, hp: 20, speed: 210, damage: 8, score: 50, color: '#ff4fd8', shape: 'dart' },
  bulwark: { radius: 26, hp: 110, speed: 70, damage: 18, score: 120, color: '#ffb020', shape: 'hex' },
  spitter: { radius: 15, hp: 36, speed: 110, damage: 10, score: 100, color: '#ff5a4e', shape: 'tri', shootInterval: 2.2, orbSpeed: 260, orbDamage: 10 },
  splitter: { radius: 17, hp: 30, speed: 150, damage: 10, score: 80, color: '#2ee6ff', shape: 'quad', splitsInto: 2 },
  mote: { radius: 9, hp: 10, speed: 260, damage: 5, score: 25, color: '#8affc1', shape: 'dot' },
};

/** Enemy orbs (spitter shots) and the player's bolts share this shape. */
export const ORB = { radius: 7 };

/** How a wave is built: budget grows, mix widens, and the pause between waves. */
export const WAVE = {
  baseBudget: 6,
  budgetPerWave: 5,
  spawnInterval: 0.7,
  betweenSeconds: 4,
};

/** Upgrades offered between waves: pick one, it lasts the run. */
export const UPGRADES = [
  { id: 'split', name: 'PRISM SPLIT', desc: '+1 beam, fanned out', color: '#2ee6ff' },
  { id: 'rapid', name: 'OVERDRIVE', desc: '+25% fire rate', color: '#ff4fd8' },
  { id: 'damage', name: 'LANCE', desc: '+40% beam damage', color: '#ffb020' },
  { id: 'shield', name: 'AEGIS', desc: 'A shield that blocks one hit, recharges each wave', color: '#8affc1' },
  { id: 'swift', name: 'SLIPSTREAM', desc: '+18% move speed', color: '#c792ff' },
  { id: 'vitality', name: 'HEARTLIGHT', desc: '+25 max HP and heal 25', color: '#ff5a4e' },
];

/** The prism pickup: beams fan in 5 directions while it lasts. */
export const PRISM = { radius: 14, duration: 12, dropChance: 0.22 };

/** Particles, floating score text and screen shake. */
export const FX = {
  particleLife: 0.55,
  shakeOnHit: 7,
  shakeOnDeath: 12,
  shakeDecay: 26,
};

export const PALETTE = {
  backdrop: '#0b0a1e',
  arena: '#141231',
  arenaEdge: '#2a2560',
  grid: '#1e1a45',
  player: '#2ee6ff',
  bolt: '#aef7ff',
  text: '#f2f4ff',
  muted: '#9a94c7',
  panel: '#1a1740',
  panelEdge: '#3d3480',
  gold: '#ffd166',
  danger: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'prismwarden.best';
