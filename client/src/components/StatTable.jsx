import { useState } from "react";
import { LABELS, TILE_LABELS, formatValue, splitStatKeys } from "../lib/stats.js";

// The player's key stats as big numbers, with every other stat in a table
// behind a toggle. Each card toggles on its own, and both go back to key
// stats when the next game loads. `labels`, `tileLabels` and `format`
// override the box-score defaults, e.g. for career averages.
export default function StatTable({
  stats,
  labels = LABELS,
  tileLabels = TILE_LABELS,
  format = formatValue,
}) {
  const [showAll, setShowAll] = useState(false);
  const { key, rest } = splitStatKeys(stats);

  return (
    <>
      {/* A description list, so each number is read out with its full name. */}
      <dl className="tiles">
        {key.map((k) => (
          <div key={k} className={k === "points" ? "tile points" : "tile"}>
            <dt>
              <abbr title={labels[k] || LABELS[k] || k}>{tileLabels[k] || labels[k] || k}</abbr>
            </dt>
            <dd>{format(k, stats[k], stats)}</dd>
          </div>
        ))}
      </dl>

      {showAll && (
        <div className="table-wrap">
          <table>
            <thead className="visually-hidden">
              <tr>
                <th>Stat</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((k) => (
                <tr key={k}>
                  <td>{labels[k] || LABELS[k] || k}</td>
                  <td>{format(k, stats[k], stats)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rest.length > 0 && (
        <button
          type="button"
          className="stat-toggle"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Hide the other stats" : `Show ${rest.length} more stats`}
        </button>
      )}
    </>
  );
}
