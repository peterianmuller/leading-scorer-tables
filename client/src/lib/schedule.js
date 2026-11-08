const EARLIEST_SEASON = 2019; // matches the server's floor

// Mirrors currentSeason() on the server: seasons tip off in October, so before
// then the newest season with games played is the previous year's.
export function currentSeason(now = new Date()) {
  const start = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function seasonOptions() {
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
export const dateLabel = (iso) => DATE_LABEL.format(new Date(`${iso}T00:00:00Z`));

// Only a finished game has a box score to open.
export const isFinal = (game) => game.status === 3;

// The season before "2025-26": "2024-25".
export function previousSeason(season) {
  const start = Number(season.slice(0, 4)) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// Whether any game in the schedule has finished. False for a season that
// hasn't tipped off yet: between October 1, when currentSeason() rolls over,
// and opening night later in the month.
export const hasFinalGame = (dates) => dates.some((day) => day.games.some(isFinal));

// Open on the newest date that has a played game: mid-season that's the
// latest results, and in the offseason it's the end of the last season. A
// season with nothing played yet opens on opening night, not on a date months
// away.
export function landingDate(dates) {
  const landing = dates.findLast((day) => day.games.some(isFinal));
  return (landing ?? dates[0])?.date;
}
