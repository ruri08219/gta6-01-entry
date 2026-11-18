// Solara Bay — shared constants, city layout, story and mission data.
// Every name, place and character here is original to this game.
export const GAME_TITLE = 'SOLARA BAY';
export const GAME_SUBTITLE = 'Sun City Stories';
export const SAVE_KEY = 'solara-bay-save-v1';
export const DEBT_TOTAL = 50000;

export const CITY = {
  blocks: 5,          // blocks per side
  block: 44,          // block size (building zone)
  road: 14,           // road width
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocks * this.pitch + this.road) / 2; },
};

// Road centre lines (one per grid line, both axes). With 5 blocks of 44
// and 14-wide roads, the city spans -152..152 and roads sit at
// -145, -87, -29, 29, 87, 145; block centres sit between them.
export function roadLines() {
  const lines = [];
  for (let i = 0; i <= CITY.blocks; i++) lines.push(-CITY.half + CITY.road / 2 + i * CITY.pitch);
  return lines;
}

export const PALETTE = {
  sky: 0x87c5e8, sun: 0xfff2c0, sand: 0xe8cf9a, sea: 0x1e7fa8,
  asphalt: 0x3a3f46, sidewalk: 0x9a938a, grass: 0x5da24a,
  building: [0xe8b48a, 0x7fb8c9, 0xf2e3c6, 0xd98a7a, 0x9ac49a, 0xc9a7d8, 0x8fb3e8],
  windowLit: 0xffe9a8, windowDark: 0x2c3e50,
};

export const CAR_COLORS = [0xd43d2a, 0x2a6fd4, 0xf2c230, 0x34a853, 0xe8e8e8, 0x222831, 0x8e44ad, 0xff7f2a];

// Story: Rico Vale, a getaway driver back in Solara Bay, owes fixer Delia
// Cross $50,000. Each mission pays the debt down and unlocks the next.
export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', giver: 'Delia Cross',
    brief: 'Delia: "You owe me fifty grand, Rico. Start by getting wheels — take any car on the street."',
    type: 'steal', reward: 200,
    objective: 'Steal a car (press E near a car)',
    target: null,
  },
  {
    id: 'm2', title: 'Courier Run', giver: 'Delia Cross',
    brief: 'Delia: "Two packages, two drop-offs across town. Drive fast, stay clean."',
    type: 'deliver', reward: 400,
    objective: 'Deliver packages to both drop-off markers',
    targets: [{ x: 87, z: -95, label: 'Drop-off A — Marina' }, { x: -87, z: 95, label: 'Drop-off B — Old Market' }],
  },
  {
    id: 'm3', title: 'Payback', giver: 'Marco "Ferry" Ruiz',
    brief: 'Ferry: "Three of Kade\'s thugs are shaking down my corner. Teach them a lesson."',
    type: 'defeat', reward: 500, count: 3,
    objective: 'Deal with 3 street thugs (click to shoot, or get close)',
    target: { x: -29, z: -58, label: 'Ferry\'s Corner' },
  },
  {
    id: 'm4', title: 'Hot Pursuit', giver: 'Delia Cross',
    brief: 'Delia: "The Bay PD is on you. Make some noise, then vanish. Lose them and meet me at the hideout."',
    type: 'escape', reward: 600,
    objective: 'Reach 2 wanted stars, then lose the heat and reach the hideout',
    target: { x: -95, z: -95, label: 'Hideout — North Docks' },
  },
  {
    id: 'm5', title: 'The Vault Job', giver: 'Delia Cross',
    brief: 'Delia: "The Bay Bank vault. Grab the cash, get out before the sirens close in."',
    type: 'heist', reward: 1000,
    objective: 'Reach the bank, grab the cash, escape to the hideout',
    target: { x: 46, z: 58, label: 'Bay Bank' },
    escape: { x: -95, z: -95, label: 'Hideout' },
  },
  {
    id: 'm6', title: 'Bay King', giver: 'Delia Cross',
    brief: 'Delia: "Kade\'s crew holds the marina. Take it back and the debt is gone — the Bay is yours."',
    type: 'defeat', reward: 2000, count: 5,
    objective: 'Defeat 5 of Kade\'s enforcers at the marina',
    target: { x: 160, z: 0, label: 'Marina — Kade\'s Crew' },
  },
];

export const CONTROLS_TEXT =
  'WASD move / drive  •  SHIFT run  •  E enter / exit car  •  Mouse drag camera  •  Click shoot  •  SPACE jump  •  P pause  •  M mute';
