// Synthesized WebAudio sound: engine, sirens, gunshots, pickups and a
// looping bass-and-hats groove. No audio files — everything is generated.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.startEngine();
      this.startMusic();
      return true;
    } catch (e) {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.ctx.suspend();
    if (!this.muted && this.ctx) this.ctx.resume();
    return this.muted;
  }

  // --- engine: two detuned saws through a lowpass, pitch follows speed ---
  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 28;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filt);
    osc2.connect(filt);
    filt.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    osc2.start();
    this.engineOsc2 = osc2;
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx || !this.engineGain) return;
    const f = 55 + speedNorm * 160;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.08);
    const g = driving ? 0.045 + speedNorm * 0.05 : 0.0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : g, this.ctx.currentTime, 0.1);
  }

  // --- one-shot effects ---
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  shoot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.15);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, 22050, 44100);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.3;
    src.connect(filt); filt.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  }

  sirenBlip() { this.blip(880, 0.18, 'sine', 0.06); }

  pickup() { this.blip(660, 0.12, 'sine', 0.18); setTimeout(() => this.blip(990, 0.18, 'sine', 0.18), 90); }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110));
  }

  // --- music: 8-step bass line + hats, sun-soaked funk groove ---
  startMusic() {
    const bass = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4]; // A1 C2 E2 D2
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep++ % 8;
      if (bass[step]) this.blip(bass[step], 0.22, 'triangle', 0.10);
      if (step % 2 === 0) this.blip(6000, 0.03, 'square', 0.015);
    }, 240);
  }
}
