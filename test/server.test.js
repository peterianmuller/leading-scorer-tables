// Run with `npm test` (node --test). No dependencies: node:test is built in,
// and upstream NBA requests are stubbed by replacing globalThis.fetch, so the
// suite runs offline and never touches cdn.nba.com.

import { test, describe, before, after, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fileURLToPath } from "node:url";

// Static routes are exercised against a small fixture rather than the React
// build, so the suite runs without `npm run build`. The server reads this at
// import time, hence the dynamic import below.
process.env.STATIC_DIR = fileURLToPath(new URL("fixtures/static", import.meta.url));

const {
  cache,
  currentSeason,
  DEFAULT_GAME_ID,
  pickWikidataImage,
  plainText,
  reduceImageInfo,
  reduceSchedule,
  resolveGameId,
  resolvePersonId,
  resolveSeason,
  server,
} = await import("../server.js");

const params = (qs = "") => new URLSearchParams(qs);

/* ------------------------------ pure helpers ----------------------------- */

describe("currentSeason", () => {
  test("names the season in progress once it has tipped off", () => {
    assert.equal(currentSeason(new Date("2025-10-21")), "2025-26");
    assert.equal(currentSeason(new Date("2026-01-15")), "2025-26");
  });

  test("names the season that just finished during the offseason", () => {
    assert.equal(currentSeason(new Date("2026-06-30")), "2025-26");
    assert.equal(currentSeason(new Date("2026-09-17")), "2025-26");
  });

  test("zero-pads the second year across a century", () => {
    assert.equal(currentSeason(new Date("2099-11-01")), "2099-00");
  });
});

describe("resolveGameId", () => {
  test("falls back to the default when absent or empty", () => {
    assert.equal(resolveGameId(params()), DEFAULT_GAME_ID);
    assert.equal(resolveGameId(params("gameId=")), DEFAULT_GAME_ID);
  });

  test("accepts and trims a 10-digit ID", () => {
    assert.equal(resolveGameId(params("gameId=%200022500066%20")), "0022500066");
  });

  test("rejects anything that isn't 10 digits with a 400 that echoes the input", () => {
    for (const bad of ["abc", "123", "00225000660", "0022500066x", "../etc"]) {
      assert.throws(
        () => resolveGameId(params(`gameId=${encodeURIComponent(bad)}`)),
        (err) => err.status === 400 && err.message.includes(`"${bad}"`),
      );
    }
  });
});

describe("resolveSeason", () => {
  test("falls back to the current season when absent or empty", () => {
    assert.equal(resolveSeason(params()), currentSeason());
    assert.equal(resolveSeason(params("season=")), currentSeason());
  });

  test("accepts a well-formed season at or after the floor", () => {
    assert.equal(resolveSeason(params("season=2019-20")), "2019-20");
    assert.equal(resolveSeason(params("season=%202023-24%20")), "2023-24");
  });

  test("rejects malformed seasons and seasons before 2019-20 with a 400", () => {
    for (const bad of ["2018-19", "2023", "23-24", "2023-2024", "abcd-ef"]) {
      assert.throws(
        () => resolveSeason(params(`season=${bad}`)),
        (err) => err.status === 400 && err.message.includes(`"${bad}"`),
      );
    }
  });
});

describe("reduceSchedule", () => {
  // A game as stats.nba.com sends it, including fields the reducer drops.
  const game = (overrides = {}) => ({
    gameId: "0022500002",
    gameStatus: 3,
    gameStatusText: "Final ",
    awayTeam: { teamTricode: "GSW", score: 119, teamName: "Warriors" },
    homeTeam: { teamTricode: "LAL", score: 109, teamName: "Lakers" },
    broadcasters: { national: [] },
    arenaName: "Crypto.com Arena",
    ...overrides,
  });
  const schedule = (gameDates) => ({ leagueSchedule: { gameDates } });

  test("keeps only what the picker renders and converts dates to ISO", () => {
    const dates = reduceSchedule(schedule([{ gameDate: "10/21/2025 00:00:00", games: [game()] }]));

    assert.deepEqual(dates, [
      {
        date: "2025-10-21",
        games: [
          {
            gameId: "0022500002",
            status: 3,
            statusText: "Final",
            away: { tricode: "GSW", score: 119 },
            home: { tricode: "LAL", score: 109 },
          },
        ],
      },
    ]);
  });

  test("drops dates with no games", () => {
    const dates = reduceSchedule(
      schedule([
        { gameDate: "10/20/2025 00:00:00", games: [] },
        { gameDate: "10/22/2025 00:00:00" },
        { gameDate: "10/21/2025 00:00:00", games: [game()] },
      ]),
    );
    assert.deepEqual(
      dates.map((d) => d.date),
      ["2025-10-21"],
    );
  });

  test("tolerates a missing gameStatusText and an empty payload", () => {
    const [day] = reduceSchedule(
      schedule([{ gameDate: "10/21/2025 00:00:00", games: [game({ gameStatusText: undefined })] }]),
    );
    assert.equal(day.games[0].statusText, "");
    assert.deepEqual(reduceSchedule({}), []);
  });
});

