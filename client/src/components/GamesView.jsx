// The games mode: browses a season's schedule and shows every stat the CDN
// reports for each team's leading scorer in the chosen game, side by side.

import { useEffect, useRef, useState } from "react";
import { fetchBoxscore, fetchSchedule } from "../lib/api.js";
import { currentSeason, dateLabel, isFinal, landingDate, seasonOptions } from "../lib/schedule.js";
import { parseView, recordView } from "../lib/view.js";
import GameList from "./GameList.jsx";
import Loading from "./Loading.jsx";
import Matchup from "./Matchup.jsx";
import ViewHeader from "./ViewHeader.jsx";

const SEASONS = seasonOptions();

export default function GamesView({ onHome }) {
  const [season, setSeason] = useState(
    () => parseView(window.location.search, SEASONS).season ?? currentSeason(),
  );
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState("");
  const [activeGameId, setActiveGameId] = useState(null);
  const [game, setGame] = useState(null);
  // What to show in place of the cards: a message, optionally an error.
  const [status, setStatus] = useState({ text: "Loading…", loading: true });

  const schedules = useRef(new Map()); // season -> dates, so switching back costs nothing
  // Bumped by every navigation, so a slow response for a game or season the
  // user has already moved past can't overwrite what they're looking at now.
  const latest = useRef(0);

  function showStatus(text, error = false) {
    setGame(null);
    setStatus({ text, error });
  }

  function showLoading(text) {
    setGame(null);
    setStatus({ text, loading: true });
  }

  async function loadGame(gameId) {
    const request = ++latest.current;
    showLoading("Loading…");
    try {
      const body = await fetchBoxscore(gameId);
      if (request !== latest.current) return;
      setGame(body.game);
      setStatus(null);
    } catch (err) {
      if (request === latest.current) showStatus(err.message, true);
    }
  }

  // Picking a game from the list.
  function openGame(gameId) {
    setActiveGameId(gameId);
    recordView({ view: "games", season, date, gameId }, "push");
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
    recordView({ view: "games", season, date: iso, gameId: open }, history);
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
      showLoading("Loading schedule…");
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

  // Shows whatever the URL names: on first load, and on back/forward. A back
  // or forward that leaves the games view is App's to handle.
  function restoreView() {
    const view = parseView(window.location.search, SEASONS);
    if (view.view !== "games") return;
    return showSeason(view.season ?? currentSeason(), { ...view, history: "replace" });
  }

  useEffect(() => {
    // Fetching on mount is what an effect is for; the state it sets up front
    // is the same "Loading…" the page already starts in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restoreView();
    window.addEventListener("popstate", restoreView);
    // A counter, not a DOM node, so it's the live value the cleanup wants.
    const requests = latest;
    return () => {
      window.removeEventListener("popstate", restoreView);
      // Leaving for another view: a schedule still loading mustn't record a
      // games URL over the one that view just set.
      requests.current++;
    };
    // Runs once on mount; later changes go through the controls' handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const games = dates.find((d) => d.date === date)?.games ?? [];

  return (
    <main>
      <header>
        <ViewHeader title="Games" onHome={onHome} />

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
      </header>

      {game && <Matchup game={game} />}

      {status?.loading && <Loading id="status">{status.text}</Loading>}
      {status && !status.loading && (
        <p id="status" className={status.error ? "muted error" : "muted"}>
          {status.text}
        </p>
      )}
    </main>
  );
}
