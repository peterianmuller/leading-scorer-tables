import { teamLeader } from "../lib/stats.js";
import TeamCard from "./TeamCard.jsx";

// Both teams' leading scorers side by side, away first so the cards read in
// the same order as the matchup line.
export default function Matchup({ game }) {
  const away = teamLeader(game.awayTeam);
  const home = teamLeader(game.homeTeam);
  const awayPoints = away?.statistics.points ?? -1;
  const homePoints = home?.statistics.points ?? -1;

  // Flag whichever leader outscored the other. A tie flags neither — there's
  // no single top scorer to point at.
  return (
    <section id="teams">
      <TeamCard team={game.awayTeam} player={away} isLeader={awayPoints > homePoints} />
      <TeamCard team={game.homeTeam} player={home} isLeader={homePoints > awayPoints} />
    </section>
  );
}
