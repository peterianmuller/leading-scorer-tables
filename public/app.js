// Fetches a box score from the local proxy and renders every stat the CDN
// reports for each team's leading scorer, side by side.

const form = document.getElementById("game-form");
const input = document.getElementById("game-id");
const status = document.getElementById("status");
const teams = document.getElementById("teams");
const template = document.getElementById("team-card");
const seasonSelect = document.getElementById("season");
const dateSelect = document.getElementById("date");
const gameList = document.getElementById("games");

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

/* ---------------------------- schedule browser --------------------------- */

const EARLIEST_SEASON = 2019; // matches the server's floor
const schedules = new Map(); // season -> dates, so switching back costs nothing

// Mirrors currentSeason() on the server: seasons tip off in October, so before
// then the newest season with games played is the previous year's.
function currentSeason(now = new Date()) {
  const start = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function seasonOptions() {
  const newest = Number(currentSeason().slice(0, 4));
  const seasons = [];
  for (let year = newest; year >= EARLIEST_SEASON; year--) {
    seasons.push(`${year}-${String((year + 1) % 100).padStart(2, "0")}`);
  }
  return seasons;
}

// Parsed as UTC, so the label can't slip a day for anyone west of Greenwich.
const DATE_LABEL = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const dateLabel = (iso) => DATE_LABEL.format(new Date(`${iso}T00:00:00Z`));

function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

// Only a finished game has a box score to open.
const isFinal = (game) => game.status === 3;

function renderGames(day) {
  gameList.replaceChildren(
    ...day.games.map((game) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "game";
      button.dataset.gameId = game.gameId;

      if (isFinal(game)) {
        button.textContent =
          `${game.away.tricode} ${game.away.score} @ ` +
          `${game.home.tricode} ${game.home.score}`;
      } else {
        // Scores are 0-0 until tip-off; showing them would read as a real
        // result, so an unplayed game shows the matchup and its start time.
        button.textContent = `${game.away.tricode} @ ${game.home.tricode}`;
        button.title = `${game.statusText} — no box score yet`;
        button.disabled = true;
      }

      return button;
    })
  );
}

function markActive(gameId) {
  for (const button of gameList.querySelectorAll(".game")) {
    button.classList.toggle("active", button.dataset.gameId === gameId);
  }
}

function showDate(iso) {
  const day = schedules.get(seasonSelect.value)?.find((d) => d.date === iso);
  if (!day) return;

  dateSelect.value = iso;
  renderGames(day);

  // Land on a game rather than an empty page — the first one that was played.
  const opener = day.games.find(isFinal);
  if (opener) {
    markActive(opener.gameId);
    load(opener.gameId);
    return;
  }

  teams.hidden = true;
  status.hidden = false;
  status.className = "muted";
  status.textContent = "No finished games on this date yet.";
}

async function showSeason(season) {
  if (!schedules.has(season)) {
    status.hidden = false;
    status.className = "muted";
    status.textContent = "Loading schedule…";
    teams.hidden = true;

    try {
      const res = await fetch(`/api/schedule?season=${encodeURIComponent(season)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      schedules.set(season, body.dates);
    } catch (err) {
      status.className = "muted error";
      status.textContent = `Couldn't load the ${season} schedule: ${err.message}`;
      return;
    }
  }

  const dates = schedules.get(season);
  dateSelect.replaceChildren(
    ...dates.map((day) =>
      option(
        day.date,
        `${dateLabel(day.date)} · ${day.games.length} ` +
          (day.games.length === 1 ? "game" : "games")
      )
    )
  );

  // Open on the newest date that has a played game: mid-season that's the
  // latest results, and in the offseason it's the end of the last season.
  const landing = [...dates].reverse().find((day) => day.games.some(isFinal));
  showDate((landing ?? dates.at(-1)).date);
}

seasonSelect.replaceChildren(...seasonOptions().map((s) => option(s, s)));
seasonSelect.value = currentSeason();
seasonSelect.addEventListener("change", () => showSeason(seasonSelect.value));
dateSelect.addEventListener("change", () => showDate(dateSelect.value));

gameList.addEventListener("click", (e) => {
  const button = e.target.closest(".game");
  if (!button) return;
  markActive(button.dataset.gameId);
  load(button.dataset.gameId);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  // A hand-typed ID is usually off the current date, so drop the highlight.
  markActive(null);
  load(input.value.trim());
});

showSeason(currentSeason());
