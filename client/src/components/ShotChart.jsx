import { useMemo, useRef, useState } from "react";
import { clockLabel, periodLabel } from "../lib/scoring.js";
import { DOT, VIEW, nearestShot, playerShots, shootingLine, shotLabel } from "../lib/shots.js";

const HIT_PX = 24; // how near the pointer must be to pick a shot

// Each leading scorer's field goal attempts at the spot they were taken, one
// court per player in that player's series color. Made shots are dots and
// misses are crosses, so the result never depends on color alone.
export default function ShotCharts({ pbp, players }) {
  const { actions, error } = pbp;
  // Built once per game: each Court resets its focus when its shots change.
  const shots = useMemo(
    () => players.map(({ player }) => (actions ? playerShots(actions, player.personId) : null)),
    [actions, players],
  );
  if (error) return null; // ScoringFlow already says there's no play-by-play

  return (
    <section className="chart-card">
      <h3 className="chart-title">Shot charts</h3>
      <ul className="legend">
        <li>
          <svg className="legend-mark" viewBox="-8 -8 16 16" aria-hidden="true">
            <circle className="shot-made" r={DOT} />
          </svg>
          Made
        </li>
        <li>
          <svg className="legend-mark" viewBox="-8 -8 16 16" aria-hidden="true">
            <Cross className="shot-missed" />
          </svg>
          Missed
        </li>
      </ul>
      <div className="courts">
        {players.map(({ player, team }, i) => (
          <Court key={player.personId} player={player} team={team} slot={i + 1} shots={shots[i]} />
        ))}
      </div>
    </section>
  );
}

function Court({ player, team, slot, shots }) {
  const [focus, setFocus] = useState(null); // index into `shots`
  const [focusShots, setFocusShots] = useState(shots);
  const svg = useRef(null);
  const line = useMemo(() => shootingLine(shots ?? []), [shots]);

  // Done during render so the stale focus never draws against the new shots.
  if (focusShots !== shots) {
    setFocusShots(shots);
    setFocus(null);
  }

  // Pointer position in court units, via the SVG's own transform so it's
  // right at any rendered size.
  function onPointerMove(e) {
    const ctm = svg.current.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const i = nearestShot(shots, pt.x, -pt.y, HIT_PX / ctm.a);
    setFocus(i === -1 ? null : i);
  }

  function onKeyDown(e) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step && shots.length) {
      e.preventDefault();
      setFocus((i) => Math.min(shots.length - 1, Math.max(0, (i ?? -1) + step)));
    } else if (e.key === "Escape") {
      setFocus(null);
    }
  }

  const name = player.familyName || player.name;
  const pct = line.fga ? ` (${((line.fgm / line.fga) * 100).toFixed(1)}%)` : "";
  const shot = focus === null ? null : shots[focus];

  return (
    <figure className={`court series-${slot}`}>
      <figcaption>
        <strong>{player.name}</strong> <span className="muted">· {team.teamTricode}</span>
        {shots && (
          <span className="muted court-line">
            FG {line.fgm}/{line.fga}
            {pct} · 3PT {line.tpm}/{line.tpa}
          </span>
        )}
      </figcaption>

      <div className="court-wrap">
        <svg
          ref={svg}
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          role="img"
          aria-label={
            shots
              ? `${name}'s shots: ${line.fgm} of ${line.fga} made, ${line.tpm} of ${line.tpa} from three. Use arrow keys to step through them.`
              : `${name}'s shots, loading`
          }
          tabIndex={0}
          onPointerMove={shots ? onPointerMove : undefined}
          onPointerLeave={() => setFocus(null)}
          onFocus={() => setFocus((i) => i ?? (shots?.length ? 0 : null))}
          onBlur={() => setFocus(null)}
          onKeyDown={shots ? onKeyDown : undefined}
        >
          <CourtLines />
          {shots && (
            <>
              {/* Misses first, so a make on the same spot draws over it. */}
              {shots.map(
                (s, i) =>
                  !s.made && (
                    <Cross
                      key={i}
                      className="shot-missed"
                      transform={`translate(${s.x},${-s.y})`}
                    />
                  ),
              )}
              {shots.map(
                (s, i) =>
                  s.made && <circle key={i} className="shot-made" cx={s.x} cy={-s.y} r={DOT} />,
              )}
            </>
          )}
          {shot && <circle className="shot-focus" cx={shot.x} cy={-shot.y} r={DOT + 6} />}
        </svg>

        {shot && <ShotTooltip shot={shot} />}
      </div>

      {shots?.length > 0 && <ShotLog shots={shots} />}
    </figure>
  );
}

// Arms reach DOT court units from the center, so a miss covers the same
// footprint as a make.
export function Cross({ className, transform }) {
  const r = DOT * 0.8;
  return (
    <path
      className={className}
      transform={transform}
      d={`M${-r},${-r}L${r},${r}M${r},${-r}L${-r},${r}`}
    />
  );
}

// NBA court markings, in court units with y negated (see VIEW). pathLength
// lets the landing's court draw each line in over the same time.
export function CourtLines() {
  const corner = Math.sqrt(237.5 ** 2 - 220 ** 2); // where the corner three meets the arc
  return (
    <g className="court-lines">
      <rect pathLength={1} x={-250} y={-422.5} width={500} height={470} />
      {/* Paint, free-throw circle, restricted area, rim and backboard */}
      <rect pathLength={1} x={-80} y={-142.5} width={160} height={190} />
      <path pathLength={1} d="M-60,-142.5 A60,60 0 0 1 60,-142.5" />
      <path pathLength={1} d="M-40,0 A40,40 0 0 1 40,0" />
      <circle pathLength={1} cx={0} cy={0} r={7.5} />
      <line pathLength={1} x1={-30} x2={30} y1={7.5} y2={7.5} />
      {/* Three-point line: straight in the corners, then the 23'9" arc */}
      <path pathLength={1} d={`M-220,47.5 V${-corner} A237.5,237.5 0 0 1 220,${-corner} V47.5`} />
      {/* Center circle, half of it on this side of the line */}
      <path pathLength={1} d="M-60,-422.5 A60,60 0 0 0 60,-422.5" />
    </g>
  );
}

// Positioned in percentages of the court, so it lands on the shot at any size.
function ShotTooltip({ shot }) {
  const left = ((shot.x - VIEW.x) / VIEW.w) * 100;
  const top = ((-shot.y - VIEW.y) / VIEW.h) * 100;
  const style = {
    ...(left > 50 ? { right: `calc(${100 - left}% + 14px)` } : { left: `calc(${left}% + 14px)` }),
    top: `${top}%`,
    transform: "translateY(-50%)",
  };

  return (
    <div className="tooltip" style={style} role="status">
      <p className="tooltip-when muted">
        {periodLabel(shot.period)} · {clockLabel(shot.clock)}
      </p>
      <p className="tooltip-row">
        <strong>{shot.made ? "Made" : "Missed"}</strong>
        <span className="muted">{shotLabel(shot)}</span>
      </p>
      <p className="tooltip-play muted">{shot.description}</p>
    </div>
  );
}

// Every attempt in a table, so nothing the court shows is hover-only.
function ShotLog({ shots }) {
  return (
    <details className="plays">
      <summary>Shot log ({shots.length})</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Shot</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((s, i) => (
              <tr key={i}>
                <td>
                  {periodLabel(s.period)} {clockLabel(s.clock)}
                </td>
                <td>{shotLabel(s)}</td>
                <td>{s.made ? "Made" : "Missed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
