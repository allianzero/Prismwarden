// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed time, steered by an autopilot,
// so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
/** The play scene scans this long and keeps its busiest second. */
const PLAY_SCAN_SECONDS = 30;
const END_GOOD_SECONDS = 12;
const END_LIMIT_SECONDS = 180;
const SAMPLE = STEP;

/** Steer toward the nearest enemy, keep a little distance, always fire. */
function pilotPlay(state) {
  const player = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = enemy;
    }
  }
  if (!nearest) {
    return { move: { x: 0, y: -0.4 }, aim: { x: FIELD.width / 2, y: FIELD.height / 4 }, firing: false };
  }
  const dx = nearest.x - player.x;
  const dy = nearest.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  // Close in when far, back off when close, strafe while shooting.
  const radial = nearestD > 280 ? 1 : nearestD < 150 ? -1 : 0;
  const strafe = Math.sin(state.time * 1.7) * 0.7;
  let mx = (dx / d) * radial + (-dy / d) * strafe;
  let my = (dy / d) * radial + (dx / d) * strafe;
  // Stay clear of the HUD strip at the top so the frame reads cleanly.
  if (player.y < 130) my += 0.9;
  const ml = Math.hypot(mx, my) || 1;
  return { move: { x: mx / ml, y: my / ml }, aim: { x: nearest.x, y: nearest.y }, firing: nearestD < 560 };
}

/** Stand still and never fire: the end scene's warden gives up. */
function pilotIdle(state) {
  return { move: { x: 0, y: 0 }, aim: { x: state.player.x, y: state.player.y - 100 }, firing: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end' && name !== 'upgrade') {
    for (let t = 0; t < START_SECONDS; t += SAMPLE) {
      world.step(SAMPLE, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, firing: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'upgrade') {
    // Verification scene (not a submitted shot): play until the first wave
    // clears, so the upgrade cards are on screen.
    for (let t = 0; t < 120 && !state.over; t += SAMPLE) {
      if (state.waveState === 'between' && state.upgradeChoices.length > 0) break;
      const events = world.step(SAMPLE, pilotPlay(state), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'play') {
    // Scan forward and keep the busiest frame: after every step, if more
    // enemies and bolts are on screen than in any frame so far, snapshot
    // the state, so the screenshot shows the fight at its liveliest
    // rather than a wave's tail.
    let bestSnap = null;
    let bestCount = -1;
    for (let t = 0; t < PLAY_SCAN_SECONDS && !state.over; t += SAMPLE) {
      if (state.waveState === 'between' && state.upgradeChoices.length > 0) {
        world.applyUpgrade(state.upgradeChoices[0].id);
        continue;
      }
      const events = world.step(SAMPLE, pilotPlay(state), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      const count = state.enemies.length + state.bolts.length;
      if (count > bestCount) {
        bestCount = count;
        bestSnap = structuredClone(state);
      }
    }
    if (bestSnap) {
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, bestSnap);
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  // End: play well for a while to earn a score, then give up and fall.
  for (let t = 0; t < END_GOOD_SECONDS; t += SAMPLE) {
    if (state.waveState === 'between' && state.upgradeChoices.length > 0) {
      world.applyUpgrade(state.upgradeChoices[0].id);
      continue;
    }
    const events = world.step(SAMPLE, pilotPlay(state), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  for (let t = 0; t < END_LIMIT_SECONDS && !state.over; t += SAMPLE) {
    if (state.waveState === 'between' && state.upgradeChoices.length > 0) {
      world.applyUpgrade(state.upgradeChoices[0].id);
      continue;
    }
    world.step(SAMPLE, pilotIdle(state), false);
  }
  return { screen: SCREEN_OVER, best: state.score };
}
