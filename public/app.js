// Fetches a box score from the local proxy and renders every stat the CDN
// reports for the game's top scorer.

const form = document.getElementById("game-form");
const input = document.getElementById("game-id");
const status = document.getElementById("status");
const section = document.getElementById("player");
const tbody = document.querySelector("#stats tbody");

// Stat keys as the CDN names them -> what a human wants to read. Order here
// is display order; anything the CDN adds later falls through to the bottom.
const LABELS = {
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
function formatValue(key, value) {
  if (key.startsWith("minutes") && typeof value === "string") {
    const m = value.match(/PT(\d+)M(\d+)/);
    return m ? `${m[1]}:${m[2].padStart(2, "0")}` : value;
  }
  if (key.endsWith("Percentage")) return `${(value * 100).toFixed(1)}%`;
  if (key === "plusMinusPoints" && value > 0) return `+${value}`;
  return String(value);
}

function leadingScorer(game) {
  let best = null;
  for (const team of [game.homeTeam, game.awayTeam]) {
    for (const player of team.players) {
      if (!best || player.statistics.points > best.player.statistics.points) {
        best = { player, team };
      }
    }
  }
  return best;
}

function render(game) {
  const { player, team } = leadingScorer(game);
  const stats = player.statistics;

  document.getElementById("matchup").textContent =
    `${game.awayTeam.teamTricode} ${game.awayTeam.score} @ ` +
    `${game.homeTeam.teamTricode} ${game.homeTeam.score} · ${game.gameStatusText}`;

  document.getElementById("player-name").textContent = player.name;
  document.getElementById("player-meta").textContent =
    `#${player.jerseyNum} · ${player.position || "—"} · ${team.teamCity} ${team.teamName}`;

  const ordered = [
    ...Object.keys(LABELS).filter((k) => k in stats),
    ...Object.keys(stats).filter((k) => !(k in LABELS)),
  ];

  tbody.replaceChildren(
    ...ordered.map((key) => {
      const tr = document.createElement("tr");
      if (key === "points") tr.className = "points";
      const th = document.createElement("td");
      th.textContent = LABELS[key] || key;
      const td = document.createElement("td");
      td.textContent = formatValue(key, stats[key]);
      tr.append(th, td);
      return tr;
    })
  );

  section.hidden = false;
  status.hidden = true;
}

async function load(gameId) {
  status.hidden = false;
  status.className = "muted";
  status.textContent = "Loading…";
  section.hidden = true;

  const qs = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
  try {
    const res = await fetch(`/api/boxscore${qs}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    render(body.game);
  } catch (err) {
    status.className = "muted error";
    status.textContent = err.message;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  load(input.value.trim());
});

load();
