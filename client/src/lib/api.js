// The server answers errors with { error }, so surface that rather than a
// bare status code.
export async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const fetchBoxscore = (gameId) =>
  getJson(`/api/boxscore${gameId ? `?gameId=${encodeURIComponent(gameId)}` : ""}`);

export const fetchSchedule = (season) =>
  getJson(`/api/schedule?season=${encodeURIComponent(season)}`);
