import { seasonOptions } from "./schedule.js";

// What's on screen, as it's kept in the URL so a link (or the back button)
// brings the same game back: ?season=2024-25&date=2025-01-15&game=0022400123.

// Anything missing or malformed comes back undefined, and the app falls back
// to its usual landing spot for that piece.
export function parseView(search, seasons = seasonOptions()) {
  const params = new URLSearchParams(search);
  const season = params.get("season");
  const date = params.get("date");
  const gameId = params.get("game");
  return {
    season: seasons.includes(season) ? season : undefined,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    gameId: /^\d{10}$/.test(gameId) ? gameId : undefined,
  };
}

export function viewSearch({ season, date, gameId }) {
  const params = new URLSearchParams();
  if (season) params.set("season", season);
  if (date) params.set("date", date);
  if (gameId) params.set("game", gameId);
  const search = params.toString();
  return search ? `?${search}` : "";
}
