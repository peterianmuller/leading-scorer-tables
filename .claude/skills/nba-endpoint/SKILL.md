---
name: nba-endpoint
description: Add or change an /api route in server.js that proxies NBA data (cdn.nba.com liveData or stats.nba.com). Use when adding a new NBA data source, changing an existing route's upstream, caching or validation, or debugging a 403/502 from an /api route.
---

# Adding or changing an NBA endpoint

`server.js` is a dependency-free Node proxy in front of two NBA upstreams. Every
route is an entry in the `routes` table that validates its params, then calls
`fetchJson(url, ttlMs, transform?)`. Keep it that way: no npm dependencies on
the server, and no route that calls `fetch` directly.

## Pick the upstream

| Upstream | Constant | Use it for |
| --- | --- | --- |
| `https://cdn.nba.com/static/json/liveData` | `BASE_URL` | Per-game files: `boxscore/boxscore_{gameId}.json`, `playbyplay/playbyplay_{gameId}.json`, and `scoreboard/todaysScoreboard_00.json` |
| `https://stats.nba.com/stats` | `STATS_URL` | Anything keyed by season or that needs query params, e.g. `scheduleleaguev2?LeagueID=00&Season=2025-26` |

- The CDN only publishes the *upcoming* season's schedule. During the offseason
  every game in it is unplayed, which is why the schedule comes from
  stats.nba.com instead.
- liveData box scores exist back to 2019-20 only (`EARLIEST_SEASON`). Anything
  that leads to a game file must not offer earlier seasons.
- Before writing the route, curl the upstream URL with the headers from
  `HEADERS` to see the real response shape. Don't guess field names.

## Headers and the misleading 403

`fetchJson` always sends `HEADERS` (browser `User-Agent`, `Referer` and
`Origin` of nba.com). Without them the bot filter returns **403**, not 401,
which looks like a bad path. The CDN *also* returns 403 for files that don't
exist (for example, a game with no live file yet), so a 403 alone doesn't tell
you which problem you have. If a new route 403s, check the headers first, then
the path.

`fetchJson` maps upstream 404 → 404 and everything else → 502, and never caches
failures. Don't add a separate error path in a route.

## Validate input before it reaches a URL

Params are interpolated straight into upstream URLs, so validate them first:

- Game IDs: `resolveGameId(params)`, 10 digits (`GAME_ID`), defaulting to
  `DEFAULT_GAME_ID` so the route returns real data during the offseason.
- Seasons: `resolveSeason(params)`, `YYYY-YY` from 2019 onward, defaulting to
  `currentSeason()` (October rollover).
- For a new kind of param, write a `resolveX(params)` helper in the same style:
  a strict regex, `err.status = 400`, and an error message that **echoes the
  input it got** and shows a valid example. Export it so it can be tested.

## Cache TTL and transform

- Pick the TTL per endpoint based on how fast the data changes: 20 s for live
  game data (`20_000`), 6 h for a season schedule. A finished game or season
  never changes.
- If the upstream response is much bigger than what the client renders, pass a
  `transform` (like `reduceSchedule`). It runs **before** caching, so the raw
  payload is never held in memory for the whole TTL. The raw schedule is
  ~4.5 MB, of which ~189 KB is used. Export the transform so it can be tested
  on its own.

## Checklist

1. Add the route to `routes` in `server.js` with a comment showing its URL
   forms (`// /api/foo  or  /api/foo?gameId=...`) and why its TTL was chosen.
2. Add a matching `curl` example to the header comment at the top of
   `server.js`.
3. Add tests in `test/server.test.js`:
   - Unit tests for any new `resolveX` or transform helper.
   - In the `HTTP server` describe block, stub the upstream with
     `upstream(status, body)` and request with `get(port, path)`. Assert the
     exact upstream URL from `fetchMock.mock.calls`, and that bad input returns
     400 with `fetchMock.mock.callCount() === 0`.
   - Keep upstream bodies inline and minimal (only the fields the code reads).
     The suite must run offline.
4. If the client uses it, add a helper to `client/src/lib/api.js` next to the
   existing ones, using `encodeURIComponent` on params.
5. Run `npm test` and make sure it passes. Then check against the real upstream:
   `npm start` and `curl` the new route.
