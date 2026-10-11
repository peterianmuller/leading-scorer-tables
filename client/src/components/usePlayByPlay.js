import { useEffect, useState } from "react";
import { fetchPlayByPlay } from "../lib/api.js";

// The game's play-by-play actions, fetched once and shared by every chart that
// draws from them. `actions` is null while loading; `error` is set if the CDN
// has no file for the game.
export default function usePlayByPlay(gameId) {
  // Tagged with the gameId it belongs to, so switching games never draws the
  // previous game's plays against the new one's players.
  const [pbp, setPbp] = useState({ gameId: null, actions: null, error: null });

  useEffect(() => {
    let current = true;
    fetchPlayByPlay(gameId)
      .then((body) => current && setPbp({ gameId, actions: body.game.actions, error: null }))
      .catch((err) => current && setPbp({ gameId, actions: null, error: err.message }));
    return () => {
      current = false;
    };
  }, [gameId]);

  return pbp.gameId === gameId ? pbp : { actions: null, error: null };
}
