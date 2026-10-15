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

// What a card shows before "Show all stats": the scoring line, how efficiently
// it came, the rest of the standard box-score line, and the team's margin with
// the player on the floor.
export const KEY_STATS = [
  "points",
  "fieldGoalsPercentage",
  "reboundsTotal",
  "assists",
  "plusMinusPoints",
];

// The key stats the CDN sent, in KEY_STATS order, then everything else in
// orderedStatKeys order. Key stats lead the full list too, so expanding a
// card adds rows below the ones already showing instead of reshuffling them.
export function splitStatKeys(stats) {
  const key = KEY_STATS.filter((k) => k in stats);
  const rest = orderedStatKeys(stats).filter((k) => !KEY_STATS.includes(k));
  return { key, rest };
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

// Shown in place of a photo: "LeBron James" -> "LJ". Prefers the CDN's split
// name, so a suffix like "Jr." or a three-part name doesn't pick the wrong letter.
export function initials(player) {
  const first = player.firstName?.trim() || player.name?.trim().split(/\s+/)[0] || "";
  const last =
    player.familyName?.trim() || player.name?.trim().split(/\s+/).slice(1).join(" ") || "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase() || "?";
}

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const madeOf = (made, attempted) => `${made}-of-${attempted}`;

// One sentence on how the player got their points, e.g. "31 points on 12-of-19
// shooting, 3-of-8 from three and 4-of-4 at the line." `half` (from the
// play-by-play, when it's loaded) adds when they came, if it leaned one way.
export function scoringSummary(stats, half) {
  const parts = [];
  if (stats.fieldGoalsAttempted > 0) {
    parts.push(`on ${madeOf(stats.fieldGoalsMade, stats.fieldGoalsAttempted)} shooting`);
  }
  if (stats.threePointersAttempted > 0) {
    parts.push(`${madeOf(stats.threePointersMade, stats.threePointersAttempted)} from three`);
  }
  if (stats.freeThrowsAttempted > 0) {
    parts.push(`${madeOf(stats.freeThrowsMade, stats.freeThrowsAttempted)} at the line`);
  }
  const how = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  // "on …" follows the points directly; a line with no shots needs a comma.
  const sep = how?.startsWith("on ") ? " " : ", ";
  let summary = how
    ? `${count(stats.points, "point")}${sep}${how}.`
    : `${count(stats.points, "point")}.`;

  // Lopsided means at least 60/40; anything closer is just a steady game.
  const total = half ? half.first + half.second : 0;
  const share = (n) => (n === total ? "All" : n);
  if (total > 0 && half.second >= total * 0.6) {
    summary += ` ${share(half.second)} of them came after halftime.`;
  } else if (total > 0 && half.first >= total * 0.6) {
    summary += ` ${share(half.first)} of them came before halftime.`;
  }
  return summary;
}
