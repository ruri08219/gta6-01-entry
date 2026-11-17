// Vice Shores renderer: paints the city, its people and cars, and every screen
// (title, play, paused, game over) on one canvas. The camera follows the
// player; the HUD and the minimap sit on top of the world in screen space.

import {
  BEACH_X, CAR, PALETTE, PARK, PED, PLAYER, ROADS_H, ROADS_V, ROAD_W, WORLD,
} from './config.js';
import { MISSIONS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function fmtClock(minutes) {
  const total = Math.floor(minutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtCash(cash) {
  return `$${Math.floor(cash).toLocaleString('en-US')}`;
}

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

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawWorld(state, viewW, viewH) {
    const p = state.player;
    const camX = Math.max(0, Math.min(WORLD.width - viewW, p.x - viewW / 2));
    const camY = Math.max(0, Math.min(WORLD.height - viewH, p.y - viewH / 2));
    ctx.save();
    ctx.translate(-camX, -camY);

    // Ground, beach, water, park.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(camX, camY, viewW, viewH);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(BEACH_X, camX), camY, viewW, viewH);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(Math.max(BEACH_X + 130, camX), camY, viewW, viewH);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 5; i += 1) {
      const wy = 300 + i * 380;
      if (wy > camY - 40 && wy < camY + viewH + 40) {
        ctx.fillRect(BEACH_X + 130, wy, 400, 8);
      }
    }
    // Pier jutting into the water.
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(2900, 860, 240, 26);
    ctx.fillRect(3120, 820, 26, 110);
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);

    // Sidewalks, then roads, then centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2 - 12, camY, ROAD_W + 24, viewH);
    for (const ry of ROADS_H) ctx.fillRect(camX, ry - ROAD_W / 2 - 12, viewW, ROAD_W + 24);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, camY, ROAD_W, viewH);
    for (const ry of ROADS_H) ctx.fillRect(camX, ry - ROAD_W / 2, viewW, ROAD_W);
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_V) {
      for (let y = Math.floor(camY / 64) * 64; y < camY + viewH; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_H) {
      for (let x = Math.floor(camX / 64) * 64; x < camX + viewW; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    }

    // Buildings with lit windows.
    for (const b of state.city.buildings) {
      if (b.x > camX + viewW || b.x + b.w < camX || b.y > camY + viewH || b.y + b.h < camY) continue;
      ctx.fillStyle = PALETTE.buildingEdge;
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lit = ((b.litSeed + cx * 7 + cy * 13) % 5) < 2;
          ctx.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
          ctx.fillRect(b.x + 10 + cx * ((b.w - 20) / cols), b.y + 10 + cy * ((b.h - 20) / rows), 14, 12);
        }
      }
      if (b.floors >= 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(b.x, b.y, b.w, 10);
      }
    }

    // Park trees.
    for (const t of state.city.trees) {
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 6);
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cash pickups.
    for (const pickup of state.pickups) {
      const bob = Math.sin(state.time * 3 + pickup.x) * 3;
      ctx.fillStyle = '#1f7a33';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pickup.x, pickup.y + bob);
    }

    // Mission beacon: a pulsing ring and a column of light at the target.
    const target = state.missionTarget;
    if (target && !state.storyComplete) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 210, 62, 0.18)';
      ctx.fillRect(target.x - 4, target.y - 160, 8, 160);
      ctx.fillStyle = PALETTE.marker;
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(target.label, target.x, target.y - 52);
    }

    drawCars(state);
    drawPeds(state);
    drawPlayer(state);
    ctx.restore();
    return { camX, camY };
  }

  function drawCarShape(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -CAR.length / 2 + 3, -CAR.width / 2 + 3, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,28,40,0.85)';
    roundRect(ctx, -8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 4, 3, 7);
    ctx.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 11, 3, 7);
    if (car.kind === 'police') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 3, 10, 5);
      ctx.fillStyle = '#e8493f';
      ctx.fillRect(-CAR.length / 2 + 6, CAR.width / 2 - 8, 10, 5);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('VCPD', 0, 3);
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
  }

  function drawCars(state) {
    for (const car of state.cars) {
      // The player's car gets a white outline so it reads at a glance.
      if (car.kind === 'player') {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        roundRect(ctx, -CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 10);
        ctx.stroke();
        ctx.restore();
      }
      drawCarShape(car);
    }
  }

  function drawPerson(x, y, angle, body, shirt, down, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    if (down > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.85;
    } else {
      ctx.rotate(angle);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(4 * scale, 0, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(9 * scale, -4 * scale, 2.4 * scale, 0, Math.PI * 2);
    ctx.arc(9 * scale, 4 * scale, 2.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      drawPerson(ped.x, ped.y, ped.angle, PALETTE.ped, ped.shirt, ped.down);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar !== null) return;
    const blink = p.invuln > 0 && Math.floor(state.time * 12) % 2 === 0;
    if (!blink) drawPerson(p.x, p.y, p.angle, PALETTE.player, PALETTE.playerShirt, 0, 1.15);
    // Facing tick so the player reads at a glance.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(state, viewW, viewH, mission) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left panel: health, cash, wanted, clock.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 12, 12, 268, 118, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('ROOK', 24, 34);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(fmtCash(state.cash), 24, 56);
    ctx.fillText(fmtClock(state.clockMinutes), 200, 56);
    // Health bar.
    ctx.fillStyle = '#222';
    roundRect(ctx, 24, 66, 180, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 24, 66, Math.max(0, 180 * (p.health / PLAYER.health)), 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(`${Math.ceil(p.health)} HP`, 212, 77);
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.star : PALETTE.starEmpty;
      ctx.font = '20px ' + FONT;
      ctx.fillText('★', 24 + i * 24, 112);
    }
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(state.wanted > 0 ? 'WANTED' : 'CLEAN', 150, 108);

    // Mission panel under the stats.
    if (mission) {
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, 12, 138, 268, 64, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.title;
      ctx.font = 'bold 14px ' + FONT;
      ctx.fillText(mission.title, 24, 160);
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = '13px ' + FONT;
      ctx.fillText(mission.objective, 24, 180);
      const target = state.missionTarget;
      if (target) {
        const d = Math.hypot(p.x - target.x, p.y - target.y);
        ctx.fillStyle = PALETTE.hudMuted;
        ctx.fillText(`${Math.round(d)}m to target`, 24, 196);
      }
    } else if (state.storyComplete) {
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, 12, 138, 268, 44, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.title;
      ctx.font = 'bold 14px ' + FONT;
      ctx.fillText('Story complete — free roam', 24, 166);
    }

    // Controls hint, bottom-left.
    ctx.fillStyle = 'rgba(12,16,24,0.6)';
    roundRect(ctx, 12, viewH - 34, 560, 22, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px ' + FONT;
    ctx.fillText('WASD move · E enter/exit car · Space attack · Shift run · P pause · M mute', 22, viewH - 19);

    drawMinimap(state, viewW);
    drawOffscreenArrow(state, viewW, viewH);

    // Banner and toast, centre-top: the banner is narrow enough to clear the
    // stats panel on the left and the minimap on the right, and grows with its text.
    let bannerBottom = 12;
    if (state.bannerTimer > 0 && state.banner) {
      const bw = Math.min(viewW - 40, 640);
      ctx.font = 'bold 14px ' + FONT;
      const lines = wrapLines(state.banner, bw - 32);
      const bh = 18 + lines.length * 18 + 12;
      const bx = (viewW - bw) / 2;
      ctx.fillStyle = 'rgba(12,16,24,0.78)';
      roundRect(ctx, bx, 12, bw, bh, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.title;
      ctx.textAlign = 'center';
      lines.forEach((line, i) => ctx.fillText(line, viewW / 2, 12 + 30 + i * 18));
      ctx.textAlign = 'left';
      bannerBottom = 12 + bh;
    }
    if (state.toastTimer > 0 && state.toast) {
      ctx.fillStyle = 'rgba(12,16,24,0.72)';
      ctx.font = '13px ' + FONT;
      const tw = ctx.measureText(state.toast).width + 28;
      const ty = bannerBottom + 8;
      roundRect(ctx, (viewW - tw) / 2, ty, tw, 26, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudText;
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, viewW / 2, ty + 18);
      ctx.textAlign = 'left';
    }
  }

  function wrapLines(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawMinimap(state, viewW) {
    const mw = 210;
    const mh = 158;
    const mx = viewW - mw - 12;
    const my = 12;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#3d6b3f';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx + BEACH_X * sx, my, mw, mh);
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(mx + PARK.x * sx, my + PARK.y * sy, PARK.w * sx, PARK.h * sy);
    ctx.strokeStyle = '#555b64';
    ctx.lineWidth = 2;
    for (const rx of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    const target = state.missionTarget;
    if (target && !state.storyComplete) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      ctx.fillStyle = car.kind === 'police' ? '#5b7cff' : car.kind === 'player' ? '#ff6b5e' : '#dfe3e8';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    for (const ped of state.peds) {
      if (ped.kind !== 'cop' || ped.down > 0) continue;
      ctx.fillStyle = '#5b7cff';
      ctx.fillRect(mx + ped.x * sx - 2, my + ped.y * sy - 2, 4, 4);
    }
    const p = state.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8493f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '11px ' + FONT;
    ctx.fillText('VICE SHORES', mx, my + mh + 24);
  }

  function drawOffscreenArrow(state, viewW, viewH) {
    const target = state.missionTarget;
    if (!target || state.storyComplete) return;
    const p = state.player;
    const camX = Math.max(0, Math.min(WORLD.width - viewW, p.x - viewW / 2));
    const camY = Math.max(0, Math.min(WORLD.height - viewH, p.y - viewH / 2));
    const tx = target.x - camX;
    const ty = target.y - camY;
    if (tx > 40 && tx < viewW - 40 && ty > 40 && ty < viewH - 40) return;
    const cx = Math.max(50, Math.min(viewW - 50, tx));
    const cy = Math.max(50, Math.min(viewH - 50, ty));
    const a = Math.atan2(ty - cy, tx - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTitle(state, best) {
    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    drawWorld(state, viewW, viewH);
    ctx.fillStyle = 'rgba(8, 12, 22, 0.62)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('VICE SHORES', viewW / 2, viewH / 2 - 96);
    ctx.fillStyle = '#fff';
    ctx.font = '20px ' + FONT;
    ctx.fillText('An open-world crime story on the coast', viewW / 2, viewH / 2 - 58);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '15px ' + FONT;
    ctx.fillText('Rook is back in town. Marla Vane has five jobs — and the whole Vice City Police', viewW / 2, viewH / 2 - 24);
    ctx.fillText('Department is watching. Steal cars, lose the heat, finish the story.', viewW / 2, viewH / 2 - 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText('Press ENTER or click to start', viewW / 2, viewH / 2 + 44);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '14px ' + FONT;
    ctx.fillText('WASD move · E enter / exit car · Space attack · Shift run · P pause', viewW / 2, viewH / 2 + 74);
    if (best > 0) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.fillText(`Saved progress: ${best} mission(s) done — press Enter to continue`, viewW / 2, viewH / 2 + 102);
    }
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    ctx.fillStyle = 'rgba(8, 12, 22, 0.66)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px ' + FONT;
    ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 10);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('Press P or Enter to keep playing', viewW / 2, viewH / 2 + 26);
    ctx.textAlign = 'left';
  }

  function drawOver(state) {
    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    ctx.fillStyle = 'rgba(20, 6, 8, 0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5b4d';
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('BUSTED', viewW / 2, viewH / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '20px ' + FONT;
    ctx.fillText('Rook went down. The Vice Shores story ends here — for now.', viewW / 2, viewH / 2 - 22);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '16px ' + FONT;
    ctx.fillText(`Cash kept: ${fmtCash(state.cash)} · Missions done: ${state.stats.missionsDone}`, viewW / 2, viewH / 2 + 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText('Press ENTER to try again', viewW / 2, viewH / 2 + 52);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    resize();
    ctx.clearRect(0, 0, viewW, viewH);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawWorld(state, viewW, viewH);
    const mission = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
    drawHud(state, viewW, viewH, mission);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state);
  }

  return { draw, resize };
}
