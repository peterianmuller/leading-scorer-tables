// "José Calderón" and "Shaquille O'Neal" should be found by "jose" and
// "oneal": accents, case and in-name punctuation don't count.
const fold = (s) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[.'’]/g, "").toLowerCase().trim();

// Players whose name fits what's been typed so far, best first, for the
// search box. Every word typed has to start a word of the name, so "jam"
// finds LeBron James and "l jam" narrows it. Names that start with the whole
// query come first, then by most recent final season, so today's player beats
// a namesake from the 1960s.
export function matchPlayers(players, query, limit = 8) {
  const q = fold(query).replace(/\s+/g, " ");
  if (!q) return [];
  const words = q.split(" ");

  const found = [];
  for (const player of players) {
    const name = fold(player.name);
    const parts = name.split(/[\s-]+/);
    if (!words.every((w) => parts.some((p) => p.startsWith(w)))) continue;
    found.push({ player, rank: name.startsWith(q) ? 0 : 1 });
  }

  return found
    .sort(
      (a, b) =>
        a.rank - b.rank || b.player.to - a.player.to || a.player.name.localeCompare(b.player.name),
    )
    .slice(0, limit)
    .map((f) => f.player);
}

// The years a player's list entry shows: their first season's start to their
// last season's end, so LeBron's 2003-04 to 2025-26 reads "2003–2026".
export const careerYears = (player) => `${player.from}–${player.to + 1}`;
