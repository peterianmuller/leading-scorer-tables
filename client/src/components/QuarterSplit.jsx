import { periodLabel } from "../lib/scoring.js";

// Points in each quarter (and overtime), with the player's best one marked, so
// a fast starter reads differently from a closer.
export default function QuarterSplit({ periods }) {
  const best = Math.max(...periods.map((p) => p.points));

  return (
    <dl className="quarters" aria-label="Points by quarter">
      {periods.map(({ period, points }) => (
        <div key={period} className={best > 0 && points === best ? "quarter best" : "quarter"}>
          <dt>{periodLabel(period)}</dt>
          <dd>{points}</dd>
        </div>
      ))}
    </dl>
  );
}
