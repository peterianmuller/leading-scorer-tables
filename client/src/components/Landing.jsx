// The first screen: Games at the top, Players below, each followed by a
// sample of what it shows, so there's something to look at before picking.

import { useEffect, useState } from "react";
import { fetchBoxscore, fetchCareer } from "../lib/api.js";
import { dateLabel } from "../lib/schedule.js";
import CareerCard from "./CareerCard.jsx";
import Matchup from "./Matchup.jsx";
import SwishShot from "./SwishShot.jsx";

// Opening night 2025-26: Warriors at Lakers.
const EXAMPLE_GAME_ID = "0022500002";
const EXAMPLE_PLAYERS = [
  { id: 2544, name: "LeBron James" },
  { id: 201939, name: "Stephen Curry" },
];

function ExampleGame() {
  const [state, setState] = useState({ game: null, error: null });

  useEffect(() => {
    let current = true;
    fetchBoxscore(EXAMPLE_GAME_ID)
      .then((body) => current && setState({ game: body.game, error: null }))
      .catch((err) => current && setState({ game: null, error: err.message }));
    return () => {
      current = false;
    };
  }, []);

  if (state.error) return <p className="muted error">Couldn&rsquo;t load the example game.</p>;
  if (!state.game) return <p className="muted">Loading an example game…</p>;
  const { gameEt, awayTeam: away, homeTeam: home } = state.game;
  // Reads like the game's button in the Games view, plus the day it was played.
  return (
    <>
      <p className="muted example-caption">
        Example game below · {away.teamTricode} {away.score} @ {home.teamTricode} {home.score} ·{" "}
        {dateLabel(gameEt.slice(0, 10))}
      </p>
      <Matchup game={state.game} />
    </>
  );
}

function ExamplePlayers() {
  // personId -> career, filled in as each answer arrives.
  const [careers, setCareers] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    for (const player of EXAMPLE_PLAYERS) {
      fetchCareer(player.id)
        .then((data) => current && setCareers((c) => ({ ...c, [player.id]: data })))
        .catch((err) => current && setError(err.message));
    }
    return () => {
      current = false;
    };
  }, []);

  if (error) return <p className="muted error">Couldn&rsquo;t load the example players.</p>;
  // Wait for both, so the cards don't arrive one at a time in a shifting grid.
  if (EXAMPLE_PLAYERS.some((p) => !careers[p.id])) {
    return <p className="muted">Loading example players…</p>;
  }
  return (
    <section className="example-careers">
      {EXAMPLE_PLAYERS.map((player) => (
        <CareerCard key={player.id} player={player} career={careers[player.id]} />
      ))}
    </section>
  );
}

export default function Landing({ onPick }) {
  return (
    <main className="landing">
      <SwishShot />
      <h1>NBA Stats Soir&eacute;e</h1>
      <p className="muted intro">
        Pick any NBA game since 2019-20 to see how each team&rsquo;s leading scorer got their
        points: their full stat line, how their scoring built up over the game, and where they shot
        from. Or look up anyone who has played in the league for their career averages.
      </p>

      <h2 className="section-title">Games</h2>
      <button type="button" className="open-mode" onClick={() => onPick("games")}>
        Check out any game since 2019-20
      </button>
      <ExampleGame />

      <h2 className="section-title">Players</h2>
      <button type="button" className="open-mode" onClick={() => onPick("players")}>
        Look up any player&rsquo;s career
      </button>
      <ExamplePlayers />
    </main>
  );
}
