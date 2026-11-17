// Vice Shores tuning: every number and colour the game uses lives here.
// The world is a fixed 3200x2400 city; the camera follows the player and the
// renderer scales the view to the window, so no rule depends on screen size.

export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };

// Roads: vertical avenues and horizontal streets; the grid they form is the city.
export const ROADS_V = [320, 760, 1200, 1640, 2080, 2520];
export const ROADS_H = [300, 720, 1140, 1560, 1980];
export const ROAD_W = 96;
export const LANE = 24;

// The beach and the harbour take the whole east strip; the park is one city block.
export const BEACH_X = 2760;
export const PARK = { x: 1300, y: 1240, w: 320, h: 300 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 300,
  health: 100,
  attackRange: 46,
  attackDamage: 34,
  attackCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 520,
  brake: 760,
  maxSpeed: 430,
  maxReverse: 150,
  turnRate: 2.6,
  trafficSpeed: 150,
  trafficSpeedJitter: 45,
};

export const PED = { radius: 10, speed: 55, speedJitter: 25 };

export const POLICE = {
  footSpeed: 205,
  carSpeed: 400,
  // Wanted stars -> how many police cars and foot cops hunt the player.
  carsByStars: [0, 1, 2, 3, 4, 6],
  footByStars: [0, 1, 2, 3, 5, 7],
  // How long without a crime before one star fades away.
  decaySeconds: 26,
};

export const WANTED_MAX = 5;

export const CLOCK = { startHour: 9, minutesPerSecond: 0.5 };

export const SAVE_KEY = 'vice-shores.save.v1';

export const PALETTE = {
  grass: '#4d8a4f',
  park: '#3f7d46',
  sidewalk: '#9aa0a8',
  road: '#33373f',
  roadLine: '#e8c33a',
  buildingRoof: '#6b5a4e',
  buildingRoof2: '#55627a',
  buildingRoof3: '#7a5a68',
  buildingEdge: '#2e2a26',
  windowLit: '#ffd76a',
  windowDark: '#232a33',
  sand: '#e3cd8f',
  water: '#2f7fb8',
  waterDeep: '#22608f',
  pier: '#8a6a48',
  tree: '#2c6b34',
  carPlayer: '#e8493f',
  carTraffic: '#c9ced6',
  carTaxi: '#f2c230',
  carPolice: '#2b4acb',
  ped: '#d8b58a',
  pedShirt: '#7a86c9',
  player: '#e8493f',
  playerShirt: '#f2f2f2',
  cop: '#2b4acb',
  copShirt: '#1d2f7a',
  marker: '#ffd23e',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f4f6f8',
  hudMuted: '#aab2bd',
  star: '#ffd23e',
  starEmpty: '#5a6068',
  health: '#3ddc5f',
  healthLow: '#e8493f',
  title: '#ffd23e',
  night: 'rgba(10, 14, 40, 0.16)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
