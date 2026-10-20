import { useState } from "react";
import { LABELS, formatValue, splitStatKeys } from "../lib/stats.js";

// The player's key stats, with the rest behind a toggle. Each card toggles on
// its own, and both go back to key stats when the next game loads. `labels`
// and `format` override the box-score defaults, e.g. for career averages.
export default function StatTable({ stats, labels = LABELS, format = formatValue }) {
  const [showAll, setShowAll] = useState(false);
  const { key, rest } = splitStatKeys(stats);
  const keys = showAll ? [...key, ...rest] : key;

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stat</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className={k === "points" ? "points" : undefined}>
                <td>{labels[k] || LABELS[k] || k}</td>
                <td>{format(k, stats[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rest.length > 0 && (
        <button
          type="button"
          className="stat-toggle"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show key stats only" : `Show all stats (${key.length + rest.length})`}
        </button>
      )}
    </>
  );
}
