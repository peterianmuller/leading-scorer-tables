// Tests for the front end's plain-JS helpers in client/src/lib. They have no
// React or browser dependencies, so node:test can import them directly.

import { test, describe, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  formatValue,
  initials,
  KEY_STATS,
  LABELS,
  orderedStatKeys,
  splitStatKeys,
  teamLeader,
} from "../client/src/lib/stats.js";
import { currentSeason, isFinal, landingDate, seasonOptions } from "../client/src/lib/schedule.js";
import {
  clockLabel,
  elapsedSeconds,
  lastPeriod,
  periodLabel,
  playedSeconds,
  pointsAt,
  scoringFlow,
} from "../client/src/lib/scoring.js";

// The client reads the viewer's local clock, so dates here are built from
// local-time parts rather than ISO strings (which parse as UTC and can land
// on the previous day west of Greenwich).
const local = (year, month, day) => new Date(year, month - 1, day);

/* --------------------------------- stats --------------------------------- */

describe("formatValue", () => {
  test("turns ISO 8601 minutes into m:ss", () => {
    assert.equal(formatValue("minutes", "PT34M12.00S"), "34:12");
    assert.equal(formatValue("minutesCalculated", "PT05M03.00S"), "05:03");
  });

  test("zero-pads single-digit seconds", () => {
    assert.equal(formatValue("minutes", "PT34M5.00S"), "34:05");
  });

  test("leaves minutes it can't parse as they came", () => {
    assert.equal(formatValue("minutes", ""), "");
    assert.equal(formatValue("minutes", "DNP"), "DNP");
  });

  test("shows percentages to one decimal place", () => {
    assert.equal(formatValue("fieldGoalsPercentage", 0.5), "50.0%");
    assert.equal(formatValue("threePointersPercentage", 0.3333), "33.3%");
    assert.equal(formatValue("freeThrowsPercentage", 0), "0.0%");
  });

  test("signs a positive plus/minus but not zero or a negative", () => {
    assert.equal(formatValue("plusMinusPoints", 7), "+7");
    assert.equal(formatValue("plusMinusPoints", 0), "0");
    assert.equal(formatValue("plusMinusPoints", -4), "-4");
  });

  test("stringifies everything else unchanged", () => {
    assert.equal(formatValue("points", 31), "31");
    assert.equal(formatValue("plus", 12), "12");
  });
});

describe("orderedStatKeys", () => {
  test("puts known stats in LABELS order regardless of input order", () => {
    const keys = orderedStatKeys({ assists: 5, minutes: "PT30M00.00S", points: 20 });
    assert.deepEqual(keys, ["points", "minutes", "assists"]);
  });

  test("appends stats it has no label for, in the order the CDN sent them", () => {
    const keys = orderedStatKeys({ zNew: 1, points: 20, aNew: 2 });
    assert.deepEqual(keys, ["points", "zNew", "aNew"]);
  });

  test("returns every LABELS key when the CDN sends them all", () => {
    const all = Object.fromEntries(Object.keys(LABELS).map((k) => [k, 0]));
    assert.deepEqual(orderedStatKeys(all), Object.keys(LABELS));
  });

  test("handles an empty stats object", () => {
    assert.deepEqual(orderedStatKeys({}), []);
  });
});

describe("splitStatKeys", () => {
  test("leads with the key stats in KEY_STATS order, then the rest in LABELS order", () => {
    const stats = Object.fromEntries(Object.keys(LABELS).map((k) => [k, 0]));
    const { key, rest } = splitStatKeys(stats);
    assert.deepEqual(key, KEY_STATS);
    assert.deepEqual(
      rest,
      Object.keys(LABELS).filter((k) => !KEY_STATS.includes(k)),
    );
  });

  test("skips key stats the CDN left out, and keeps unlabeled stats in the rest", () => {
    const { key, rest } = splitStatKeys({
      zNew: 1,
      assists: 4,
      minutes: "PT30M00.00S",
      points: 20,
    });
    assert.deepEqual(key, ["points", "assists"]);
    assert.deepEqual(rest, ["minutes", "zNew"]);
  });

  test("has nothing left over when the CDN sent only key stats", () => {
    assert.deepEqual(splitStatKeys({ points: 20 }).rest, []);
  });
});

