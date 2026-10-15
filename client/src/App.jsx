// Browses a season's schedule and shows every stat the CDN reports for each
// team's leading scorer in the chosen game, side by side.

import { useEffect, useRef, useState } from "react";
import { fetchBoxscore, fetchSchedule } from "./lib/api.js";
import { currentSeason, dateLabel, isFinal, landingDate, seasonOptions } from "./lib/schedule.js";
import GameList from "./components/GameList.jsx";
import ManualLoad from "./components/ManualLoad.jsx";
import Matchup from "./components/Matchup.jsx";
import { parseView, viewSearch } from "./lib/view.js";

const SEASONS = seasonOptions();

export default function App() {
  const [season, setSeason] = useState(
    () => parseView(window.location.search, SEASONS).season ?? currentSeason(),
  );
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState("");
  const [activeGameId, setActiveGameId] = useState(null);
  const [game, setGame] = useState(null);
  // What to show in place of the cards: a message, optionally an error.
  const [status, setStatus] = useState({ text: "Loading…" });

  const schedules = useRef(new Map()); // season -> dates, so switching back costs nothing
  // Bumped by every navigation, so a slow response for a game or season the
  // user has already moved past can't overwrite what they're looking at now.
  const latest = useRef(0);

  function showStatus(text, error = false) {
    setGame(null);
    setStatus({ text, error });
  }

  async function loadGame(gameId) {
    const request = ++latest.current;
    showStatus("Loading…");
    try {
      const body = await fetchBoxscore(gameId);
      if (request !== latest.current) return;
      setGame(body.game);
      setStatus(null);
    } catch (err) {
      if (request === latest.current) showStatus(err.message, true);
    }
  }

  // Keeps the URL in step with the view, so it can be shared or bookmarked. A
  // click "push"es a history entry for the back button; restoring a view from
  // the URL "replace"s, which only tidies up whatever the URL got wrong.
  function recordView(view, history) {
    const search = viewSearch(view);
    if (search === window.location.search) return;
    const url = window.location.pathname + search;
    if (history === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  // Picking a game from the list or by ID. A typed-in ID can be from any date;
  // it's highlighted only if it happens to be on the one showing.
  function openGame(gameId) {
    setActiveGameId(gameId);
    recordView({ season, date, gameId }, "push");
    loadGame(gameId);
  }

  // `gameId` opens that game instead of the date's first, for a linked view.
  function showDate(season, days, iso, { gameId, history = "push" } = {}) {
    const day = days.find((d) => d.date === iso);
    if (!day) return;
    setDate(iso);

    // Land on a game rather than an empty page — the first one that was played.
    const open = gameId ?? day.games.find(isFinal)?.gameId;
    setActiveGameId(open ?? null);
    recordView({ season, date: iso, gameId: open }, history);
    if (open) return loadGame(open);

    latest.current++;
    showStatus("No finished games on this date yet.");
  }

  // `want` names a date and game to land on instead of the usual ones, plus how
  // to record the view in history (see showDate).
  async function showSeason(next, { date: wantDate, ...want } = {}) {
    setSeason(next);
    let days = schedules.current.get(next);

    if (!days) {
      const request = ++latest.current;
      setDates([]);
      showStatus("Loading schedule…");
      try {
        days = (await fetchSchedule(next)).dates;
        schedules.current.set(next, days);
      } catch (err) {
        if (request === latest.current) {
          showStatus(`Couldn't load the ${next} schedule: ${err.message}`, true);
        }
        return;
      }
      if (request !== latest.current) return;
    }

    setDates(days);
    const landing = days.some((d) => d.date === wantDate) ? wantDate : landingDate(days);
    showDate(next, days, landing, want);
  }

  // Shows whatever the URL names: on first load, and on back/forward.
  function restoreView() {
    const view = parseView(window.location.search, SEASONS);
    return showSeason(view.season ?? currentSeason(), { ...view, history: "replace" });
  }

  useEffect(() => {
    // Fetching on mount is what an effect is for; the state it sets up front
    // is the same "Loading…" the page already starts in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restoreView();
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
    // Runs once on mount; later changes go through the controls' handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const games = dates.find((d) => d.date === date)?.games ?? [];

  return (
    <main>
      <header>
        <h1>Leading Scorers</h1>

        <div className="controls">
          <label>
            Season
            <select value={season} onChange={(e) => showSeason(e.target.value)}>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <select value={date} onChange={(e) => showDate(season, dates, e.target.value)}>
              {dates.map((day) => (
                <option key={day.date} value={day.date}>
                  {dateLabel(day.date)} · {day.games.length}{" "}
                  {day.games.length === 1 ? "game" : "games"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <GameList games={games} activeGameId={activeGameId} onSelect={openGame} />

        <ManualLoad onLoad={openGame} />

        {game && (
          <p className="muted">
            {game.awayTeam.teamTricode} {game.awayTeam.score} @ {game.homeTeam.teamTricode}{" "}
            {game.homeTeam.score} · {game.gameStatusText}
          </p>
        )}
      </header>

      {game && <Matchup game={game} />}

      {status && (
        <p id="status" className={status.error ? "muted error" : "muted"}>
          {status.text}
        </p>
      )}
    </main>
  );
}