describe("resolvePersonId", () => {
  test("accepts and trims a numeric ID", () => {
    assert.equal(resolvePersonId(params("personId=2544")), "2544");
    assert.equal(resolvePersonId(params("personId=%201630559%20")), "1630559");
  });

  test("rejects a missing, empty or non-numeric ID with a 400 that echoes the input", () => {
    for (const qs of ["", "personId=", "personId=lebron", "personId=12345678901"]) {
      assert.throws(
        () => resolvePersonId(params(qs)),
        (err) => err.status === 400 && /personId must be/.test(err.message),
      );
    }
    assert.throws(() => resolvePersonId(params("personId=lebron")), /got "lebron"/);
  });
});

describe("pickWikidataImage", () => {
  test("returns the free image of the matching item", () => {
    const payload = {
      query: { pages: { 1: { title: "Q36159", pageprops: { page_image_free: "LeBron.jpg" } } } },
    };
    assert.equal(pickWikidataImage(payload), "LeBron.jpg");
  });

  test("is null when no item matches or the item has no photo", () => {
    assert.equal(pickWikidataImage({ batchcomplete: "" }), null);
    assert.equal(pickWikidataImage({ query: { pages: { 1: { title: "Q1" } } } }), null);
  });
});

describe("plainText", () => {
  test("strips tags and decodes entities", () => {
    assert.equal(
      plainText('<a href="//flickr.com/x">Erik&nbsp;Drost</a> &amp; &quot;Kev&#39;s&quot;'),
      'Erik Drost & "Kev\'s"',
    );
  });

  test("decodes &amp; last so an escaped entity stays literal", () => {
    assert.equal(plainText("&amp;lt;"), "&lt;");
  });
});

describe("reduceImageInfo", () => {
  const imageinfo = (info) => ({ query: { pages: { 1: { imageinfo: [info] } } } });

  test("keeps the thumbnail and the credit the license needs", () => {
    const body = reduceImageInfo(
      imageinfo({
        thumburl: "https://upload.wikimedia.org/a/330px-A.jpg?utm_source=commons",
        descriptionurl: "https://commons.wikimedia.org/wiki/File:A.jpg",
        extmetadata: {
          Artist: { value: '<a href="https://www.flickr.com/people/x">Erik Drost</a>' },
          LicenseShortName: { value: "CC BY 2.0" },
          LicenseUrl: { value: "https://creativecommons.org/licenses/by/2.0" },
        },
      }),
    );
    assert.deepEqual(body, {
      url: "https://upload.wikimedia.org/a/330px-A.jpg",
      page: "https://commons.wikimedia.org/wiki/File:A.jpg",
      artist: "Erik Drost",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    });
  });

  test("leaves missing credit fields null", () => {
    const body = reduceImageInfo(imageinfo({ thumburl: "https://x/a.jpg", descriptionurl: "p" }));
    assert.equal(body.artist, null);
    assert.equal(body.license, null);
  });

  test("is null for a missing file", () => {
    assert.equal(reduceImageInfo({ query: { pages: { "-1": { missing: "" } } } }), null);
    assert.equal(reduceImageInfo({}), null);
  });
});

/* ------------------------------- HTTP routes ----------------------------- */

// Requests to the local server go through node:http rather than fetch, since
// fetch is the thing being mocked.
function get(port, path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            json: () => JSON.parse(body),
          }),
        );
      })
      .on("error", reject);
  });
}

