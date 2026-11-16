// Keyboard and mouse: WASD or arrows to move, mouse to aim, hold the mouse
// button (or Space) to fire. Number keys and clicks pick upgrades; Space,
// Enter or a click confirms on the title and end screens; P pauses.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let actions = 0;
  let upgradePick = 0;

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (key === ' ' || key === 'Enter') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'Escape') actions |= ACTION_PAUSE;
    if (key === '1' || key === '2' || key === '3') upgradePick = Number(key);
    keys.add(key);
  }

  function onKeyUp(event) {
    keys.delete(keyOf(event));
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    /** Normalised movement vector from WASD / arrows, {x, y}. */
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** Aim point in canvas pixels. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown || keys.has(' ');
    },
    /** Actions since the last call, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Upgrade number picked since the last call (1-3), then cleared. */
    takeUpgradePick() {
      const picked = upgradePick;
      upgradePick = 0;
      return picked;
    },
  };
}
