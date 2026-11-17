// Keyboard and mouse input for Vice Shores: held keys for movement and driving,
// edge-triggered actions the loop consumes once per press.
export const ACT_ENTER = 1;
export const ACT_PUNCH = 2;
export const ACT_PAUSE = 4;
export const ACT_CONFIRM = 8;
export const ACT_HORN = 16;

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;

  function onDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE') queued |= ACT_ENTER;
    if (e.code === 'Space') queued |= ACT_PUNCH;
    if (e.code === 'KeyP' || e.code === 'Escape') queued |= ACT_PAUSE;
    if (e.code === 'Enter') queued |= ACT_CONFIRM;
    if (e.code === 'KeyH') queued |= ACT_HORN;
  }

  function onUp(e) {
    keys.delete(e.code);
  }

  function onClick() {
    queued |= ACT_CONFIRM;
  }

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  canvas.addEventListener('mousedown', onClick);
  window.addEventListener('blur', () => keys.clear());

  return {
    // Walk vector from WASD / arrows, normalised.
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    throttle() {
      return keys.has('KeyW') || keys.has('ArrowUp');
    },
    brake() {
      return keys.has('KeyS') || keys.has('ArrowDown');
    },
    steer() {
      let s = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      return s;
    },
    takeActions() {
      const a = queued;
      queued = 0;
      return a;
    },
  };
}
