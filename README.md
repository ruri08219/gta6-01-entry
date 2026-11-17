# Vice Shores

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ruri08219/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ruri08219/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Shores** is a top-down open-world crime game built for make.fun's
"Make GTA 6" bounty. You are **Rook**, new in the fictional sun-soaked city of
Vice Shores, working jobs for the fixer **Marla Vane** while the Shores PD
watches every move you make. Everything — the city, the characters, the cars,
the story — is original, drawn and synthesized in code. No external assets, no
network requests, no libraries: plain JavaScript and canvas.

## What is in the game

- **A city to explore** — a road grid with intersections, crosswalks and lane
  markings, building blocks, a park, a plaza, a beach and the sea, all
  generated from a seed so the same seed always builds the same streets.
- **On foot and by car** — walk with WASD or the arrow keys; press **E** near
  any car to get in and drive it, **E** again to step out.
- **Traffic and pedestrians** — AI cars cruise the roads, stop for the car
  ahead and turn at crossings; pedestrians stroll the sidewalks and scatter
  from speeding cars.
- **Cars to steal** — parked cars and traffic cars can be taken. Steal one in
  front of a cop or a witness and the heat goes up.
- **Wanted level and police** — 1 to 5 stars. Foot cops run you down, police
  cruisers chase you along the roads with flashing light bars. Cause trouble
  and the stars climb; lie low and they cool off.
- **Missions and a story** — five missions in a row from Marla Vane, with
  dialogue: deliver a package, steal a gold sedan, tail a courier van, shake
  the heat at the Pier, and pull off the big score. Mission rewards pay cash.
- **Combat** — **Space** throws a punch on foot. Health, cash, the clock, the
  active mission and the wanted stars are all on the HUD.
- **Minimap** — a live map of Vice Shores in the corner: roads, the sea, cars,
  cops, cash drops and the mission target.
- **Start screen, pause, game over, save** — progress (cash, mission, health)
  is saved to localStorage automatically. Sound is synthesized WebAudio beeps
  (M mutes); **H** honks the horn.

## How to run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser and press Enter.

Deterministic screenshots: `?shot=start|play|chase|mission|end&seed=1` stages
a fixed scene from the real game rules (see `shots.json`).

## Layout

- `game/index.html` — the page, one canvas, no network references.
- `game/src/main.js` — boot, the fixed-step loop, screens, save/load.
- `game/src/entities.js` — the rules: player, cars, traffic, pedestrians,
  cops, wanted level, combat, cash, missions.
- `game/src/city.js` — the generated city: roads, buildings, park, beach.
- `game/src/render.js` — all drawing: the city, the HUD, the minimap, screens.
- `game/src/missions.js` — the five-mission story and dialogue.
- `game/src/shots.js` — the deterministic screenshot scenes.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/audio.js` — synthesized WebAudio sound effects.
- `game/src/rng.js` — the seeded random generator.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` and writes
  `dossier.json` with the vendored make.fun library.

## License

MIT — see `LICENSE`.
