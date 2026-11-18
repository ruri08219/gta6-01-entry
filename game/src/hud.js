// HUD: cash, health, wanted stars, mission tracker, message feed and a
// live 2D minimap (player, cars, police, mission marker) drawn on canvas.
import { DEBT_TOTAL } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      cash: document.getElementById('hud-cash'),
      debt: document.getElementById('hud-debt'),
      health: document.getElementById('hud-health-fill'),
      stars: document.getElementById('hud-stars'),
      mission: document.getElementById('hud-mission'),
      missionTitle: document.getElementById('hud-mission-title'),
      feed: document.getElementById('hud-feed'),
      speed: document.getElementById('hud-speed'),
      hint: document.getElementById('hud-hint'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
  }

  setCash(cash, debtPaid) {
    this.el.cash.textContent = '$' + cash.toLocaleString();
    this.el.debt.textContent = 'Debt left: $' + (DEBT_TOTAL - debtPaid).toLocaleString();
  }

  setHealth(h) {
    this.el.health.style.width = Math.max(0, h) + '%';
    this.el.health.style.background = h > 50 ? '#37c24a' : h > 25 ? '#f2c230' : '#e03a2a';
  }

  setWanted(level) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < level ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.style.color = level > 0 ? '#ffd23d' : '#ffffff88';
  }

  setMission(title, objective) {
    this.el.missionTitle.textContent = title;
    this.el.mission.textContent = objective;
  }

  setSpeed(kmh, driving) {
    this.el.speed.textContent = driving ? Math.round(kmh) + ' km/h' : '';
  }

  message(text, ms) {
    const div = document.createElement('div');
    div.className = 'feed-line';
    div.textContent = text;
    this.el.feed.prepend(div);
    while (this.el.feed.children.length > 4) this.el.feed.lastChild.remove();
    setTimeout(() => { div.style.opacity = '0.25'; }, ms || 6000);
  }

  // Top-down minimap: roads grey, beach sand, player white arrow,
  // traffic yellow dots, police flashing blue/red, mission marker gold.
  drawMap(state, city) {
    const ctx = this.mapCtx;
    const S = this.map.width;
    const half = city.half + 20;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1d3a2a';
    ctx.fillRect(0, 0, S, S);
    // Beach strip.
    const [bx] = toMap(city.half, 0);
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(bx, 0, S - bx, S);
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(bx + (S - bx) * 0.45, 0, S, S);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (const c of city.lines) {
      const [x0, z0] = toMap(c, -half);
      const [x1, z1] = toMap(c, half);
      ctx.beginPath(); ctx.moveTo(x0, z0); ctx.lineTo(x1, z1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, z0); ctx.lineTo(x1, z1); ctx.stroke();
      const [hx0, hz0] = toMap(-half, c);
      const [hx1, hz1] = toMap(half, c);
      ctx.beginPath(); ctx.moveTo(hx0, hz0); ctx.lineTo(hx1, hz1); ctx.stroke();
    }
    // Mission marker.
    if (state.missions.beaconTarget) {
      const t = state.missions.beaconTarget;
      const [mx, my] = toMap(t.x, t.z);
      ctx.fillStyle = '#ffc93d';
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#f2e13d';
    for (const c of state.traffic) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police dots.
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3333' : '#3388ff';
    for (const p of state.wanted.police) {
      const [x, y] = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.player.pos.x, state.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(-5.5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
