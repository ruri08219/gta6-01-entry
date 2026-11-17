// The story of Vice Shores: five missions in a row, given by the fixer Marla Vane
// to the newcomer Rook. Each mission names its goal, its reward and where it ends;
// the game module asks these helpers what the current objective is and whether
// the player just finished it.
export const MISSIONS = [
  {
    id: 1,
    name: 'First Errand',
    giver: 'Marla Vane',
    intro: 'Rook. Fresh off the bus, huh? Prove you can follow directions: take this package to the Market stall on Coral Row. No detours, no drama.',
    brief: 'Deliver the package to the Market',
    reward: 150,
    target: 'market',
    kind: 'goto',
  },
  {
    id: 2,
    name: 'Hot Wheels',
    giver: 'Marla Vane',
    intro: 'A client wants a gold sedan, no questions. There is one parked near the Docks. Borrow it — permanently — and bring it to my Garage.',
    brief: 'Steal the gold sedan, deliver it to the Garage',
    reward: 300,
    target: 'garage',
    kind: 'steal',
  },
  {
    id: 3,
    name: 'Tail the Courier',
    giver: 'Marla Vane',
    intro: 'A courier in a teal van is carrying something I need to know about. Stay on his tail — close, but not too close — until I have what I need.',
    brief: 'Stay close behind the teal courier van',
    reward: 400,
    target: 'courier',
    kind: 'tail',
  },
  {
    id: 4,
    name: 'Heat Run',
    giver: 'Marla Vane',
    intro: 'The Shores PD put a price on that sedan. Make some noise, get the heat on you, then shake it and meet me at the Pier. If you can.',
    brief: 'Raise your wanted level, then reach the Pier',
    reward: 500,
    target: 'pier',
    kind: 'escape',
  },
  {
    id: 5,
    name: 'The Big Score',
    giver: 'Marla Vane',
    intro: 'One last job, Rook, and we are even. Three cash drops are stashed around town. Grab them all and bring the money home to the Hideout.',
    brief: 'Collect 3 cash drops, return to the Hideout',
    reward: 800,
    target: 'safehouse',
    kind: 'collect',
  },
];

export function missionByIndex(index) {
  return MISSIONS[index] || null;
}

export function missionCount() {
  return MISSIONS.length;
}

// Short objective line for the HUD, with live progress where it helps.
export function objectiveText(mission, state) {
  if (!mission) return 'Story complete — Vice Shores is yours.';
  if (mission.kind === 'collect') {
    return `${mission.brief} (${state.collectedBags}/3)`;
  }
  if (mission.kind === 'tail') {
    return `${mission.brief} (${Math.floor(state.tailTime)}s / 4s)`;
  }
  if (mission.kind === 'steal') {
    return state.stolenGold ? 'Gold sedan secured — deliver it to the Garage' : mission.brief;
  }
  if (mission.kind === 'escape') {
    return state.wanted >= 1 ? 'Heat is on — reach the Pier' : 'Make noise first: steal a car or cause a scene';
  }
  return mission.brief;
}
