// Drawing only: the city, the people and cars in it, the HUD with its minimap,
// and the title / pause / game-over screens. The camera follows the player;
// everything is drawn in world space, the HUD in screen space.
import { BEACH_X, GRID, ROAD_EVERY, SEA_X, TILE, WORLD, isBeachTile, isRoadTile, isSeaTile } from './city.js';
import { missionByIndex, objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_STORY = 'story';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = 176;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * ratio);
    canvas.height = Math.round(viewH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(state, cam, vw, vh) {
    const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / TILE) - 1);
    const x1 = Math.min(GRID - 1, Math.floor((cam.x + vw / 2) / TILE) + 1);
    const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / TILE) - 1);
    const y1 = Math.min(GRID - 1, Math.floor((cam.y + vh / 2) / TILE) + 1);
    const t = state.elapsed;

    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        const px = tx * TILE;
        const py = ty * TILE;
        if (isSeaTile(tx, ty)) {
          ctx.fillStyle = '#2a7f9e';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          const wob = Math.sin(t * 1.4 + tx * 0.7 + ty) * 6;
          ctx.fillRect(px, py + 12 + wob, TILE, 2);
          ctx.fillRect(px, py + 32 - wob, TILE, 2);
          continue;
        }
        if (isBeachTile(tx, ty)) {
          ctx.fillStyle = '#ecd9a0';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(180,150,90,0.5)';
          ctx.fillRect(px, py + TILE - 3, TILE, 2);
          continue;
        }
        if (isRoadTile(tx, ty)) {
          ctx.fillStyle = '#3a3f47';
          ctx.fillRect(px, py, TILE, TILE);
          continue;
        }
        // Sidewalk / block ground.
        const park = tx >= 15 && tx <= 19 && ty >= 15 && ty <= 19;
        ctx.fillStyle = park ? '#7fae62' : '#b8ab8d';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(px, py, TILE, 1);
        ctx.fillRect(px, py, 1, TILE);
      }
    }

    // Lane dashes down the middle of every road in view.
    ctx.fillStyle = '#d8c95a';
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (!isRoadTile(tx, ty)) continue;
        const px = tx * TILE;
        const py = ty * TILE;
        const horiz = ty % ROAD_EVERY === 0;
        const vert = tx % ROAD_EVERY === 0;
        if (horiz && ((tx * 2 + Math.floor(t * 0)) % 2 === 0)) {
          ctx.fillRect(px + 4, py + TILE / 2 - 1, 18, 2);
        }
        if (vert) {
          ctx.fillRect(px + TILE / 2 - 1, py + 4, 2, 18);
        }
      }
    }

    // Crosswalks at the crossings.
    ctx.fillStyle = 'rgba(240,240,230,0.75)';
    for (let cx = 0; cx < GRID; cx += ROAD_EVERY) {
      for (let cy = 0; cy < GRID; cy += ROAD_EVERY) {
        const px = cx * TILE;
        const py = cy * TILE;
        if (px < cam.x - vw / 2 - TILE || px > cam.x + vw / 2) continue;
        if (py < cam.y - vh / 2 - TILE || py > cam.y + vh / 2) continue;
        for (let i = 0; i < 4; i += 1) {
          ctx.fillRect(px + 6 + i * 10, py + 2, 5, 8);
          ctx.fillRect(px + 6 + i * 10, py + TILE - 10, 5, 8);
        }
      }
    }
  }

  function drawLandmarks(state, cam) {
    const city = state.city;
    for (const b of city.buildings) {
      if (b.x + b.w < cam.x - 700 || b.x > cam.x + 700) continue;
      if (b.y + b.h < cam.y - 450 || b.y > cam.y + 450) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 5);
      // Rooftop details: vents and a pool on the bigger ones.
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.3, 10, 10);
      ctx.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.55, 8, 8);
      if (b.floors >= 3) {
        ctx.fillStyle = '#7fc4d8';
        ctx.fillRect(b.x + b.w * 0.35, b.y + b.h * 0.35, b.w * 0.3, b.h * 0.25);
      }
    }
    for (const tr of city.trees) {
      if (Math.abs(tr.x - cam.x) > 700 || Math.abs(tr.y - cam.y) > 450) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(tr.x + 3, tr.y + 4, tr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tr.palm ? '#4da34d' : '#3f8f46';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6cbf6a';
      ctx.beginPath();
      ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landmark signs.
    const marks = [
      { p: city.safehouse, label: 'HIDEOUT', color: '#3fae8a' },
      { p: city.garage, label: 'GARAGE', color: '#e8b93c' },
      { p: city.pier, label: 'PIER', color: '#2a7f9e' },
      { p: city.market, label: 'MARKET', color: '#d95f6e' },
      { p: city.docks, label: 'DOCKS', color: '#8a6fd0' },
    ];
    for (const m of marks) {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.p.x, m.p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.p.x, m.p.y - 12);
    }
  }

  function drawMarker(state, target) {
    if (!target) return;
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
    const s = 16 * pulse;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 2;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,210,62,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -17, -11 + 3, 36, 22, 6);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -18, -11, 36, 22, 6);
    ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(ctx, -6, -9, 12, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.9)';
    ctx.fillRect(6, -8, 3, 16);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(16, -9, 2, 4);
    ctx.fillRect(16, 5, 2, 4);
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#222';
      ctx.font = `bold 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.kind === 'cop') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-14, -11, 8, 3);
      ctx.fillRect(-14, 8, 8, 3);
      // Light bar, flashing red/blue.
      const flash = Math.floor(Date.now() / 300) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-4, -12, 8, 3);
      ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-4, 9, 8, 3);
    }
    if (car.kind === 'gold') {
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 1.5;
      roundRect(ctx, -18, -11, 36, 22, 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped, isCop) {
    if (ped.down) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 8, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isCop ? '#1f2a44' : ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 11, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = ped.idle > 0 ? 0 : Math.sin((ped.x + ped.y) * 0.15) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(ped.x + 2, ped.y + 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isCop ? '#1f2a44' : ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isCop ? '#e8c88a' : ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y + Math.sin(ped.angle) * 2 + bob * 0.3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = `bold 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PD', ped.x, ped.y - 11);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar !== null) return; // the car shows where he is
    const blink = p.hurtCd > 0 && Math.floor(p.hurtCd * 12) % 2 === 0;
    if (blink) return;
    const bob = p.moving ? Math.sin(state.elapsed * 14) * 1.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 4, 11, 0, Math.PI * 2);
    ctx.fill();
    // Rook: white jacket, red cap, facing the way he walks.
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d94f3d';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 + bob * 0.3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8, 2, 0, Math.PI * 2);
    ctx.fill();
    // Punch swing.
    if (p.punchAnim > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, p.angle - 0.7, p.angle + 0.7);
      ctx.stroke();
    }
    // Direction tick so the player reads which way Rook faces.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.stroke();
  }

  function drawMinimap(state, target) {
    const size = MINIMAP;
    const x = viewW - size - 14;
    const y = viewH - size - 14;
    const scale = size / WORLD;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    // Sea and sand.
    ctx.fillStyle = '#2a7f9e';
    ctx.fillRect(x + SEA_X * TILE * scale, y, size, size);
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(x + BEACH_X * TILE * scale, y, (SEA_X - BEACH_X) * TILE * scale, size);
    // Roads.
    ctx.fillStyle = '#5a6068';
    for (let i = 0; i < GRID; i += ROAD_EVERY) {
      ctx.fillRect(x, y + i * TILE * scale, size, TILE * scale);
      ctx.fillRect(x + i * TILE * scale, y, TILE * scale, size);
    }
    // Buildings.
    ctx.fillStyle = 'rgba(200,180,140,0.8)';
    for (const b of state.city.buildings) {
      ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    // Cash bags.
    ctx.fillStyle = '#3fae5a';
    for (const bag of state.bags) {
      if (bag.taken) continue;
      ctx.beginPath();
      ctx.arc(x + bag.x * scale, y + bag.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cars, cops, mission target, player.
    ctx.fillStyle = '#cfd6dd';
    for (const car of state.cars) {
      ctx.fillRect(x + car.x * scale - 1.5, y + car.y * scale - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ff2d2d';
    for (const cop of state.cops) {
      ctx.beginPath();
      ctx.arc(x + cop.x * scale, y + cop.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cc of state.copCars) {
      ctx.beginPath();
      ctx.arc(x + cc.x * scale, y + cc.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (target) {
      ctx.fillStyle = '#ffd23e';
      ctx.save();
      ctx.translate(x + target.x * scale, y + target.y * scale);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    const p = state.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + p.x * scale, y + p.y * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + p.x * scale, y + p.y * scale, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text('VICE SHORES', x + size / 2, y - 10, 10, '#ffd23e', 'center', 'bold');
  }

  function drawHud(state, target) {
    const p = state.player;
    const stars = state.wanted <= 0.25 ? 0 : Math.max(1, Math.min(5, Math.round(state.wanted)));
    // Top-left: health + cash.
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    roundRect(ctx, 12, 12, 250, 64, 8);
    ctx.fill();
    text('ROOK', 24, 34, 13, '#fff', 'left', 'bold');
    ctx.fillStyle = '#222';
    ctx.fillRect(24, 42, 180, 12);
    ctx.fillStyle = p.health > 50 ? '#3fae5a' : p.health > 25 ? '#e8a53c' : '#d94f3d';
    ctx.fillRect(24, 42, Math.max(0, 180 * (p.health / 100)), 12);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 42, 180, 12);
    text(`$${state.cash}`, 214, 54, 16, '#7be495', 'left', 'bold');
    text(p.inCar !== null ? 'DRIVING — E to exit' : 'ON FOOT — E near a car to drive', 24, 70, 11, '#cfd6dd', 'left');

    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    roundRect(ctx, viewW - 212, 12, 200, 44, 8);
    ctx.fill();
    text('WANTED', viewW - 200, 30, 11, '#cfd6dd', 'left', 'bold');
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.25)';
      ctx.font = `20px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('★', viewW - 128 + i * 24, 40);
    }

    // Top-centre: clock + mission.
    const m = missionByIndex(state.missionIndex);
    const mins = Math.floor(state.clockMin) % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    const mw = 430;
    roundRect(ctx, (viewW - mw) / 2, 12, mw, 64, 8);
    ctx.fill();
    text(`☀ ${hh}:${mm}`, (viewW - mw) / 2 + 16, 36, 15, '#ffd23e', 'left', 'bold');
    if (m) {
      text(`MISSION ${m.id}/5 — ${m.name}`, (viewW - mw) / 2 + 16, 56, 13, '#fff', 'left', 'bold');
      text(objectiveText(m, state), (viewW - mw) / 2 + 16, 72, 12, '#ffd23e', 'left');
    } else {
      text('STORY COMPLETE — free roam', (viewW - mw) / 2 + 16, 56, 13, '#7be495', 'left', 'bold');
    }

    // Banner.
    if (state.banner && state.bannerTimer > 0) {
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      const bw = Math.min(720, viewW - 40);
      roundRect(ctx, (viewW - bw) / 2, 92, bw, 34, 8);
      ctx.fill();
      text(state.banner, viewW / 2, 114, 15, '#ffd23e', 'center', 'bold');
    }

    // Bottom-left: controls.
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    roundRect(ctx, 12, viewH - 58, 330, 46, 8);
    ctx.fill();
    text('WASD move/drive · E enter car · Space punch · H horn · P pause', 22, viewH - 32, 12, '#e8e4d8', 'left');

    drawMinimap(state, target);
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(680, viewW - 60);
    const h = 150 + lines.length * 30;
    const x = (viewW - w) / 2;
    const y = (viewH - h) / 2;
    ctx.fillStyle = 'rgba(8,10,16,0.88)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = accent || '#ffd23e';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    text(title, viewW / 2, y + 58, 40, accent || '#ffd23e', 'center', 'bold');
    lines.forEach((line, i) => {
      text(line, viewW / 2, y + 104 + i * 30, 16, '#e8e4d8', 'center');
    });
    if (prompt) text(prompt, viewW / 2, y + h - 26, 16, '#7be495', 'center', 'bold');
  }

  function drawDialog(state) {
    const d = state.dialog;
    if (!d) return;
    const w = Math.min(640, viewW - 80);
    const h = 190;
    const x = (viewW - w) / 2;
    const y = viewH - h - 24;
    ctx.fillStyle = 'rgba(8,10,16,0.92)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    text(`${d.giver} — ${d.name}`, x + 22, y + 34, 15, '#ffd23e', 'left', 'bold');
    // Word-wrap the intro.
    const words = d.text.split(' ');
    let line = '';
    let ly = y + 66;
    ctx.font = `15px ${FONT}`;
    for (const word of words) {
      if (ctx.measureText(line + word).width > w - 44 && line) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(line, x + 22, ly);
        line = '';
        ly += 24;
      }
      line += `${word} `;
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(line, x + 22, ly);
    text('Press Enter or click to continue', x + 22, y + h - 18, 13, '#7be495', 'left', 'bold');
  }

  function drawWorld(state, target) {
    // Clamp the camera so the view never shows the void past the city edge.
    const raw = state.camera;
    const cam = {
      x: viewW >= WORLD ? WORLD / 2 : Math.max(viewW / 2, Math.min(WORLD - viewW / 2, raw.x)),
      y: viewH >= WORLD ? WORLD / 2 : Math.max(viewH / 2, Math.min(WORLD - viewH / 2, raw.y)),
    };
    ctx.save();
    ctx.translate(Math.round(viewW / 2 - cam.x), Math.round(viewH / 2 - cam.y));
    drawGround(state, cam, viewW, viewH);
    drawLandmarks(state, cam);
    drawMarker(state, target);
    for (const bag of state.bags) {
      if (bag.taken) continue;
      const bob = Math.sin(state.elapsed * 4 + bag.x) * 3;
      ctx.fillStyle = '#2f8f4a';
      ctx.beginPath();
      ctx.arc(bag.x, bag.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', bag.x, bag.y + bob + 4);
    }
    for (const car of state.cars) drawCar(car);
    for (const ped of state.peds) drawPed(ped, false);
    for (const cop of state.cops) drawPed(cop, true);
    drawPlayer(state);
    ctx.restore();
  }

  function draw(state, screen, target, saveInfo) {
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, viewW, viewH);
    if (screen === SCREEN_TITLE) {
      drawWorld(state, target);
      ctx.fillStyle = 'rgba(8,10,16,0.55)';
      ctx.fillRect(0, 0, viewW, viewH);
      drawPanel('VICE SHORES', [
        'A sun-soaked open-world crime story. You are Rook, new in town,',
        'working jobs for the fixer Marla Vane — five missions, one city,',
        'and the Shores PD watching every move you make.',
        '',
        'Drive, steal cars, dodge the law, and finish the story.',
        saveInfo || 'WASD move · E enter a car · Space punch · H horn · P pause',
      ], 'Press Enter or click to start', '#ffd23e');
      return;
    }
    drawWorld(state, target);
    drawHud(state, target);
    drawDialog(state);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,10,16,0.6)';
      ctx.fillRect(0, 0, viewW, viewH);
      drawPanel('PAUSED', ['The city waits for you.', 'Progress is saved automatically.'], 'Press P to resume', '#7fc4d8');
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(8,10,16,0.6)';
      ctx.fillRect(0, 0, viewW, viewH);
      drawPanel('BUSTED', [
        'The Shores PD caught up with Rook.',
        `You banked $${state.cash} and finished ${state.stats.missionsDone} of 5 missions.`,
      ], 'Press Enter to try again', '#d94f3d');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
