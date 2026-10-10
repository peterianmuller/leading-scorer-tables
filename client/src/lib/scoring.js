// Turns the CDN's play-by-play into a player's running points total over game
// time, for the scoring-flow chart.

// Regulation quarters are 12 minutes; every overtime is 5.
export function periodSeconds(period) {
  return period <= 4 ? 12 * 60 : 5 * 60;
}

// Clocks count down within a period, as ISO 8601 durations ("PT11M39.00S").
// Returns 0 for one it can't parse, i.e. the period's end.
export function clockSeconds(clock) {
  const m = /PT(\d+)M([\d.]+)S/.exec(clock ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

// Seconds of game time played when `clock` reads in `period`.
export function elapsedSeconds(period, clock) {
  let before = 0;
  for (let p = 1; p < period; p++) before += periodSeconds(p);
  return before + periodSeconds(period) - clockSeconds(clock);
}

// "Q1".."Q4", then "OT", "2OT", ...
export function periodLabel(period) {
  if (period <= 4) return `Q${period}`;
  return period === 5 ? "OT" : `${period - 4}OT`;
}

// "PT04M07.00S" -> "4:07"
export function clockLabel(clock) {
  const total = Math.ceil(clockSeconds(clock));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The player's running total after each basket they made, starting from 0 at
// tip-off. Made shots and free throws carry the scorer's `pointsTotal` as of
// that play, so there's nothing to add up — and a basket the scorekeepers
// later corrected is already reflected in the totals that follow it.
export function scoringFlow(actions, personId) {
  const flow = [{ seconds: 0, points: 0 }];
  const baskets = actions
    .filter(
      (a) =>
        a.personId === personId && a.shotResult === "Made" && typeof a.pointsTotal === "number",
    )
    .sort((a, b) => a.orderNumber - b.orderNumber);

  for (const a of baskets) {
    flow.push({
      seconds: elapsedSeconds(a.period, a.clock),
      points: a.pointsTotal,
      period: a.period,
      clock: a.clock,
      description: a.description,
    });
  }
  return flow;
}

// How much game time the play-by-play covers: the whole game once it's over,
// the time of the furthest play while it's live. Taken as a max rather than
// from the last row because some feeds close with a "game end" action stamped
// period 0.
export function playedSeconds(actions) {
  let played = 0;
  for (const a of actions) {
    if (a.period >= 1) played = Math.max(played, elapsedSeconds(a.period, a.clock));
  }
  return played;
}

// The latest period played, so overtime gets its own slot on the axis.
export function lastPeriod(actions) {
  return Math.max(4, ...actions.map((a) => a.period || 0));
}

// The total as of `seconds`: the last basket at or before it. Baskets sharing
// a moment (an and-one's free throw) resolve to the later one.
export function pointsAt(flow, seconds) {
  let points = 0;
  for (const step of flow) {
    if (step.seconds > seconds) break;
    points = step.points;
  }
  return points;
}
