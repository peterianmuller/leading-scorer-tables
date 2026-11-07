// The server answers errors with { error }, so surface that rather than a
// bare status code. Not every response comes from it, though: with the API
// server stopped, Vite's dev proxy sends an empty 500, and a host's error page
// is HTML. Those get a plain message rather than "Unexpected end of JSON input".
export async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    throw new Error(body?.error || `The server answered ${res.status} ${res.statusText}`.trim());
  }
  if (body === undefined) throw new Error("The server sent a response that isn't JSON.");
  return body;
}

export const fetchBoxscore = (gameId) =>
  getJson(`/api/boxscore${gameId ? `?gameId=${encodeURIComponent(gameId)}` : ""}`);

export const fetchSchedule = (season) =>
  getJson(`/api/schedule?season=${encodeURIComponent(season)}`);

export const fetchPlayByPlay = (gameId) =>
  getJson(`/api/playbyplay?gameId=${encodeURIComponent(gameId)}`);

export const fetchPlayers = () => getJson("/api/players");

export const fetchCareer = (personId) =>
  getJson(`/api/career?personId=${encodeURIComponent(personId)}`);

export const fetchHeadshot = (personId) =>
  getJson(`/api/headshot?personId=${encodeURIComponent(personId)}`);
