// Fetches a box score from the local proxy and renders every stat the CDN
// reports for each team's leading scorer, side by side.

const form = document.getElementById("game-form");
const input = document.getElementById("game-id");
const status = document.getElementById("status");
const teams = document.getElementById("teams");
const template = document.getElementById("team-card");

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

// Top scorer on one team. Null when the CDN lists no players — pregame box
// scores carry the teams but an empty roster.
function teamLeader(team) {
  let best = null;
  for (const player of team.players ?? []) {
    if (!best || player.statistics.points > best.statistics.points) {
      best = player;
    }
  }
  return best;
}

function statRows(stats) {
  const ordered = [
    ...Object.keys(LABELS).filter((k) => k in stats),
    ...Object.keys(stats).filter((k) => !(k in LABELS)),
  ];

  return ordered.map((key) => {
    const tr = document.createElement("tr");
    if (key === "points") tr.className = "points";
    const name = document.createElement("td");
    name.textContent = LABELS[key] || key;
    const value = document.createElement("td");
    value.textContent = formatValue(key, stats[key]);
    tr.append(name, value);
    return tr;
  });
}

// Returns the filled card plus its leader's point total, which render() needs
// to decide which of the two won the matchup.
function teamCard(team) {
  const card = template.content.firstElementChild.cloneNode(true);
  const player = teamLeader(team);

  card.querySelector(".team-name").textContent =
    `${team.teamCity} ${team.teamName} · ${team.score}`;

  if (!player) {
    card.querySelector(".player-name").textContent = "—";
    card.querySelector(".player-meta").textContent = "No player stats yet";
    card.querySelector(".table-wrap").remove();
    return { card, points: -1 };
  }

  card.querySelector(".player-name").textContent = player.name;
  card.querySelector(".player-meta").textContent =
    `#${player.jerseyNum} · ${player.position || "—"}`;
  card.querySelector("tbody").replaceChildren(...statRows(player.statistics));

  return { card, points: player.statistics.points };
}

function render(game) {
  document.getElementById("matchup").textContent =
    `${game.awayTeam.teamTricode} ${game.awayTeam.score} @ ` +
    `${game.homeTeam.teamTricode} ${game.homeTeam.score} · ${game.gameStatusText}`;

  // Away first, so the cards read in the same order as the matchup line.
  const away = teamCard(game.awayTeam);
  const home = teamCard(game.homeTeam);

  // Flag whichever leader outscored the other. A tie flags neither — there's
  // no single top scorer to point at.
  if (away.points > home.points) away.card.classList.add("leader");
  else if (home.points > away.points) home.card.classList.add("leader");

  teams.replaceChildren(away.card, home.card);
  teams.hidden = false;
  status.hidden = true;
}

async function load(gameId) {
  status.hidden = false;
  status.className = "muted";
  status.textContent = "Loading…";
  teams.hidden = true;

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
