// Keyboard input: held keys for movement and driving, and one-shot actions
// (enter car, attack, pause, confirm) that the loop consumes once each.

export const ACTION_ENTER = 1;
export const ACTION_ATTACK = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function onDown(event) {
    const k = keyOf(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(k);
    if (k === 'e') actions |= ACTION_ENTER;
    if (k === ' ') actions |= ACTION_ATTACK;
    if (k === 'p' || k === 'Escape') actions |= ACTION_PAUSE;
    if (k === 'Enter' || k === ' ') actions |= ACTION_CONFIRM;
  }

  function onUp(event) {
    keys.delete(keyOf(event));
  }

  function onClick() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  canvas.addEventListener('pointerdown', onClick);

  return {
    /** Normalised -1..1 movement vector from WASD / arrows. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    get up() { return keys.has('w') || keys.has('ArrowUp'); },
    get down() { return keys.has('s') || keys.has('ArrowDown'); },
    get left() { return keys.has('a') || keys.has('ArrowLeft'); },
    get right() { return keys.has('d') || keys.has('ArrowRight'); },
    get run() { return keys.has('Shift'); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