describe("teamLeader", () => {
  const player = (name, points) => ({ name, statistics: { points } });

  test("picks the top scorer", () => {
    const team = { players: [player("A", 12), player("B", 30), player("C", 18)] };
    assert.equal(teamLeader(team).name, "B");
  });

  test("keeps the first player listed when scorers tie", () => {
    const team = { players: [player("A", 25), player("B", 25)] };
    assert.equal(teamLeader(team).name, "A");
  });

  test("returns a lone scoreless player rather than null", () => {
    assert.equal(teamLeader({ players: [player("A", 0)] }).name, "A");
  });

  test("returns null for a pregame team with no players", () => {
    assert.equal(teamLeader({ players: [] }), null);
    assert.equal(teamLeader({}), null);
  });
});

describe("initials", () => {
  test("uses the CDN's first and family names", () => {
    assert.equal(
      initials({ name: "LeBron James", firstName: "LeBron", familyName: "James" }),
      "LJ",
    );
  });

  test("isn't thrown by a suffix or a multi-part family name", () => {
    assert.equal(
      initials({ name: "Jaren Jackson Jr.", firstName: "Jaren", familyName: "Jackson Jr." }),
      "JJ",
    );
    assert.equal(
      initials({
        name: "Shai Gilgeous-Alexander",
        firstName: "Shai",
        familyName: "Gilgeous-Alexander",
      }),
      "SG",
    );
  });

  test("falls back to splitting the full name", () => {
    assert.equal(initials({ name: "Victor Wembanyama" }), "VW");
    assert.equal(initials({ name: "Nenê" }), "N");
  });

  test("shows a question mark when there's no name at all", () => {
    assert.equal(initials({}), "?");
  });
});

/* -------------------------------- schedule ------------------------------- */

describe("currentSeason (client)", () => {
  test("names the season in progress from October on", () => {
    assert.equal(currentSeason(local(2025, 10, 1)), "2025-26");
    assert.equal(currentSeason(local(2026, 1, 15)), "2025-26");
  });

  test("names the season that just finished during the offseason", () => {
    assert.equal(currentSeason(local(2026, 9, 30)), "2025-26");
  });

  test("zero-pads the second year across a century", () => {
    assert.equal(currentSeason(local(2099, 11, 1)), "2099-00");
  });
});

describe("seasonOptions", () => {
  afterEach(() => mock.timers.reset());

  test("lists seasons newest first, back to 2019-20", () => {
    mock.timers.enable({ apis: ["Date"], now: local(2026, 10, 7) });
    assert.deepEqual(seasonOptions(), [
      "2026-27",
      "2025-26",
      "2024-25",
      "2023-24",
      "2022-23",
      "2021-22",
      "2020-21",
      "2019-20",
    ]);
  });

  test("doesn't offer next season during the offseason", () => {
    mock.timers.enable({ apis: ["Date"], now: local(2026, 9, 30) });
    assert.equal(seasonOptions()[0], "2025-26");
  });
});

describe("isFinal", () => {
  test("is true only for status 3", () => {
    assert.equal(isFinal({ status: 3 }), true);
    assert.equal(isFinal({ status: 1 }), false);
    assert.equal(isFinal({ status: 2 }), false);
  });
});

describe("landingDate", () => {
  const day = (date, ...statuses) => ({
    date,
    games: statuses.map((status) => ({ status })),
  });

  test("picks the newest date with a finished game", () => {
    const dates = [day("2026-01-01", 3), day("2026-01-02", 3, 2), day("2026-01-03", 1)];
    assert.equal(landingDate(dates), "2026-01-02");
  });

  test("falls back to the last date when nothing has been played", () => {
    const dates = [day("2026-10-20", 1), day("2026-10-21", 1)];
    assert.equal(landingDate(dates), "2026-10-21");
  });

  test("is undefined for an empty schedule", () => {
    assert.equal(landingDate([]), undefined);
  });
});

