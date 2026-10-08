import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { curveStepAfter, line } from "d3-shape";
import { fetchPlayByPlay } from "../lib/api.js";
import {
  clockLabel,
  elapsedSeconds,
  lastPeriod,
  periodLabel,
  periodSeconds,
  playedSeconds,
  pointsAt,
  scoringFlow,
} from "../lib/scoring.js";

const HEIGHT = 240;
const MARGIN = { top: 16, right: 112, bottom: 28, left: 32 };
const LABEL_GAP = 16; // closest two end labels may sit, in px

// Each leading scorer's running points total across the game, as a step line:
// totals only change when a basket drops. Hover or arrow-key along it to read
// both players' totals at any basket. d3 does the math; React draws the SVG.
export default function ScoringFlow({ gameId, players }) {
  // Tagged with the gameId it belongs to, so switching games never draws the
  // previous game's lines against the new one's players.
  const [pbp, setPbp] = useState({ gameId: null, actions: null, error: null });
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState(null); // index into `moments`
  const wrap = useRef(null);

  useEffect(() => {
    let current = true;
    setFocus(null);
    fetchPlayByPlay(gameId)
      .then((body) => current && setPbp({ gameId, actions: body.game.actions, error: null }))
      .catch((err) => current && setPbp({ gameId, actions: null, error: err.message }));
    return () => {
      current = false;
    };
  }, [gameId]);

  // The SVG is drawn at its real pixel width rather than scaled through a
  // viewBox, so the axis text stays the same size on a phone.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const actions = pbp.gameId === gameId ? pbp.actions : null;

  const series = useMemo(() => {
    if (!actions) return [];
    const played = playedSeconds(actions);
    return players.map(({ player, team }, i) => {
      const flow = scoringFlow(actions, player.personId);
      // Carry the last total on to the latest play, so a player who stopped
      // scoring early still has a line that runs to the end.
      const last = flow.at(-1);
      const drawn = played > last.seconds ? [...flow, { seconds: played, points: last.points }] : flow;
      return { key: player.personId, slot: i + 1, player, team, flow, drawn, total: last.points };
    });
  }, [actions, players]);

  // Every moment either player scored, oldest first: where the crosshair snaps.
  const moments = useMemo(() => {
    const times = new Set([0]);
    for (const s of series) for (const step of s.flow) times.add(step.seconds);
    return [...times].sort((a, b) => a - b);
  }, [series]);

  const heading = <h3 className="chart-title">Scoring flow</h3>;

  if (pbp.gameId === gameId && pbp.error) {
    return (
      <section className="chart-card">
        {heading}
        <p className="muted">No play-by-play for this game: {pbp.error}</p>
      </section>
    );
  }

  const periods = Array.from({ length: actions ? lastPeriod(actions) : 4 }, (_, i) => i + 1);
  const gameEnd = elapsedSeconds(periods.length, "PT00M00.00S");

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxPoints = Math.max(10, ...series.map((s) => s.total));
  const x = scaleLinear().domain([0, gameEnd]).range([0, innerW]);
  const y = scaleLinear().domain([0, maxPoints]).nice(4).range([innerH, 0]);
  const path = line()
    .x((d) => x(d.seconds))
    .y((d) => y(d.points))
    .curve(curveStepAfter);

  const labels = endLabels(series, x, y);
  const at = focus === null ? null : moments[focus];

  function snapTo(clientX) {
    const px = clientX - wrap.current.getBoundingClientRect().left - MARGIN.left;
    const seconds = x.invert(px);
    let best = 0;
    moments.forEach((t, i) => {
      if (Math.abs(t - seconds) < Math.abs(moments[best] - seconds)) best = i;
    });
    setFocus(best);
  }

  function onKeyDown(e) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) {
      e.preventDefault();
      setFocus((i) => Math.min(moments.length - 1, Math.max(0, (i ?? -1) + step)));
    } else if (e.key === "Escape") {
      setFocus(null);
    }
  }

  return (
    <section className="chart-card">
      {heading}
      <ul className="legend">
        {series.map((s) => (
          <li key={s.key}>
            <span className={`key series-${s.slot}`} aria-hidden="true" />
            {s.player.name} <span className="muted">· {s.team.teamTricode}</span>
          </li>
        ))}
      </ul>

      <div className="chart" ref={wrap} style={{ height: HEIGHT }}>
        {actions && innerW > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Running points: ${series
              .map((s) => `${s.player.name} ${s.total}`)
              .join(", ")}. Use arrow keys to step through baskets.`}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {y.ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line className="grid" x2={innerW} />
                  <text className="tick" x={-8} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}

              {periods.map((p) => {
                const start = elapsedSeconds(p, `PT${periodSeconds(p) / 60}M00.00S`);
                const mid = start + periodSeconds(p) / 2;
                return (
                  <g key={p}>
                    {p > 1 && <line className="grid" x1={x(start)} x2={x(start)} y2={innerH} />}
                    <text className="tick" x={x(mid)} y={innerH + 20} textAnchor="middle">
                      {periodLabel(p)}
                    </text>
                  </g>
                );
              })}
              <line className="baseline" x2={innerW} y1={innerH} y2={innerH} />

              {series.map((s) => (
                <path key={s.key} className={`flow series-${s.slot}`} d={path(s.drawn)} />
              ))}

              {labels.map((l) => (
                <g key={l.key}>
                  {l.nudged && (
                    <line className="leader" x1={l.x + 2} y1={l.lineY} x2={l.x + 8} y2={l.y} />
                  )}
                  <text className="end-label" x={l.x + 10} y={l.y} dy="0.32em">
                    {l.name} <tspan className="end-value">{l.total}</tspan>
                  </text>
                </g>
              ))}

              {at !== null && (
                <g transform={`translate(${x(at)},0)`}>
                  <line className="crosshair" y2={innerH} />
                  {series.map((s) => (
                    <circle
                      key={s.key}
                      className={`dot series-${s.slot}`}
                      cy={y(pointsAt(s.flow, at))}
                      r={4}
                    />
                  ))}
                </g>
              )}

              {/* The hit target is the whole plot, not the 2px lines. */}
              <rect
                className="hit"
                width={innerW}
                height={innerH}
                tabIndex={0}
                onPointerMove={(e) => snapTo(e.clientX)}
                onPointerLeave={() => setFocus(null)}
                onFocus={() => setFocus((i) => i ?? moments.length - 1)}
                onBlur={() => setFocus(null)}
                onKeyDown={onKeyDown}
              />
            </g>
          </svg>
        )}

        {at !== null && (
          <Tooltip
            seconds={at}
            series={series}
            left={MARGIN.left + x(at)}
            flip={x(at) > innerW / 2}
          />
        )}
      </div>

      <ScoringPlays series={series} />
    </section>
  );
}

// Places each line's end label at its final total, pushing two apart when
// they'd overlap. A pushed label gets a short leader back to its line rather
// than floating loose beside it.
function endLabels(series, x, y) {
  const labels = series.map((s) => ({
    key: s.key,
    name: s.player.familyName || s.player.name,
    total: s.total,
    x: x(s.drawn.at(-1).seconds),
    lineY: y(s.total),
    y: y(s.total),
    nudged: false,
  }));
  if (labels.length === 2 && Math.abs(labels[0].y - labels[1].y) < LABEL_GAP) {
    const mid = (labels[0].y + labels[1].y) / 2;
    // The higher total goes on top; on a tie, the away player.
    const [top, bottom] = labels[0].total >= labels[1].total ? labels : [labels[1], labels[0]];
    top.y = mid - LABEL_GAP / 2;
    bottom.y = mid + LABEL_GAP / 2;
    top.nudged = bottom.nudged = true;
  }
  return labels;
}

function Tooltip({ seconds, series, left, flip }) {
  const plays = series.flatMap((s) =>
    s.flow.filter((step) => step.seconds === seconds && step.description)
  );
  const when = plays[0]
    ? `${periodLabel(plays[0].period)} · ${clockLabel(plays[0].clock)}`
    : "Tip-off";

  return (
    <div
      className="tooltip"
      style={flip ? { right: `calc(100% - ${left}px + 12px)` } : { left: left + 12 }}
      role="status"
    >
      <p className="tooltip-when muted">{when}</p>
      {series.map((s) => (
        <p key={s.key} className="tooltip-row">
          <span className={`key series-${s.slot}`} aria-hidden="true" />
          <strong>{pointsAt(s.flow, seconds)}</strong>{" "}
          <span className="muted">{s.player.familyName || s.player.name}</span>
        </p>
      ))}
      {plays.map((p, i) => (
        <p key={i} className="tooltip-play muted">
          {p.description}
        </p>
      ))}
    </div>
  );
}

// Every basket in a table, so nothing the chart shows is hover-only.
function ScoringPlays({ series }) {
  const rows = series
    .flatMap((s) => s.flow.slice(1).map((step) => ({ ...step, player: s.player })))
    .sort((a, b) => a.seconds - b.seconds);
  if (!rows.length) return null;

  return (
    <details className="plays">
      <summary>Scoring plays ({rows.length})</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Play</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  {periodLabel(r.period)} {clockLabel(r.clock)}
                </td>
                <td>{r.description}</td>
                <td>{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
