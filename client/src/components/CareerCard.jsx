import { formatValue } from "../lib/stats.js";
import Headshot from "./Headshot.jsx";
import StatTable from "./StatTable.jsx";

// The box score's key stats, as career averages.
const LABELS = {
  points: "Points per game",
  fieldGoalsPercentage: "FG %",
  reboundsTotal: "Rebounds per game",
  assists: "Assists per game",
  plusMinusPoints: "Plus/Minus per game",
};

// Averages always show one decimal ("27.0", not "27"). null is a stat the
// league didn't keep yet when the player played.
function format(key, value) {
  if (value === null || value === undefined) return "—";
  if (key.endsWith("Percentage")) return formatValue(key, value);
  return `${key === "plusMinusPoints" && value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

// Why plus/minus is blank or covers only part of a career.
function plusMinusNote({ counted, total }) {
  if (counted === 0) return "Plus/minus wasn't tracked until 1996-97.";
  if (counted < total) {
    return `Plus/minus covers ${counted} of ${total} seasons; the NBA started tracking it in 1996-97.`;
  }
  return null;
}

// One player's career: who they are, how long they played, and their
// regular-season averages for the same five stats a game card leads with.
export default function CareerCard({ player, career }) {
  const note = plusMinusNote(career.plusMinusSeasons);
  const span = career.first === career.last ? career.first : `${career.first} to ${career.last}`;

  return (
    <article className="team career">
      <p className="team-name muted">Career · Regular season</p>
      <div className="player-head">
        <Headshot player={{ personId: player.id, name: player.name }} />
        <div className="player-id">
          <h2 className="player-name">{player.name}</h2>
          <p className="player-meta muted">
            {span} · {career.gamesPlayed.toLocaleString()} games
          </p>
        </div>
      </div>
      <StatTable stats={career.stats} labels={LABELS} format={format} />
      {note && <p className="muted footnote">{note}</p>}
    </article>
  );
}
