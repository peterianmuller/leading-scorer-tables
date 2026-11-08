import { useEffect, useState } from "react";
import { fetchPlayByPlay } from "../lib/api.js";

const NONE = { actions: null, error: null };

// The game's play-by-play actions, fetched once by whichever view shows the
// game and handed to every chart that draws from them, so a page never
// downloads the same game twice. `actions` is null while loading, and stays
// null with no request at all while `gameId` is (the box score isn't in yet).
// `error` is set if the CDN has no file for the game.
export default function usePlayByPlay(gameId) {
  // Tagged with the gameId it belongs to, so switching games never draws the
  // previous game's plays against the new one's players.
  const [pbp, setPbp] = useState({ gameId: null, ...NONE });

  useEffect(() => {
    if (!gameId) return;
    let current = true;
    fetchPlayByPlay(gameId)
      .then((body) => current && setPbp({ gameId, actions: body.game.actions, error: null }))
      .catch((err) => current && setPbp({ gameId, actions: null, error: err.message }));
    return () => {
      current = false;
    };
  }, [gameId]);

  return gameId && pbp.gameId === gameId ? pbp : NONE;
}
