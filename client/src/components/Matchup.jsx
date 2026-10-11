import { useMemo } from "react";
import { teamLeader } from "../lib/stats.js";
import ScoringFlow from "./ScoringFlow.jsx";
import ShotCharts from "./ShotChart.jsx";
import TeamCard from "./TeamCard.jsx";
import usePlayByPlay from "./usePlayByPlay.js";

// Both teams' leading scorers: how their points built up over the game, where
// they shot from, then their stat lines side by side, away first so everything
// reads in the same order as the matchup line.
export default function Matchup({ game }) {
  const away = teamLeader(game.awayTeam);
  const home = teamLeader(game.homeTeam);
  const awayPoints = away?.statistics.points ?? -1;
  const homePoints = home?.statistics.points ?? -1;

  const pbp = usePlayByPlay(game.gameId);

  // Pregame box scores have no players, so there's nothing to chart yet.
  // Memoized so the charts' per-game work doesn't rerun on every render.
  const charted = useMemo(
    () =>
      [
        { team: game.awayTeam, player: away },
        { team: game.homeTeam, player: home },
      ].filter((s) => s.player),
    [game, away, home],
  );

  // Flag whichever leader outscored the other. A tie flags neither — there's
  // no single top scorer to point at.
  return (
    <>
      {charted.length > 0 && (
        <>
          <ScoringFlow pbp={pbp} players={charted} />
          <ShotCharts pbp={pbp} players={charted} />
        </>
      )}
      <section id="teams">
        <TeamCard team={game.awayTeam} player={away} isLeader={awayPoints > homePoints} />
        <TeamCard team={game.homeTeam} player={home} isLeader={homePoints > awayPoints} />
      </section>
    </>
  );
}
