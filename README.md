# Solara Bay — Sun City Stories

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Game: Solara Bay](https://img.shields.io/badge/Game-Solara%20Bay-orange.svg)](game/index.html)
[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-blue.svg)](https://make.fun)

A complete 3D open-world crime game built for the make.fun **gta6-01 "Make GTA 6"**
competition — an original city, story and cast, running entirely from static
files in a desktop browser with no network requests.

## The game

Rico Vale is back in **Solara Bay**, a sun-soaked coastal city of pastel towers,
palm-lined avenues and a marina beach — and fixer **Delia Cross** wants her
$50,000 back. Six missions pay the debt down: steal a getaway car, run courier
drops across town, settle scores with Kade's crew, lose the Bay PD heat, pull
the Bay Bank vault job, and take the marina to become Bay King.

## What's in it

- **Open city on foot and by car** — third-person camera, run, jump, enter/exit any car
- **Driving** — arcade handling, steering, collisions, parked cars to steal
- **Traffic AI + pedestrians** — cars looping the road grid, walkers on the sidewalks
- **Wanted level + Bay PD** — crimes raise up to 5 stars; police cars chase, ram and
  escalate, and the heat cools off when you lay low
- **6 story missions** — objectives, progress tracking, rewards, a mission beacon and minimap marker
- **Combat** — shoot on foot with tracers; hostile thugs and enforcers hunt you down
- **HUD + minimap** — cash, debt, health, speed, wanted stars, live top-down map
- **Start screen, pause, save** — progress autosaves and persists in localStorage
- **Synthesized sound** — WebAudio engine hum, sirens, gunshots and a funk groove; no audio files
- **Polish** — sun lighting, shadows, lit windows, beach and ocean, message feed

## Play

```sh
node serve.ts
# open http://localhost:8080
```

**Controls:** WASD move / drive · SHIFT run · E enter / exit car · mouse drag camera ·
click shoot · SPACE jump · P pause · M mute.

## Tech

Three.js (vendored minified build under `game/vendor/`) renders the city; the game
logic is split into one-job modules under `game/src/` (`world`, `cars`, `npcs`,
`police`, `missions`, `combat`, `hud`, `audio`, `input`, `save`). No build step,
no network requests — every asset is a file under `game/`.

## License

MIT — see [LICENSE](LICENSE).
