import { seasonOptions } from "./schedule.js";

// What's on screen, as it's kept in the URL so a link (or the back button)
// brings the same view back:
//   (nothing)                                          the landing screen
//   ?view=games&season=2024-25&date=2025-01-15&game=0022400123
//   ?view=players&player=2544
// Links from before the landing screen existed have no `view`, only the game
// params, and still open the game they name.

const VIEWS = ["games", "players"];

// Anything missing or malformed comes back undefined, and the app falls back
// to its usual landing spot for that piece.
export function parseView(search, seasons = seasonOptions()) {
  const params = new URLSearchParams(search);
  const season = params.get("season");
  const date = params.get("date");
  const gameId = params.get("game");
  const playerId = params.get("player");
  const named = params.get("view");
  const view = VIEWS.includes(named)
    ? named
    : season || date || gameId
      ? "games"
      : playerId
        ? "players"
        : "home";

  if (view === "players") {
    return { view, playerId: /^\d{1,10}$/.test(playerId) ? playerId : undefined };
  }
  if (view === "games") {
    return {
      view,
      season: seasons.includes(season) ? season : undefined,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      gameId: /^\d{10}$/.test(gameId) ? gameId : undefined,
    };
  }
  return { view };
}

export function viewSearch({ view, season, date, gameId, playerId }) {
  const params = new URLSearchParams();
  if (view === "games") {
    params.set("view", view);
    if (season) params.set("season", season);
    if (date) params.set("date", date);
    if (gameId) params.set("game", gameId);
  } else if (view === "players") {
    params.set("view", view);
    if (playerId) params.set("player", playerId);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

// Keeps the URL in step with the view, so it can be shared or bookmarked. A
// click "push"es a history entry for the back button; restoring a view from
// the URL "replace"s, which only tidies up whatever the URL got wrong.
export function recordView(view, history) {
  const search = viewSearch(view);
  if (search === window.location.search) return;
  const url = window.location.pathname + search;
  if (history === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}
