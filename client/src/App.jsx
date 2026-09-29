// Browses a season's schedule and shows every stat the CDN reports for each
// team's leading scorer in the chosen game, side by side.

import { useEffect, useRef, useState } from "react";
import { fetchBoxscore, fetchSchedule } from "./lib/api.js";
import { currentSeason, dateLabel, isFinal, landingDate, seasonOptions } from "./lib/schedule.js";
import GameList from "./components/GameList.jsx";
import ManualLoad from "./components/ManualLoad.jsx";
import Matchup from "./components/Matchup.jsx";

const SEASONS = seasonOptions();

export default function App() {
  const [season, setSeason] = useState(currentSeason);
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

  function showDate(days, iso) {
    const day = days.find((d) => d.date === iso);
    if (!day) return;
    setDate(iso);

    // Land on a game rather than an empty page — the first one that was played.
    const opener = day.games.find(isFinal);
    setActiveGameId(opener?.gameId ?? null);
    if (opener) return loadGame(opener.gameId);

    latest.current++;
    showStatus("No finished games on this date yet.");
  }

  async function showSeason(next) {
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
    showDate(days, landingDate(days));
  }

  function loadManual(gameId) {
    // A hand-typed ID is usually off the current date, so drop the highlight.
    setActiveGameId(null);
    loadGame(gameId);
  }

  useEffect(() => {
    showSeason(season);
    // Runs once on mount; later season changes go through the select's handler.
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
            <select value={date} onChange={(e) => showDate(dates, e.target.value)}>
              {dates.map((day) => (
                <option key={day.date} value={day.date}>
                  {dateLabel(day.date)} · {day.games.length}{" "}
                  {day.games.length === 1 ? "game" : "games"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <GameList
          games={games}
          activeGameId={activeGameId}
          onSelect={(gameId) => {
            setActiveGameId(gameId);
            loadGame(gameId);
          }}
        />

        <ManualLoad onLoad={loadManual} />

        {game && (
          <p className="muted">
            {game.awayTeam.teamTricode} {game.awayTeam.score} @{" "}
            {game.homeTeam.teamTricode} {game.homeTeam.score} · {game.gameStatusText}
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
