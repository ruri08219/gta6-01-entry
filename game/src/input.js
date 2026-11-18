// Keyboard + mouse input state shared by the player controller and HUD.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDown = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.clicked = false; // one-shot: consumed by the shooter each frame
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.clicked = true;
      this._lx = e.clientX; this._ly = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.dragDX += e.clientX - (this._lx || e.clientX);
      this.dragDY += e.clientY - (this._ly || e.clientY);
      this._lx = e.clientX; this._ly = e.clientY;
    });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
  }

  get forward() { return this.keys['KeyW'] || this.keys['ArrowUp']; }
  get back() { return this.keys['KeyS'] || this.keys['ArrowDown']; }
  get left() { return this.keys['KeyA'] || this.keys['ArrowLeft']; }
  get right() { return this.keys['KeyD'] || this.keys['ArrowRight']; }
  get run() { return this.keys['ShiftLeft'] || this.keys['ShiftRight']; }
  get jump() { return this.keys['Space']; }
  get interact() { return this.keys['KeyE']; }

  consumeClick() { const c = this.clicked; this.clicked = false; return c; }
  consumeDrag() { const dx = this.dragDX, dy = this.dragDY; this.dragDX = 0; this.dragDY = 0; return { dx, dy }; }
}
