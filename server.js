// Minimal Node.js server that proxies the NBA's public liveData CDN.
// No dependencies, no API key — these are static JSON files.
//
//   node server.js
//   curl "http://localhost:3000/api/scoreboard"
//   curl "http://localhost:3000/api/boxscore"                    # default game
//   curl "http://localhost:3000/api/boxscore?gameId=0022500066"  # any game
//   curl "http://localhost:3000/api/schedule"                     # season's games
//   curl "http://localhost:3000/api/schedule?season=2023-24"
//   curl "http://localhost:3000/api/headshot?personId=2544"       # Commons photo
//
// NOTE: still an ES module, so either keep this as server.mjs or add
// { "type": "module" } to package.json.

import http from "node:http";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PORT = process.env.PORT || 3000;
// The built React app (`npm run build`). STATIC_DIR overrides it — the tests
// point it at a fixture directory so they don't depend on a build.
const STATIC_DIR = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const BASE_URL = "https://cdn.nba.com/static/json/liveData";

// The schedule lives on stats.nba.com rather than the liveData CDN. The CDN
// does publish a schedule file, but only for the *upcoming* season — during
// the offseason every game in it is unplayed, so there's no box score to open.
// stats.nba.com takes a Season parameter, which is what makes browsing past
// games possible at all.
const STATS_URL = "https://stats.nba.com/stats";

// Player photos come from Wikimedia rather than the NBA, whose headshots are
// copyrighted. Wikidata maps the NBA.com player ID (property P3647) to the
// player's item, and its page_image_free prop names a freely licensed Commons
// photo. Commons then supplies a thumbnail plus the credit the license needs.
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Wikimedia asks API clients for a descriptive User-Agent with a way to reach
// the maintainer, rather than the browser disguise the NBA needs.
const WIKI_HEADERS = {
  "User-Agent":
    "leading-scorer-tables/1.0 (https://github.com/peterianmuller/leading-scorer-tables)",
  Accept: "application/json",
};

// NBA.com person IDs are numeric: 2544 for LeBron James, 1630559 for newer
// players. Validated for the same reason as game IDs.
const PERSON_ID = /^\d{1,10}$/;

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
export const DEFAULT_GAME_ID = "0022500002";

// Live data goes stale fast, so the TTL is per-endpoint rather than global.
export const cache = new Map();

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
// its raw form for the whole TTL. `headers` and `upstream` default to the NBA;
// the Wikimedia lookups pass their own.
export async function fetchJson(
  url,
  ttlMs,
  transform = (body) => body,
  { headers = HEADERS, upstream = "NBA" } = {},
) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < ttlMs) {
    return cached.body;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    // 403 here means one of two things: the bot filter rejected us, or the
    // file genuinely isn't there. The CDN returns 403 for missing objects
    // rather than 404, so the status alone can't tell you which.
    const err = new Error(
      `${upstream} returned ${res.status} for ${new URL(url).pathname}. ` +
        (res.status === 403 && upstream === "NBA"
          ? "Either the request was blocked or that game has no live file."
          : ""),
    );
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }

  const body = transform(await res.json());
  cache.set(url, { at: Date.now(), body });
  return body;
}

// Resolves and validates a gameId, falling back to the default when absent.
export function resolveGameId(params) {
  const raw = params.get("gameId");
  const gameId = raw === null || raw === "" ? DEFAULT_GAME_ID : raw.trim();
  if (!GAME_ID.test(gameId)) {
    // Echo what came in. An error that hides its input costs you an hour.
    const err = new Error(
      `gameId must be 10 digits, got "${gameId}" (${gameId.length} chars). ` +
        `NBA.com IDs look like 0022500002; ESPN IDs won't work.`,
    );
    err.status = 400;
    throw err;
  }
  return gameId;
}

