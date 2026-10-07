import Headshot from "./Headshot.jsx";
import StatTable from "./StatTable.jsx";

// One team's leading scorer. `player` is null for a pregame box score.
export default function TeamCard({ team, player, isLeader }) {
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
