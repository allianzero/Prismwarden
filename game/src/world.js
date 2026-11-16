// PRISMWARDEN's simulation: the player, bolts, enemies, orbs, pickups and
// particles, in fixed 1/60 s steps. It knows nothing about the screen or
// the keyboard; main.js feeds it input and reads its state and events.

import { ENEMIES, FIELD, ORB, PLAYER, PRISM, STEP, TOTAL_WAVES, UPGRADES, WAVE } from './config.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_PICKUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_UPGRADE = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;

const TWO_PI = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    player: { x: 0, y: 0, hp: 0, maxHp: 0, angle: 0, fireTimer: 0, invuln: 0, shield: false, beams: 1, fireRateMul: 1, damageMul: 1, speedMul: 1, prismTime: 0 },
    enemies: [],
    bolts: [],
    orbs: [],
    pickups: [],
    particles: [],
    texts: [],
    wave: 0,
    waveState: 'fight',
    spawnQueue: [],
    spawnTimer: 0,
    betweenTimer: 0,
    upgradeChoices: [],
    score: 0,
    kills: 0,
    time: 0,
    shake: 0,
    over: false,
    won: false,
  };

  function reset() {
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height / 2;
    state.player.hp = PLAYER.maxHp;
    state.player.maxHp = PLAYER.maxHp;
    state.player.angle = -Math.PI / 2;
    state.player.fireTimer = 0;
    state.player.invuln = 0;
    state.player.shield = false;
    state.player.beams = 1;
    state.player.fireRateMul = 1;
    state.player.damageMul = 1;
    state.player.speedMul = 1;
    state.player.prismTime = 0;
    state.enemies.length = 0;
    state.bolts.length = 0;
    state.orbs.length = 0;
    state.pickups.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.wave = 0;
    state.spawnQueue.length = 0;
    state.spawnTimer = 0;
    state.betweenTimer = 0;
    state.upgradeChoices.length = 0;
    state.score = 0;
    state.kills = 0;
    state.time = 0;
    state.shake = 0;
    state.over = false;
    state.won = false;
    startWave();
  }

  /** Build the spawn list for a wave number and open the gates. */
  function startWave() {
    state.wave += 1;
    state.waveState = 'fight';
    const budget = WAVE.baseBudget + WAVE.budgetPerWave * (state.wave - 1);
    const queue = [];
    let spent = 0;
    const pool = ['darter'];
    if (state.wave >= 2) pool.push('splitter');
    if (state.wave >= 3) pool.push('spitter');
    if (state.wave >= 4) pool.push('bulwark');
    const cost = { darter: 1, splitter: 2, spitter: 3, bulwark: 4 };
    while (spent < budget) {
      const kind = random.pick(pool);
      if (spent + cost[kind] > budget + 2) break;
      queue.push(kind);
      spent += cost[kind];
    }
    // Shuffle the queue so the same kinds do not arrive in one clump.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = random.int(0, i);
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    state.spawnQueue = queue;
    state.spawnTimer = 0.4;
    addText(FIELD.width / 2, 120, `WAVE ${state.wave}`, '#ffd166');
  }

  function edgePoint() {
    const side = random.int(0, 3);
    const m = 30;
    if (side === 0) return { x: random.range(m, FIELD.width - m), y: m };
    if (side === 1) return { x: random.range(m, FIELD.width - m), y: FIELD.height - m };
    if (side === 2) return { x: m, y: random.range(m, FIELD.height - m) };
    return { x: FIELD.width - m, y: random.range(m, FIELD.height - m) };
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    let point = edgePoint();
    // Keep spawns away from the player so nothing appears on top of them.
    for (let tries = 0; tries < 8 && dist2(point.x, point.y, state.player.x, state.player.y) < 220 * 220; tries += 1) {
      point = edgePoint();
    }
    state.enemies.push({
      kind,
      x: point.x,
      y: point.y,
      hp: def.hp * (1 + 0.16 * (state.wave - 1)),
      maxHp: def.hp * (1 + 0.16 * (state.wave - 1)),
      speed: def.speed * (1 + 0.05 * (state.wave - 1)) * random.range(0.9, 1.1),
      shootTimer: random.range(1, def.shootInterval ?? 2),
      wobble: random.range(0, TWO_PI),
      flash: 0,
    });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, TWO_PI);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.55,
        maxLife: 0.55,
        color,
        size: random.range(2, 5),
      });
    }
  }

  function addText(x, y, text, color) {
    state.texts.push({ x, y, text, life: 0.9, maxLife: 0.9, color });
  }

  function fireBolts() {
    const player = state.player;
    const count = player.prismTime > 0 ? 5 : player.beams;
    const spread = 0.14;
    const base = player.angle - (spread * (count - 1)) / 2;
    for (let i = 0; i < count; i += 1) {
      const angle = base + spread * i;
      state.bolts.push({
        x: player.x + Math.cos(angle) * (PLAYER.radius + 6),
        y: player.y + Math.sin(angle) * (PLAYER.radius + 6),
        vx: Math.cos(angle) * PLAYER.boltSpeed,
        vy: Math.sin(angle) * PLAYER.boltSpeed,
        damage: PLAYER.boltDamage * player.damageMul,
      });
    }
    player.fireTimer = PLAYER.fireInterval / player.fireRateMul;
    burst(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, '#aef7ff', 3, 120);
  }

  function killEnemy(index, awardScore) {
    const enemy = state.enemies[index];
    const def = ENEMIES[enemy.kind];
    state.enemies.splice(index, 1);
    state.kills += 1;
    burst(enemy.x, enemy.y, def.color, enemy.kind === 'bulwark' ? 26 : 14, 260);
    if (awardScore) {
      state.score += def.score;
      addText(enemy.x, enemy.y - 10, `+${def.score}`, '#ffd166');
    }
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < def.splitsInto; i += 1) {
        state.enemies.push({
          kind: 'mote',
          x: enemy.x + random.range(-14, 14),
          y: enemy.y + random.range(-14, 14),
          hp: ENEMIES.mote.hp,
          maxHp: ENEMIES.mote.hp,
          speed: ENEMIES.mote.speed * random.range(0.9, 1.1),
          shootTimer: 0,
          wobble: random.range(0, TWO_PI),
          flash: 0,
        });
      }
    }
    if (random.next() < PRISM.dropChance) {
      state.pickups.push({ x: enemy.x, y: enemy.y, kind: 'prism', life: 9 });
    }
  }

  function damagePlayer(amount, fromX, fromY) {
    const player = state.player;
    if (player.invuln > 0 || state.over) return EVENT_HIT;
    if (player.shield) {
      player.shield = false;
      player.invuln = PLAYER.invulnerable;
      burst(player.x, player.y, '#8affc1', 18, 240);
      addText(player.x, player.y - 26, 'SHIELD!', '#8affc1');
      return EVENT_HIT;
    }
    player.hp -= amount;
    player.invuln = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 9);
    burst(player.x, player.y, '#ff5a4e', 16, 260);
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + (dx / d) * 26));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + (dy / d) * 26));
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
      state.won = false;
      burst(player.x, player.y, '#2ee6ff', 60, 420);
      burst(player.x, player.y, '#ff4fd8', 40, 320);
      state.shake = 16;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function chooseUpgrades() {
    const ids = UPGRADES.map((u) => u.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = random.int(0, i);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    state.upgradeChoices = ids.slice(0, 3).map((id) => UPGRADES.find((u) => u.id === id));
  }

  function applyUpgrade(id) {
    const player = state.player;
    if (id === 'split') player.beams = Math.min(4, player.beams + 1);
    if (id === 'rapid') player.fireRateMul *= 1.25;
    if (id === 'damage') player.damageMul *= 1.4;
    if (id === 'shield') player.shield = true;
    if (id === 'swift') player.speedMul *= 1.18;
    if (id === 'vitality') {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    }
    state.upgradeChoices = [];
    state.waveState = 'fight';
    startWave();
    return EVENT_UPGRADE;
  }

  function updatePlayer(dt, input) {
    const player = state.player;
    player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + input.move.x * PLAYER.speed * player.speedMul * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + input.move.y * PLAYER.speed * player.speedMul * dt));
    player.fireTimer -= dt;
    player.invuln = Math.max(0, player.invuln - dt);
    player.prismTime = Math.max(0, player.prismTime - dt);
    if (input.firing && player.fireTimer <= 0) return EVENT_SHOOT;
    return 0;
  }

  function updateEnemies(dt, harmless = false) {
    let events = 0;
    const player = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      const def = ENEMIES[enemy.kind];
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.wobble += dt * 3;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (enemy.kind === 'spitter') {
        // Keep its distance and lob orbs at the player.
        const want = d < 260 ? -1 : d > 340 ? 1 : 0;
        enemy.x += nx * enemy.speed * want * dt + Math.cos(enemy.wobble) * 24 * dt;
        enemy.y += ny * enemy.speed * want * dt + Math.sin(enemy.wobble) * 24 * dt;
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && d < 520) {
          enemy.shootTimer = def.shootInterval;
          state.orbs.push({ x: enemy.x, y: enemy.y, vx: nx * def.orbSpeed, vy: ny * def.orbSpeed, damage: def.orbDamage });
        }
      } else {
        const wob = enemy.kind === 'darter' ? 0.35 : 0.12;
        const mx = nx + Math.cos(enemy.wobble) * wob;
        const my = ny + Math.sin(enemy.wobble) * wob;
        const md = Math.hypot(mx, my) || 1;
        enemy.x += (mx / md) * enemy.speed * dt;
        enemy.y += (my / md) * enemy.speed * dt;
      }
      enemy.x = Math.min(FIELD.width - def.radius, Math.max(def.radius, enemy.x));
      enemy.y = Math.min(FIELD.height - def.radius, Math.max(def.radius, enemy.y));
      // Touching the player hurts (unless this is title-screen ambience).
      if (!harmless && dist2(enemy.x, enemy.y, player.x, player.y) < (def.radius + PLAYER.radius) * (def.radius + PLAYER.radius)) {
        events |= damagePlayer(def.damage, enemy.x, enemy.y);
        enemy.x -= nx * 30;
        enemy.y -= ny * 30;
      }
    }
    return events;
  }

  function updateBolts(dt) {
    let events = 0;
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = state.bolts[i];
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.x < 0 || bolt.x > FIELD.width || bolt.y < 0 || bolt.y > FIELD.height) {
        state.bolts.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        const def = ENEMIES[enemy.kind];
        const rr = def.radius + PLAYER.boltRadius;
        if (dist2(bolt.x, bolt.y, enemy.x, enemy.y) < rr * rr) {
          enemy.hp -= bolt.damage;
          enemy.flash = 0.12;
          burst(bolt.x, bolt.y, def.color, 4, 160);
          state.bolts.splice(i, 1);
          if (enemy.hp <= 0) {
            killEnemy(j, true);
            events |= EVENT_KILL;
          }
          break;
        }
      }
    }
    return events;
  }

  function updateOrbs(dt) {
    let events = 0;
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.x < 0 || orb.x > FIELD.width || orb.y < 0 || orb.y > FIELD.height) {
        state.orbs.splice(i, 1);
        continue;
      }
      const rr = ORB.radius + PLAYER.radius;
      if (dist2(orb.x, orb.y, state.player.x, state.player.y) < rr * rr) {
        state.orbs.splice(i, 1);
        events |= damagePlayer(orb.damage, orb.x - orb.vx, orb.y - orb.vy);
      }
    }
    return events;
  }

  function updatePickups(dt) {
    let events = 0;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      if (pickup.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      const rr = PRISM.radius + PLAYER.pickupRadius;
      if (dist2(pickup.x, pickup.y, state.player.x, state.player.y) < rr * rr) {
        state.pickups.splice(i, 1);
        state.player.prismTime = PRISM.duration;
        state.score += 25;
        addText(state.player.x, state.player.y - 30, 'PRISM x5!', '#2ee6ff');
        burst(pickup.x, pickup.y, '#2ee6ff', 20, 240);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function updateFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - 26 * dt);
  }

  function step(dt, input, attract) {
    let events = 0;
    state.time += dt;
    if (state.over) {
      updateFx(dt);
      return 0;
    }
    if (attract) {
      // Title screen ambience: enemies drift in and gather, nothing can hurt the player.
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy(state.spawnQueue.shift());
          state.spawnTimer = WAVE.spawnInterval;
        }
      }
      updateEnemies(dt, true);
      updateFx(dt);
      return 0;
    }
    if (state.waveState === 'between') {
      // The run waits here until the player picks one of the three upgrades.
      updateFx(dt);
      return 0;
    }
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = Math.max(0.3, WAVE.spawnInterval * Math.pow(0.94, state.wave - 1));
      }
    }
    const shoot = updatePlayer(dt, input);
    if (shoot) {
      fireBolts();
      events |= EVENT_SHOOT;
    }
    events |= updateEnemies(dt);
    events |= updateBolts(dt);
    events |= updateOrbs(dt);
    events |= updatePickups(dt);
    updateFx(dt);
    if (state.over) return events | EVENT_OVER;
    if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.waveState === 'fight') {
      const bonus = 100 * state.wave;
      state.score += bonus;
      addText(FIELD.width / 2, 150, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd166');
      events |= EVENT_WAVE;
      if (state.wave >= TOTAL_WAVES) {
        state.over = true;
        state.won = true;
        state.waveState = 'done';
        return events | EVENT_WIN;
      }
      state.waveState = 'between';
      chooseUpgrades();
    }
    return events;
  }

  return { state, reset, step, applyUpgrade, startWave };
}
