// The landing's court: its lines draw themselves in, then the example game's
// top scorer's shots pop onto it in the order they were taken. Plays once;
// the motion lives in style.css.

import { useMemo } from "react";
import { DOT, VIEW, playerShots } from "../lib/shots.js";
import { teamLeader } from "../lib/stats.js";
import { CourtLines, Cross } from "./ShotChart.jsx";
import usePlayByPlay from "./usePlayByPlay.js";

// The court draws in as soon as the page does; the shots wait for the game.
export default function ShotHero({ game }) {
  // Whichever leading scorer scored more; the away one on a tie.
  const away = game && teamLeader(game.awayTeam);
  const home = game && teamLeader(game.homeTeam);
  const player =
    away && home ? (home.statistics.points > away.statistics.points ? home : away) : away || home;

  return (
    <figure className="shot-hero">
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        <CourtLines />
        {player && <Shots gameId={game.gameId} player={player} />}
      </svg>
      {player && (
        <figcaption className="muted">
          {player.name}&rsquo;s {player.statistics.fieldGoalsAttempted} shots in the example game
        </figcaption>
      )}
    </figure>
  );
}

function Shots({ gameId, player }) {
  const { actions } = usePlayByPlay(gameId);
  const shots = useMemo(
    () => (actions && player ? playerShots(actions, player.personId) : []),
    [actions, player],
  );

  // Each shot's place in line sets when it pops (see .shot-hero in style.css).
  return shots.map((s, i) =>
    s.made ? (
      <circle
        key={i}
        className="shot-made hero-pop"
        style={{ "--i": i }}
        cx={s.x}
        cy={-s.y}
        r={DOT * 1.6}
      />
    ) : (
      <g key={i} transform={`translate(${s.x},${-s.y}) scale(1.6)`}>
        <g className="hero-pop" style={{ "--i": i }}>
          <Cross className="shot-missed" />
        </g>
      </g>
    ),
  );
}