// The season that "now" belongs to, as the NBA labels it. Seasons tip off in
// October, so during the offseason this names the one that just finished —
// which is the useful default, since those games have box scores.
export function currentSeason(now = new Date()) {
  const start = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function resolveSeason(params) {
  const raw = params.get("season");
  const season = raw === null || raw === "" ? currentSeason() : raw.trim();
  const match = SEASON.exec(season);

  if (!match || Number(match[1]) < EARLIEST_SEASON) {
    const err = new Error(
      `season must look like 2025-26 and start at ${EARLIEST_SEASON}, got "${season}".`,
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
export function reduceSchedule(payload) {
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

// Unlike gameId, personId has no sensible default, so it's required.
export function resolvePersonId(params) {
  const personId = (params.get("personId") ?? "").trim();
  if (!PERSON_ID.test(personId)) {
    const err = new Error(
      `personId must be an NBA.com player ID of up to 10 digits, got "${personId}". ` +
        `LeBron James is 2544.`,
    );
    err.status = 400;
    throw err;
  }
  return personId;
}

// Wikidata search result -> the Commons file name of the player's free photo,
// or null when the player has no Wikidata item or the item has no photo.
export function pickWikidataImage(payload) {
  const [page] = Object.values(payload.query?.pages ?? {});
  return page?.pageprops?.page_image_free ?? null;
}

// Commons' Artist field is HTML, usually a link to the photographer's profile.
// The client renders text, so tags go and the common entities are decoded.
export function plainText(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Commons imageinfo -> the thumbnail plus what the license says must be shown
// with it: who took it, under which license, and a link back to the file page.
export function reduceImageInfo(payload) {
  const [page] = Object.values(payload.query?.pages ?? {});
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl) return null;

  const meta = info.extmetadata ?? {};
  return {
    // Commons appends utm_* tracking params to the thumbnail; they're not needed.
    url: info.thumburl.split("?")[0],
    page: info.descriptionurl,
    artist: meta.Artist ? plainText(meta.Artist.value) || null : null,
    license: meta.LicenseShortName?.value ?? null,
    licenseUrl: meta.LicenseUrl?.value ?? null,
  };
}

export const routes = {
  // Today's games, scores, and status. Empty during the offseason.
  "/api/scoreboard": () => fetchJson(`${BASE_URL}/scoreboard/todaysScoreboard_00.json`, 20_000),

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
      reduceSchedule,
    );
    return { season, dates };
  },

  // /api/playbyplay  or  /api/playbyplay?gameId=0022500066
  "/api/playbyplay": (params) => {
    const gameId = resolveGameId(params);
    return fetchJson(`${BASE_URL}/playbyplay/playbyplay_${gameId}.json`, 20_000);
  },

  // /api/headshot?personId=2544
  // { url, page, artist, license, licenseUrl } for a freely licensed Commons
  // photo of the player, or null when Wikimedia has none. Both lookups are
  // cached for a day, misses included: a player's photo rarely changes, and
  // every box score asks again for the same handful of players.
  "/api/headshot": async (params) => {
    const personId = resolvePersonId(params);
    const day = 24 * 60 * 60 * 1000;
    const wiki = { headers: WIKI_HEADERS, upstream: "Wikimedia" };

    const search = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `haswbstatement:P3647=${personId}`,
      gsrlimit: "1",
      prop: "pageprops",
      ppprop: "page_image_free",
    });
    const file = await fetchJson(`${WIKIDATA_API}?${search}`, day, pickWikidataImage, wiki);
    if (!file) return null;

    const info = new URLSearchParams({
      action: "query",
      format: "json",
      titles: `File:${file}`,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "330", // a size Commons pre-renders; others are rounded up to one
      iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
    });
    return fetchJson(`${COMMONS_API}?${info}`, day, reduceImageInfo, wiki);
  },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Serves the built front end from STATIC_DIR. Anything outside that directory or
// with an unknown extension is a 404 — path.resolve + the prefix check is
// what stops "../server.js" from being served.
async function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(STATIC_DIR, rel);
  const type = MIME[path.extname(file)];

  if (!file.startsWith(STATIC_DIR + path.sep) || !type) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found", routes: Object.keys(routes) }));
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

export const server = http.createServer(async (req, res) => {
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

// Only listen when run directly (`node server.js`). The tests import this
// module and start the server on a port of their own.
//
// import.meta.url is realpath-resolved by the ESM loader, so argv[1] has to be
// resolved the same way or a launch through any symlink (npm link, a symlinked
// release dir, /tmp on macOS) would quietly skip listen() and exit 0.
function isMainModule() {
  // Node >= 24.2 answers this directly, and gets `node server` (no extension)
  // right as well.
  if (typeof import.meta.main === "boolean") return import.meta.main;

  const entry = process.argv[1];
  if (!entry) return false; // --eval, REPL, stdin
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false; // entry vanished, or a permission error on the realpath
  }
}

if (isMainModule()) {
  server.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
    if (!existsSync(path.join(STATIC_DIR, "index.html"))) {
      console.warn(`No front end in ${STATIC_DIR} — run \`npm run build\` first.`);
    }
  });
}
