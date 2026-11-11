// The game's final score across the top of the matchup, away team on the
// left as in the game list. The winner's side is in full ink and the loser's
// is muted, so the result reads before any number does.
export default function Scoreboard({ game }) {
  const { awayTeam: away, homeTeam: home } = game;
  const status = (game.gameStatusText ?? "").trim() || "Final";

  return (
    <section className="scoreboard" aria-label={`${status} score`}>
      <Side team={away} won={away.score > home.score} />
      <p className="sb-status">{status}</p>
      <Side team={home} won={home.score > away.score} home />
    </section>
  );
}

function Side({ team, won, home = false }) {
  return (
    <div className={`sb-team${home ? " home" : ""}${won ? " won" : ""}`}>
      <div className="sb-id">
        <span className="sb-tricode">{team.teamTricode}</span>
        <span className="sb-name">
          {team.teamCity} {team.teamName}
        </span>
      </div>
      <span className="sb-score">{team.score}</span>
    </div>
  );
}
