// Minimal Node.js server that proxies the NBA's public liveData CDN.
// No dependencies, no API key — these are static JSON files.
//
//   node server.js
//   curl "http://localhost:3000/api/scoreboard"
//   curl "http://localhost:3000/api/boxscore"                    # default game
//   curl "http://localhost:3000/api/boxscore?gameId=0022500066"  # any game
//   curl "http://localhost:3000/api/schedule"                     # season's games
//   curl "http://localhost:3000/api/schedule?season=2023-24"
//
// NOTE: still an ES module, so either keep this as server.mjs or add
// { "type": "module" } to package.json.

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const BASE_URL = "https://cdn.nba.com/static/json/liveData";

// The schedule lives on stats.nba.com rather than the liveData CDN. The CDN
// does publish a schedule file, but only for the *upcoming* season — during
// the offseason every game in it is unplayed, so there's no box score to open.
// stats.nba.com takes a Season parameter, which is what makes browsing past
// games possible at all.
const STATS_URL = "https://stats.nba.com/stats";

// Game IDs are 10 digits. Validating matters because the ID goes straight
// into a URL path — never interpolate unchecked user input into a fetch URL.
const GAME_ID = /^\d{10}$/;

// Seasons are "2025-26". liveData box scores exist back to 2019-20; earlier
// seasons return a schedule whose games can't be opened, so reject them here
// rather than let every click 403.
const SEASON = /^(\d{4})-(\d{2})$/;
const EARLIEST_SEASON = 2019;

// Warriors vs Lakers, Oct 21 2025 — the 2025-26 season opener. Used when no
// gameId is supplied, so the routes return real data during the offseason.
const DEFAULT_GAME_ID = "0022500002";

// Live data goes stale fast, so the TTL is per-endpoint rather than global.
const cache = new Map();

// cdn.nba.com sits behind a bot filter that rejects requests with no
// browser-like identity. Without these you get a 403, not a 401 — which
// makes it look like a bad path rather than a blocked client.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// `transform` runs before the result is cached, so an upstream that's mostly
// padding (the schedule is 4.5MB, 189KB of it useful) doesn't sit in memory in
// its raw form for the whole TTL.
async function fetchJson(url, ttlMs, transform = (body) => body) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < ttlMs) {
    return cached.body;
  }

  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    // 403 here means one of two things: the bot filter rejected us, or the
    // file genuinely isn't there. The CDN returns 403 for missing objects
    // rather than 404, so the status alone can't tell you which.
    const err = new Error(
      `NBA returned ${res.status} for ${new URL(url).pathname}. ` +
        (res.status === 403
          ? "Either the request was blocked or that game has no live file."
          : "")
    );
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }

  const body = transform(await res.json());
  cache.set(url, { at: Date.now(), body });
  return body;
}

// Resolves and validates a gameId, falling back to the default when absent.
function resolveGameId(params) {
  const raw = params.get("gameId");
  const gameId = raw === null || raw === "" ? DEFAULT_GAME_ID : raw.trim();
  if (!GAME_ID.test(gameId)) {
    // Echo what came in. An error that hides its input costs you an hour.
    const err = new Error(
      `gameId must be 10 digits, got "${gameId}" (${gameId.length} chars). ` +
        `NBA.com IDs look like 0022500002; ESPN IDs won't work.`
    );
    err.status = 400;
    throw err;
  }
  return gameId;
}

// The season that "now" belongs to, as the NBA labels it. Seasons tip off in
// October, so during the offseason this names the one that just finished —
// which is the useful default, since those games have box scores.
function currentSeason(now = new Date()) {
  const start = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function resolveSeason(params) {
  const raw = params.get("season");
  const season = raw === null || raw === "" ? currentSeason() : raw.trim();
  const match = SEASON.exec(season);

  if (!match || Number(match[1]) < EARLIEST_SEASON) {
    const err = new Error(
      `season must look like 2025-26 and start at ${EARLIEST_SEASON}, got "${season}".`
    );
    err.status = 400;
    throw err;
  }
  return season;
}

// The raw schedule is ~4.5MB of broadcast listings, arena addresses and week
// labels. The browser needs a fraction of that, so it's reduced here: one
// season comes out around 115KB, small enough to fetch once and switch dates
// client-side with no further requests.
function reduceSchedule(payload) {
  const dates = [];

  for (const day of payload.leagueSchedule?.gameDates ?? []) {
    // "10/21/2025 00:00:00" -> "2025-10-21", so dates sort as strings.
    const [month, date, year] = day.gameDate.slice(0, 10).split("/");
    const games = (day.games ?? []).map((game) => ({
      gameId: game.gameId,
      status: game.gameStatus, // 1 scheduled, 2 in progress, 3 final
      statusText: (game.gameStatusText ?? "").trim(),
      away: { tricode: game.awayTeam.teamTricode, score: game.awayTeam.score },
      home: { tricode: game.homeTeam.teamTricode, score: game.homeTeam.score },
    }));

    if (games.length) dates.push({ date: `${year}-${month}-${date}`, games });
  }

  return dates;
}

const routes = {
  // Today's games, scores, and status. Empty during the offseason.
  "/api/scoreboard": () =>
    fetchJson(`${BASE_URL}/scoreboard/todaysScoreboard_00.json`, 20_000),

  // /api/boxscore  or  /api/boxscore?gameId=0022500066
  "/api/boxscore": (params) => {
    const gameId = resolveGameId(params);
    return fetchJson(`${BASE_URL}/boxscore/boxscore_${gameId}.json`, 20_000);
  },

  // /api/schedule  or  /api/schedule?season=2023-24
  // A whole season of games, reduced to what the picker renders. Cached for
  // six hours: a finished season never changes, and a live one only gains
  // scores as games end.
  "/api/schedule": async (params) => {
    const season = resolveSeason(params);
    const dates = await fetchJson(
      `${STATS_URL}/scheduleleaguev2?LeagueID=00&Season=${season}`,
      6 * 60 * 60 * 1000,
      reduceSchedule
    );
    return { season, dates };
  },

  // /api/playbyplay  or  /api/playbyplay?gameId=0022500066
  "/api/playbyplay": (params) => {
    const gameId = resolveGameId(params);
    return fetchJson(`${BASE_URL}/playbyplay/playbyplay_${gameId}.json`, 20_000);
  },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// Serves the front end from ./public. Anything outside that directory or
// with an unknown extension is a 404 — path.resolve + the prefix check is
// what stops "../server.js" from being served.
async function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, rel);
  const type = MIME[path.extname(file)];

  if (!file.startsWith(PUBLIC_DIR + path.sep) || !type) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "Not found", routes: Object.keys(routes) })
    );
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": type });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handler = routes[url.pathname];

  if (!handler) return serveStatic(url.pathname, res);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  try {
    const data = await handler(url.searchParams);
    res.writeHead(200);
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error(err);
    res.writeHead(err.status || 502);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
