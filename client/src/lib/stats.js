// Stat keys as the CDN names them -> what a human wants to read. Order here
// is display order; anything the CDN adds later falls through to the bottom.
export const LABELS = {
  points: "Points",
  minutes: "Minutes",
  fieldGoalsMade: "FG Made",
  fieldGoalsAttempted: "FG Attempted",
  fieldGoalsPercentage: "FG %",
  threePointersMade: "3PT Made",
  threePointersAttempted: "3PT Attempted",
  threePointersPercentage: "3PT %",
  twoPointersMade: "2PT Made",
  twoPointersAttempted: "2PT Attempted",
  twoPointersPercentage: "2PT %",
  freeThrowsMade: "FT Made",
  freeThrowsAttempted: "FT Attempted",
  freeThrowsPercentage: "FT %",
  reboundsOffensive: "Off. Rebounds",
  reboundsDefensive: "Def. Rebounds",
  reboundsTotal: "Total Rebounds",
  assists: "Assists",
  steals: "Steals",
  blocks: "Blocks",
  blocksReceived: "Blocks Received",
  turnovers: "Turnovers",
  foulsPersonal: "Personal Fouls",
  foulsOffensive: "Offensive Fouls",
  foulsTechnical: "Technical Fouls",
  foulsDrawn: "Fouls Drawn",
  pointsInThePaint: "Points in Paint",
  pointsFastBreak: "Fast Break Points",
  pointsSecondChance: "Second Chance Points",
  plus: "Plus",
  minus: "Minus",
  plusMinusPoints: "Plus/Minus",
  minutesCalculated: "Minutes (calculated)",
};

// CDN minutes come as ISO 8601 durations, e.g. "PT34M12.00S".
export function formatValue(key, value) {
  if (key.startsWith("minutes") && typeof value === "string") {
    const m = value.match(/PT(\d+)M(\d+)/);
    return m ? `${m[1]}:${m[2].padStart(2, "0")}` : value;
  }
  if (key.endsWith("Percentage")) return `${(value * 100).toFixed(1)}%`;
  if (key === "plusMinusPoints" && value > 0) return `+${value}`;
  return String(value);
}

// Known stats in LABELS order, then whatever else the CDN sent.
export function orderedStatKeys(stats) {
  return [
    ...Object.keys(LABELS).filter((k) => k in stats),
    ...Object.keys(stats).filter((k) => !(k in LABELS)),
  ];
}

// Top scorer on one team. Null when the CDN lists no players — pregame box
// scores carry the teams but an empty roster.
export function teamLeader(team) {
  let best = null;
  for (const player of team.players ?? []) {
    if (!best || player.statistics.points > best.statistics.points) {
      best = player;
    }
  }
  return best;
}
