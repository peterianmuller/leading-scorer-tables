// Turns the CDN's play-by-play into a player's shots on a half court, for the
// shot chart.
//
// Positions are the feed's "legacy" coordinates, the system stats.nba.com shot
// charts have always used: tenths of a foot, with the basket at (0, 0), x
// across the court (-250 to 250, sideline to sideline) and y out toward half
// court (-47.5 at the baseline, 422.5 at half court). shotDistance agrees with
// them, so they're plotted as-is.

// Every field goal attempt the player took, in play order. Heaves are their
// own action type with no position, and the box score doesn't count them as
// attempts either, so leaving them out keeps the chart's totals matching it.
export function playerShots(actions, personId) {
  return actions
    .filter((a) => a.personId === personId && a.isFieldGoal === 1 && a.xLegacy != null)
    .sort((a, b) => a.orderNumber - b.orderNumber)
    .map((a) => ({
      x: a.xLegacy,
      y: a.yLegacy,
      made: a.shotResult === "Made",
      three: a.actionType === "3pt",
      distance: a.shotDistance,
      period: a.period,
      clock: a.clock,
      description: a.description,
    }));
}

// The shooting line those shots add up to, as the box score would print it.
export function shootingLine(shots) {
  const threes = shots.filter((s) => s.three);
  return {
    fgm: shots.filter((s) => s.made).length,
    fga: shots.length,
    tpm: threes.filter((s) => s.made).length,
    tpa: threes.length,
  };
}

// "11 ft 2PT". Whole feet rounded down, the way the play descriptions write
// them (a 13.83 ft shot is "13'"), so the two never disagree side by side.
export function shotLabel(shot) {
  return `${Math.floor(shot.distance)} ft ${shot.three ? "3PT" : "2PT"}`;
}

// The shot closest to (x, y) within `radius`, or -1 when none is that close.
// Lets the pointer pick a dot it's merely near, which matters where shots
// pile up at the rim.
export function nearestShot(shots, x, y, radius) {
  let best = -1;
  let bestDist = radius;
  shots.forEach((s, i) => {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
