// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play (with an upgrade pause between waves), paused and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_UPGRADE, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, upgradeCardRects } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
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
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Canvas-relative pixels to logical arena coordinates (the renderer letterboxes). */
function toLogical(canvasX, canvasY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
  const ox = (rect.width - FIELD.width * scale) / 2;
  const oy = (rect.height - FIELD.height * scale) / 2;
  return { x: (canvasX - ox) / scale, y: (canvasY - oy) / scale };
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let restartRequested = false;

  document.addEventListener('keydown', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'r') restartRequested = true;
    if (key === 'm') audio.toggleMusic();
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.wave();
    announce(`Playing. Wave 1 of 8.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (world.state.won) {
      audio.win();
      announce(`Victory! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.over();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function pickUpgrade(index) {
    const choices = world.state.upgradeChoices;
    if (index < 0 || index >= choices.length) return;
    world.applyUpgrade(choices[index].id);
    audio.upgrade();
    announce(`Upgrade: ${choices[index].name}. Wave ${world.state.wave}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    const pick = input.takeUpgradePick();
    if (screen === SCREEN_PLAY && world.state.waveState === 'between') {
      if (pick > 0) {
        pickUpgrade(pick - 1);
        return;
      }
      if (actions & ACTION_CONFIRM) {
        const aim = toLogical(input.aim().x, input.aim().y);
        const rects = upgradeCardRects();
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (aim.x >= r.x && aim.x <= r.x + r.w && aim.y >= r.y && aim.y <= r.y + r.h) {
            pickUpgrade(i);
            return;
          }
        }
      }
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (restartRequested) {
      restartRequested = false;
      if (screen === SCREEN_OVER) startGame();
    }
  }

  function playSounds(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_UPGRADE) audio.upgrade();
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_WIN) endGame();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, firing: false }, true);
      return;
    }
    if (screen === SCREEN_OVER) {
      world.step(STEP, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, firing: false }, false);
      return;
    }
    const rawAim = input.aim();
    const aim = toLogical(rawAim.x, rawAim.y);
    const events = world.step(STEP, { move: input.move(), aim, firing: input.firing() }, false);
    playSounds(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    audio.update();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_OVER) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_OVER)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting enemies close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The first gesture unlocks sound; the game starts on a click or Space.
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Prismwarden. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
