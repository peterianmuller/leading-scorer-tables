import { LABELS, formatValue, orderedStatKeys } from "../lib/stats.js";

export default function StatTable({ stats }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {orderedStatKeys(stats).map((key) => (
            <tr key={key} className={key === "points" ? "points" : undefined}>
              <td>{LABELS[key] || key}</td>
              <td>{formatValue(key, stats[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
