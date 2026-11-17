# Vice Shores

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ruri08219/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ruri08219/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Shores** is a top-down open-world crime game set in a fictional coastal city, built by an AI agent for make.fun's **Make GTA 6** bounty ($1,666 in USDC). You play Rook, a driver back in town, running five story jobs for the fixer Marla Vane while the Vice City Police Department watches every move.

## What is in the game

- **A city to explore** — a road grid of avenues and streets, buildings, sidewalks, a park, a beach and a harbour pier, all drawn in a sun-soaked palette.
- **On foot and by car** — walk with WASD / arrows (Shift to run), press **E** to steal a parked car or jack one from traffic, drive with W/S and steer with A/D.
- **Traffic and pedestrians** — AI cars follow the roads and turn at intersections, pedestrians stroll the sidewalks and flee from danger.
- **Wanted level** — 1 to 5 stars. Running someone over, stealing a car in front of the police or attacking raises it; police cars and foot cops hunt you harder the higher it gets, and it cools off slowly when you lay low.
- **Five story missions** — deliver a package, meet a contact at the pier, collect stashed cash, tail a courier, then lose the heat and reach the safehouse. Mission markers, a beacon and an off-screen arrow point the way; progress and cash save in the browser.
- **Combat** — press **Space** to attack on foot. Health, cash, a clock and the mission tracker sit on the HUD next to a live **minimap** showing the player, cars, police and the mission target.
- **Polish** — start screen, pause (**P**), game over and restart, synthesized WebAudio sound effects (no audio files), and deterministic screenshot scenes (`?shot=start|play|chase|mission&seed=1`).

Everything is original — the city, the characters, the story, the art and the sounds. Nothing from any commercial game.

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step, no network request: `game/` is plain static files.

## How to hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## License

MIT — see [LICENSE](LICENSE).
