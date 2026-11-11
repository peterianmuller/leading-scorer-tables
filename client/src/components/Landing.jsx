// The first screen: Games at the top, Players below, each followed by a
// sample of what it shows, so there's something to look at before picking.

import { useEffect, useState } from "react";
import { fetchBoxscore, fetchCareer } from "../lib/api.js";
import { dateLabel } from "../lib/schedule.js";
import CareerCard from "./CareerCard.jsx";
import Matchup from "./Matchup.jsx";
import ShotHero from "./ShotHero.jsx";
import usePlayByPlay from "./usePlayByPlay.js";

// Opening night 2025-26: Warriors at Lakers.
const EXAMPLE_GAME_ID = "0022500002";
const EXAMPLE_PLAYERS = [
  { id: 2544, name: "LeBron James" },
  { id: 201939, name: "Stephen Curry" },
];

// Fetched once by the landing, for the court at the top and the full matchup
// below.
function useExampleGame() {
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

  return state;
}

function ExampleGame({ state, pbp }) {
  if (state.error) return <p className="muted error">Couldn&rsquo;t load the example game.</p>;
  if (!state.game) return <p className="muted">Loading an example game…</p>;
  // The scoreboard below has the teams and score; this says it's a sample.
  return (
    <>
      <p className="muted example-caption">
        Example game · {dateLabel(state.game.gameEt.slice(0, 10))}
      </p>
      <Matchup game={state.game} pbp={pbp} />
    </>
  );
}

function ExamplePlayers() {
  // personId -> career, filled in as each answer arrives. A player with no
  // regular-season games answers null, and a failed lookup is stored as null
  // too, so one player's error doesn't take the other's card down with it.
  const [careers, setCareers] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    for (const player of EXAMPLE_PLAYERS) {
      const answer = (data) => current && setCareers((c) => ({ ...c, [player.id]: data }));
      fetchCareer(player.id)
        .then(answer)
        .catch(() => {
          if (current) setFailed(true);
          answer(null);
        });
    }
    return () => {
      current = false;
    };
  }, []);

  // Wait for both, so the cards don't arrive one at a time in a shifting grid.
  if (EXAMPLE_PLAYERS.some((p) => !(p.id in careers))) {
    return <p className="muted">Loading example players…</p>;
  }
  const shown = EXAMPLE_PLAYERS.filter((p) => careers[p.id]);
  if (!shown.length) {
    return failed ? (
      <p className="muted error">Couldn&rsquo;t load the example players.</p>
    ) : (
      <p className="muted">No career numbers for the example players.</p>
    );
  }
  return (
    <section className="example-careers">
      {shown.map((player) => (
        <CareerCard key={player.id} player={player} career={careers[player.id]} />
      ))}
    </section>
  );
}

export default function Landing({ onPick }) {
  const example = useExampleGame();
  // One download of the play-by-play for both the court and the matchup.
  const pbp = usePlayByPlay(example.game?.gameId);

  return (
    <main className="landing">
      <header className="hero">
        <div>
          <h1>NBA Stats Soir&eacute;e</h1>
          <p className="muted intro">
            Pick any NBA game since 2019-20 to see how each team&rsquo;s leading scorer got their
            points: their full stat line, how their scoring built up over the game, and where they
            shot from. Or look up anyone who has played in the league for their career averages.
          </p>
        </div>
        <ShotHero game={example.game} pbp={pbp} />
      </header>

      <h2 className="section-title">Games</h2>
      <button type="button" className="open-mode" onClick={() => onPick("games")}>
        Check out any game since 2019-20 <span aria-hidden="true">→</span>
      </button>
      <ExampleGame state={example} pbp={pbp} />

      <h2 className="section-title">Players</h2>
      <button type="button" className="open-mode" onClick={() => onPick("players")}>
        Look up any player&rsquo;s career <span aria-hidden="true">→</span>
      </button>
      <ExamplePlayers />
    </main>
  );
}