/* -------------------------------- scoring -------------------------------- */

describe("elapsedSeconds", () => {
  test("counts up from tip-off as the clock counts down", () => {
    assert.equal(elapsedSeconds(1, "PT12M00.00S"), 0);
    assert.equal(elapsedSeconds(1, "PT11M39.00S"), 21);
    assert.equal(elapsedSeconds(3, "PT06M00.00S"), 24 * 60 + 6 * 60);
  });

  test("keeps tenths of a second", () => {
    assert.equal(elapsedSeconds(4, "PT00M00.40S"), 48 * 60 - 0.4);
  });

  test("gives overtime five minutes, not twelve", () => {
    assert.equal(elapsedSeconds(5, "PT00M00.00S"), 48 * 60 + 5 * 60);
    assert.equal(elapsedSeconds(6, "PT05M00.00S"), 53 * 60);
  });
});

describe("periodLabel / clockLabel", () => {
  test("names quarters and overtimes", () => {
    assert.deepEqual([1, 4, 5, 6].map(periodLabel), ["Q1", "Q4", "OT", "2OT"]);
  });

  test("formats the clock as m:ss, rounding tenths up", () => {
    assert.equal(clockLabel("PT04M07.00S"), "4:07");
    assert.equal(clockLabel("PT00M03.20S"), "0:04");
    assert.equal(clockLabel("PT12M00.00S"), "12:00");
  });
});

describe("scoringFlow", () => {
  const made = (orderNumber, period, clock, personId, pointsTotal) => ({
    orderNumber,
    period,
    clock,
    personId,
    pointsTotal,
    shotResult: "Made",
    description: `basket ${orderNumber}`,
  });
  const actions = [
    made(30, 2, "PT10M00.00S", 7, 5),
    made(10, 1, "PT11M00.00S", 7, 2),
    { orderNumber: 15, period: 1, clock: "PT10M00.00S", personId: 7, shotResult: "Missed" },
    made(20, 1, "PT09M00.00S", 9, 3),
    made(25, 1, "PT05M00.00S", 7, 3),
  ];

  test("starts at zero and follows the player's made baskets in play order", () => {
    const flow = scoringFlow(actions, 7);
    assert.deepEqual(
      flow.map((s) => [s.seconds, s.points]),
      [
        [0, 0],
        [60, 2],
        [420, 3],
        [840, 5],
      ],
    );
    assert.equal(flow[1].description, "basket 10");
  });

  test("is just the starting point for a player who never scored", () => {
    assert.deepEqual(scoringFlow(actions, 1), [{ seconds: 0, points: 0 }]);
  });

  test("pointsAt reads the total as of a moment", () => {
    const flow = scoringFlow(actions, 7);
    assert.equal(pointsAt(flow, 0), 0);
    assert.equal(pointsAt(flow, 59), 0);
    assert.equal(pointsAt(flow, 60), 2);
    assert.equal(pointsAt(flow, 10_000), 5);
  });

  test("playedSeconds is the furthest point any play reached", () => {
    assert.equal(playedSeconds(actions), 840);
    assert.equal(playedSeconds([]), 0);
  });

  // Seen live: 0012600029's feed closes with { actionType: "game", period: 0 }.
  test("ignores a closing action stamped period 0", () => {
    const end = { orderNumber: 99, period: 0, clock: "PT00M00.00S", actionType: "game" };
    const ot = { ...made(40, 5, "PT01M00.00S", 7, 9) };
    assert.equal(playedSeconds([...actions, ot, end]), 48 * 60 + 4 * 60);
    assert.equal(lastPeriod([...actions, ot, end]), 5);
    assert.equal(lastPeriod([end]), 4);
  });
});