describe("HTTP server", () => {
  let port;
  let fetchMock;

  // What "the NBA" returns for the next upstream request.
  const upstream = (status, body) =>
    fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify(body), { status }));

  before(async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    cache.clear();
    fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("test made an upstream request without calling upstream()");
    });
    // The server logs every failed request; the error cases below expect that.
    mock.method(console, "error", () => {});
  });

  afterEach(() => mock.restoreAll());

  describe("/api/boxscore", () => {
    test("proxies the box score for the default game with CORS enabled", async () => {
      upstream(200, { game: { gameId: DEFAULT_GAME_ID } });
      const res = await get(port, "/api/boxscore");

      assert.equal(res.status, 200);
      assert.equal(res.headers["access-control-allow-origin"], "*");
      assert.equal(res.headers["content-type"], "application/json");
      assert.deepEqual(res.json(), { game: { gameId: DEFAULT_GAME_ID } });

      const [call] = fetchMock.mock.calls;
      assert.equal(
        call.arguments[0],
        `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${DEFAULT_GAME_ID}.json`,
      );
    });

    test("sends browser-like headers so the CDN's bot filter lets it through", async () => {
      upstream(200, {});
      await get(port, "/api/boxscore?gameId=0022500066");

      const [call] = fetchMock.mock.calls;
      assert.match(call.arguments[0], /boxscore_0022500066\.json$/);
      assert.match(call.arguments[1].headers["User-Agent"], /Mozilla/);
      assert.equal(call.arguments[1].headers.Referer, "https://www.nba.com/");
    });

    test("returns 400 without contacting the CDN for a malformed gameId", async () => {
      const res = await get(port, "/api/boxscore?gameId=nope");

      assert.equal(res.status, 400);
      assert.match(res.json().error, /gameId must be 10 digits, got "nope"/);
      assert.equal(fetchMock.mock.callCount(), 0);
    });

    test("maps an upstream 403 to a 502 with a hint about why", async () => {
      upstream(403, {});
      const res = await get(port, "/api/boxscore");

      assert.equal(res.status, 502);
      assert.match(res.json().error, /NBA returned 403 .*blocked or that game has no live file/);
    });

    test("passes an upstream 404 through as a 404", async () => {
      upstream(404, {});
      const res = await get(port, "/api/boxscore");
      assert.equal(res.status, 404);
    });

    test("serves repeat requests from the cache within the TTL", async () => {
      upstream(200, { game: { n: 1 } });
      await get(port, "/api/boxscore");

      upstream(200, { game: { n: 2 } });
      const res = await get(port, "/api/boxscore");

      assert.deepEqual(res.json(), { game: { n: 1 } });
      assert.equal(fetchMock.mock.callCount(), 1);
    });

    test("does not cache failures", async () => {
      upstream(403, {});
      await get(port, "/api/boxscore");

      upstream(200, { game: {} });
      const res = await get(port, "/api/boxscore");

      assert.equal(res.status, 200);
      assert.equal(fetchMock.mock.callCount(), 2);
    });
  });

  describe("/api/schedule", () => {
    test("fetches the season from stats.nba.com and returns it reduced", async () => {
      upstream(200, {
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "10/21/2025 00:00:00",
              games: [
                {
                  gameId: "0022500002",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  awayTeam: { teamTricode: "GSW", score: 119 },
                  homeTeam: { teamTricode: "LAL", score: 109 },
                },
              ],
            },
          ],
        },
      });
      const res = await get(port, "/api/schedule?season=2025-26");

      assert.equal(res.status, 200);
      const body = res.json();
      assert.equal(body.season, "2025-26");
      assert.equal(body.dates.length, 1);
      assert.equal(body.dates[0].date, "2025-10-21");
      assert.equal(body.dates[0].games[0].away.tricode, "GSW");

      const [call] = fetchMock.mock.calls;
      assert.equal(
        call.arguments[0],
        "https://stats.nba.com/stats/scheduleleaguev2?LeagueID=00&Season=2025-26",
      );
    });

    test("rejects seasons before the liveData floor with a 400", async () => {
      const res = await get(port, "/api/schedule?season=2015-16");

      assert.equal(res.status, 400);
      assert.match(res.json().error, /start at 2019/);
      assert.equal(fetchMock.mock.callCount(), 0);
    });
  });

  describe("/api/headshot", () => {
    // Answers each Wikimedia API with its own body, since one request goes to both.
    const wikimedia = ({ wikidata, commons, commonsStatus = 200 }) =>
      fetchMock.mock.mockImplementation(async (url) =>
        url.startsWith("https://www.wikidata.org/")
          ? new Response(JSON.stringify(wikidata))
          : new Response(JSON.stringify(commons), { status: commonsStatus }),
      );

    const found = {
      wikidata: {
        query: { pages: { 1: { pageprops: { page_image_free: "LeBron_James_(cropped).jpg" } } } },
      },
      commons: {
        query: {
          pages: {
            1: {
              imageinfo: [
                {
                  thumburl: "https://upload.wikimedia.org/x/330px-LeBron.jpg?utm_source=c",
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:LeBron.jpg",
                  extmetadata: {
                    Artist: { value: "<a>Erik Drost</a>" },
                    LicenseShortName: { value: "CC BY 2.0" },
                  },
                },
              ],
            },
          },
        },
      },
    };

    test("looks the player up on Wikidata, then the photo on Commons", async () => {
      wikimedia(found);
      const res = await get(port, "/api/headshot?personId=2544");

      assert.equal(res.status, 200);
      assert.deepEqual(res.json(), {
        url: "https://upload.wikimedia.org/x/330px-LeBron.jpg",
        page: "https://commons.wikimedia.org/wiki/File:LeBron.jpg",
        artist: "Erik Drost",
        license: "CC BY 2.0",
        licenseUrl: null,
      });

      const [wikidata, commons] = fetchMock.mock.calls.map((c) => new URL(c.arguments[0]));
      assert.equal(wikidata.origin + wikidata.pathname, "https://www.wikidata.org/w/api.php");
      assert.equal(wikidata.searchParams.get("gsrsearch"), "haswbstatement:P3647=2544");
      assert.equal(commons.origin + commons.pathname, "https://commons.wikimedia.org/w/api.php");
      assert.equal(commons.searchParams.get("titles"), "File:LeBron_James_(cropped).jpg");
    });

    test("identifies itself to Wikimedia instead of posing as a browser", async () => {
      wikimedia(found);
      await get(port, "/api/headshot?personId=2544");

      for (const call of fetchMock.mock.calls) {
        const headers = call.arguments[1].headers;
        assert.match(headers["User-Agent"], /^leading-scorer-tables\/.*github\.com/);
        assert.equal(headers.Referer, undefined);
      }
    });

    test("returns null without asking Commons when Wikidata has no photo", async () => {
      wikimedia({ wikidata: { batchcomplete: "" } });
      const res = await get(port, "/api/headshot?personId=99999999");

      assert.equal(res.status, 200);
      assert.equal(res.json(), null);
      assert.equal(fetchMock.mock.callCount(), 1);
    });

    test("caches a miss as well as a hit", async () => {
      wikimedia({ wikidata: { batchcomplete: "" } });
      await get(port, "/api/headshot?personId=99999999");
      await get(port, "/api/headshot?personId=99999999");
      assert.equal(fetchMock.mock.callCount(), 1);
    });

    test("names Wikimedia, not the NBA, when an upstream fails", async () => {
      wikimedia({ ...found, commonsStatus: 500 });
      const res = await get(port, "/api/headshot?personId=2544");

      assert.equal(res.status, 502);
      assert.match(res.json().error, /^Wikimedia returned 500/);
      assert.doesNotMatch(res.json().error, /blocked/);
    });

    test("returns 400 without contacting Wikimedia for a bad personId", async () => {
      const res = await get(port, "/api/headshot?personId=lebron");

      assert.equal(res.status, 400);
      assert.match(res.json().error, /got "lebron"/);
      assert.equal(fetchMock.mock.callCount(), 0);
    });
  });

  describe("static files", () => {
    test("serves index.html at /", async () => {
      const res = await get(port, "/");
      assert.equal(res.status, 200);
      assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
      assert.match(res.body, /<html/i);
    });

    test("serves the built CSS and JS from assets/ with the right MIME types", async () => {
      const css = await get(port, "/assets/index-fixture.css");
      assert.equal(css.status, 200);
      assert.equal(css.headers["content-type"], "text/css; charset=utf-8");

      const js = await get(port, "/assets/index-fixture.js");
      assert.equal(js.status, 200);
      assert.equal(js.headers["content-type"], "text/javascript; charset=utf-8");
    });

    test("404s for unknown paths and lists the API routes", async () => {
      const res = await get(port, "/nope");
      assert.equal(res.status, 404);
      assert.equal(res.json().error, "Not found");
      assert.ok(res.json().routes.includes("/api/boxscore"));
    });

    test("404s for a missing file with a known extension", async () => {
      const res = await get(port, "/missing.js");
      assert.equal(res.status, 404);
    });

    test("refuses to serve files outside the static directory", async () => {
      const res = await get(port, "/../server.js");
      assert.equal(res.status, 404);
      assert.doesNotMatch(res.body, /createServer/);
    });

    test("refuses files with an unknown extension", async () => {
      const res = await get(port, "/../package.json");
      assert.equal(res.status, 404);
    });
  });
});
