import { useState } from "react";
import { LABELS, formatValue, splitStatKeys } from "../lib/stats.js";

// The player's key stats, with the rest behind a toggle. Each card toggles on
// its own, and both go back to key stats when the next game loads.
export default function StatTable({ stats }) {
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
                <td>{LABELS[k] || k}</td>
                <td>{formatValue(k, stats[k])}</td>
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
