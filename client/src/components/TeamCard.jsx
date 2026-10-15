import { pointsByHalf, pointsByPeriod } from "../lib/scoring.js";
import { scoringSummary } from "../lib/stats.js";
import Headshot from "./Headshot.jsx";
import QuarterSplit from "./QuarterSplit.jsx";
import StatTable from "./StatTable.jsx";

// One team's leading scorer. `player` is null for a pregame box score. `flow`
// is their scoring from the play-by-play, null until it loads (or if the game
// has none), and `periods` is how many periods were played.
export default function TeamCard({ team, player, isLeader, flow, periods }) {
  return (
    <article className={isLeader ? "team leader" : "team"}>
      <p className="team-name muted">
        {team.teamCity} {team.teamName} · {team.score}
      </p>

      {player ? (
        <>
          <div className="player-head">
            <Headshot player={player} />
            <div className="player-id">
              <h2 className="player-name">{player.name}</h2>
              <p className="player-meta muted">
                #{player.jerseyNum} · {player.position || "—"}
              </p>
            </div>
          </div>
          <p className="summary">{scoringSummary(player.statistics, flow && pointsByHalf(flow))}</p>
          {flow && <QuarterSplit periods={pointsByPeriod(flow, periods)} />}
          <StatTable stats={player.statistics} />
        </>
      ) : (
        <>
          <h2 className="player-name">—</h2>
          <p className="player-meta muted">No player stats yet</p>
        </>
      )}
    </article>
  );
}
