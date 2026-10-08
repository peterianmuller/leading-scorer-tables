import { teamLeader } from "../lib/stats.js";
import ScoringFlow from "./ScoringFlow.jsx";
import TeamCard from "./TeamCard.jsx";

// Both teams' leading scorers: how their points built up over the game, then
// their full stat lines side by side, away first so everything reads in the
// same order as the matchup line.
export default function Matchup({ game }) {
  const away = teamLeader(game.awayTeam);
  const home = teamLeader(game.homeTeam);
  const awayPoints = away?.statistics.points ?? -1;
  const homePoints = home?.statistics.points ?? -1;

  // Pregame box scores have no players, so there's nothing to chart yet.
  const charted = [
    { team: game.awayTeam, player: away },
    { team: game.homeTeam, player: home },
  ].filter((s) => s.player);

  // Flag whichever leader outscored the other. A tie flags neither — there's
  // no single top scorer to point at.
  return (
    <>
      {charted.length > 0 && <ScoringFlow gameId={game.gameId} players={charted} />}
      <section id="teams">
        <TeamCard team={game.awayTeam} player={away} isLeader={awayPoints > homePoints} />
        <TeamCard team={game.homeTeam} player={home} isLeader={homePoints > awayPoints} />
      </section>
    </>
  );
}
