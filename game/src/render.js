// Everything on the canvas: the arena, the warden, the enemies, the bolts,
// the particles, the HUD and the four screens (title, play, upgrade, over).
// The playfield is a fixed 1280x720 logical area, letterboxed to the window.

import { ENEMIES, FIELD, ORB, PALETTE, PLAYER, PRISM, TOTAL_WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const CARD_W = 300;
const CARD_H = 170;
const CARD_GAP = 36;

/** The three upgrade cards' rectangles, in logical coordinates. */
export function upgradeCardRects() {
  const total = CARD_W * 3 + CARD_GAP * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 300;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (CARD_W + CARD_GAP), y, w: CARD_W, h: CARD_H }));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    return { scale, ox, oy, dpr };
  }

  function poly(x, y, radius, sides, rotation) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = rotation + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function glowCircle(x, y, radius, color, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(state, time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Arena floor.
    ctx.fillStyle = PALETTE.arena;
    ctx.fillRect(8, 8, FIELD.width - 16, FIELD.height - 16);
    // Grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 88; x < FIELD.width; x += 80) {
      ctx.moveTo(x, 8);
      ctx.lineTo(x, FIELD.height - 8);
    }
    for (let y = 88; y < FIELD.height; y += 80) {
      ctx.moveTo(8, y);
      ctx.lineTo(FIELD.width - 8, y);
    }
    ctx.stroke();
    // The great prism at the arena's heart, turning slowly.
    const cx = FIELD.width / 2;
    const cy = FIELD.height / 2;
    glowCircle(cx, cy, 190 + Math.sin(time * 0.8) * 14, '#2ee6ff', 0.10);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.12);
    ctx.strokeStyle = '#2ee6ff';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    poly(0, 0, 46, 4, 0);
    ctx.stroke();
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = 0.2;
    poly(0, 0, 30, 4, 0);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Arena edge.
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, FIELD.width - 16, FIELD.height - 16);
  }

  function drawPlayer(player, time) {
    if (player.invuln > 0 && Math.floor(time * 14) % 2 === 0) return; // blink while invulnerable
    const { x, y } = player;
    ctx.save();
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 22;
    ctx.translate(x, y);
    ctx.rotate(player.angle);
    ctx.fillStyle = PALETTE.player;
    poly(0, 0, PLAYER.radius, 4, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0a1e';
    poly(0, 0, PLAYER.radius * 0.55, 4, 0);
    ctx.fill();
    // Barrel.
    ctx.fillStyle = '#aef7ff';
    ctx.fillRect(PLAYER.radius - 2, -3, 20, 6);
    ctx.restore();
    if (player.shield) {
      ctx.strokeStyle = '#8affc1';
      ctx.globalAlpha = 0.7 + Math.sin(time * 5) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (player.prismTime > 0) {
      ctx.strokeStyle = '#ff4fd8';
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius + 18, time * 2, time * 2 + Math.PI * 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemy(enemy, time) {
    const def = ENEMIES[enemy.kind];
    const { x, y } = enemy;
    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 16;
    ctx.translate(x, y);
    const spin = enemy.kind === 'splitter' ? time * 1.6 : 0;
    ctx.rotate(spin);
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : def.color;
    if (def.shape === 'dart') {
      const a = Math.atan2(enemy.y - 360, enemy.x - 640);
      ctx.rotate(a);
      poly(0, 0, def.radius, 3, 0);
    } else if (def.shape === 'hex') {
      poly(0, 0, def.radius, 6, 0);
    } else if (def.shape === 'tri') {
      poly(0, 0, def.radius, 3, -Math.PI / 2);
    } else if (def.shape === 'quad') {
      poly(0, 0, def.radius, 4, Math.PI / 4);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(11,10,30,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, def.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Health bar over hurt enemies.
    if (enemy.hp < enemy.maxHp) {
      const w = def.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2, y - def.radius - 12, w, 5);
      ctx.fillStyle = def.color;
      ctx.fillRect(x - w / 2, y - def.radius - 12, w * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawBolt(bolt) {
    ctx.save();
    ctx.shadowColor = '#aef7ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#eafcff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bolt.x - bolt.vx * 0.014, bolt.y - bolt.vy * 0.014);
    ctx.lineTo(bolt.x, bolt.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawOrb(orb, time) {
    glowCircle(orb.x, orb.y, ORB.radius + 10, '#ff5a4e', 0.5);
    ctx.fillStyle = '#ff8a7a';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, ORB.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPickup(pickup, time) {
    const pulse = 1 + Math.sin(time * 6) * 0.12;
    glowCircle(pickup.x, pickup.y, 42, '#2ee6ff', 0.55);
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(time * 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#2ee6ff';
    poly(0, 0, PRISM.radius, 4, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    poly(0, 0, PRISM.radius * 0.45, 4, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.textAlign = 'center';
    ctx.font = '700 22px system-ui, sans-serif';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawHud(state) {
    const player = state.player;
    // Health bar.
    ctx.textAlign = 'left';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('HP', 28, 44);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(70, 26, 220, 22);
    const hpFrac = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpFrac > 0.5 ? '#2ee6ff' : hpFrac > 0.25 ? '#ffd166' : '#ff5a4e';
    ctx.fillRect(70, 26, 220 * hpFrac, 22);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 26, 220, 22);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 300, 44);
    if (player.shield) {
      ctx.fillStyle = '#8affc1';
      ctx.fillText('AEGIS', 430, 44);
    }
    if (player.prismTime > 0) {
      ctx.fillStyle = '#ff4fd8';
      ctx.fillText(`PRISM ${Math.ceil(player.prismTime)}s`, 510, 44);
    }
    // Score, centre.
    ctx.textAlign = 'center';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${state.score}`, FIELD.width / 2, 44);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('SCORE', FIELD.width / 2, 64);
    // Wave, right.
    ctx.textAlign = 'right';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`WAVE ${Math.min(state.wave, TOTAL_WAVES)} / ${TOTAL_WAVES}`, FIELD.width - 28, 44);
    const left = state.spawnQueue.length + state.enemies.length;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(state.waveState === 'between' ? 'CHOOSE AN UPGRADE' : `${left} HOSTILES LEFT`, FIELD.width - 28, 64);
    // Wave progress dots, bottom centre.
    for (let i = 0; i < TOTAL_WAVES; i += 1) {
      ctx.fillStyle = i < state.wave - (state.waveState === 'between' ? 0 : 1) ? '#2ee6ff' : i === state.wave - 1 ? '#ffd166' : '#3d3480';
      ctx.beginPath();
      ctx.arc(FIELD.width / 2 - 70 + i * 20, FIELD.height - 24, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(11,10,30,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#2ee6ff';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#eafcff';
    ctx.font = '800 96px system-ui, sans-serif';
    ctx.fillText('PRISMWARDEN', FIELD.width / 2, 250);
    ctx.restore();
    ctx.fillStyle = '#ff4fd8';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText('HOLD THE LIGHT  ·  BREAK THE DARK', FIELD.width / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText('WASD move  ·  Mouse aim  ·  Hold click to fire light', FIELD.width / 2, 360);
    ctx.fillText('Clear all 8 waves. Between waves, pick 1 of 3 upgrades.', FIELD.width / 2, 392);
    ctx.fillText('Grab prisms to fan your beam five ways.', FIELD.width / 2, 424);
    ctx.save();
    ctx.globalAlpha = 0.65 + Math.sin(state.time * 3) * 0.35;
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 500);
    ctx.restore();
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillText(`BEST SCORE  ${best}`, FIELD.width / 2, 552);
    }
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(11,10,30,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(`WAVE ${state.wave} CLEAR`, FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText('CHOOSE AN UPGRADE  —  press 1, 2 or 3, or click a card', FIELD.width / 2, 256);
    const rects = upgradeCardRects();
    state.upgradeChoices.forEach((up, i) => {
      const r = rects[i];
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = up.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = up.color;
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText(up.name, r.x + r.w / 2, r.y + 58);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '400 19px system-ui, sans-serif';
      ctx.fillText(up.desc, r.x + r.w / 2, r.y + 96);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 138);
    });
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(11,10,30,0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    if (state.won) {
      ctx.save();
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 34;
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 88px system-ui, sans-serif';
      ctx.fillText('VICTORY!', FIELD.width / 2, 270);
      ctx.restore();
      ctx.fillStyle = PALETTE.text;
      ctx.font = '400 26px system-ui, sans-serif';
      ctx.fillText('All eight waves broken. The prism shines on.', FIELD.width / 2, 322);
    } else {
      ctx.save();
      ctx.shadowColor = '#ff5a4e';
      ctx.shadowBlur = 34;
      ctx.fillStyle = '#ff8a7a';
      ctx.font = '800 88px system-ui, sans-serif';
      ctx.fillText('GAME OVER', FIELD.width / 2, 270);
      ctx.restore();
      ctx.fillStyle = PALETTE.text;
      ctx.font = '400 26px system-ui, sans-serif';
      ctx.fillText(`The dark took the warden on wave ${state.wave}.`, FIELD.width / 2, 322);
    }
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.fillText(`${state.score}`, FIELD.width / 2, 410);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(`SCORE    ·    BEST ${Math.max(best, state.score)}    ·    ${state.kills} KILLS`, FIELD.width / 2, 452);
    ctx.save();
    ctx.globalAlpha = 0.65 + Math.sin(state.time * 3) * 0.35;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 520);
    ctx.restore();
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(11,10,30,0.7)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, 360);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText('Press P or click to keep playing', FIELD.width / 2, 404);
  }

  function draw(state, screen, best) {
    const { scale, ox, oy } = fit();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05040f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.setTransform(scale, 0, 0, scale, ox + shakeX * scale, oy + shakeY * scale);
    drawBackground(state, state.time);
    for (const pickup of state.pickups) drawPickup(pickup, state.time);
    for (const bolt of state.bolts) drawBolt(bolt);
    for (const orb of state.orbs) drawOrb(orb, state.time);
    for (const enemy of state.enemies) drawEnemy(enemy, state.time);
    if (!state.over || state.won) drawPlayer(state.player, state.time);
    else if (screen !== SCREEN_OVER) drawPlayer(state.player, state.time);
    drawParticles(state);
    drawTexts(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_PLAY && state.waveState === 'between') drawUpgrade(state);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state, best);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw };
}
