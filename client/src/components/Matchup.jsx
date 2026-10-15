import { useMemo } from "react";
import { lastPeriod, scoringFlow } from "../lib/scoring.js";
import { teamLeader } from "../lib/stats.js";
import ScoringFlow from "./ScoringFlow.jsx";
import ShotCharts from "./ShotChart.jsx";
import TeamCard from "./TeamCard.jsx";
import usePlayByPlay from "./usePlayByPlay.js";

// Both teams' leading scorers: their stat lines side by side, then how their
// points built up over the game and where they shot from, away first so
// everything reads in the same order as the matchup line.
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

  // Each card's scoring by period, once the play-by-play is in.
  const { actions } = pbp;
  const periods = useMemo(() => actions && lastPeriod(actions), [actions]);
  const awayFlow = useMemo(
    () => actions && away && scoringFlow(actions, away.personId),
    [actions, away],
  );
  const homeFlow = useMemo(
    () => actions && home && scoringFlow(actions, home.personId),
    [actions, home],
  );

  // Flag whichever leader outscored the other. A tie flags neither — there's
  // no single top scorer to point at.
  return (
    <>
      <section id="teams">
        <TeamCard
          team={game.awayTeam}
          player={away}
          isLeader={awayPoints > homePoints}
          flow={awayFlow}
          periods={periods}
        />
        <TeamCard
          team={game.homeTeam}
          player={home}
          isLeader={homePoints > awayPoints}
          flow={homeFlow}
          periods={periods}
        />
      </section>
      {charted.length > 0 && (
        <>
          <ScoringFlow pbp={pbp} players={charted} />
          <ShotCharts pbp={pbp} players={charted} />
        </>
      )}
    </>
  );
}
