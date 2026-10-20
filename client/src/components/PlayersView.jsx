// The players mode: search everyone who has played in the NBA and see one
// player's career averages.

import { useEffect, useState } from "react";
import { fetchCareer, fetchPlayers } from "../lib/api.js";
import { parseView, recordView } from "../lib/view.js";
import CareerCard from "./CareerCard.jsx";
import PlayerSearch from "./PlayerSearch.jsx";
import ViewHeader from "./ViewHeader.jsx";

// The list is a few hundred KB and the same all visit, so it's fetched once
// and shared by every return to this view. A failure is forgotten, so coming
// back tries again.
let playersRequest = null;
function loadPlayers() {
  playersRequest ??= fetchPlayers().catch((err) => {
    playersRequest = null;
    throw err;
  });
  return playersRequest;
}

const urlPlayerId = () => parseView(window.location.search).playerId ?? null;

export default function PlayersView({ onHome }) {
  const [players, setPlayers] = useState(null);
  const [listError, setListError] = useState(null);
  const [playerId, setPlayerId] = useState(urlPlayerId);
  // Tagged with the player it's for, so a slow answer for someone the user
  // has moved past is never shown as the current player's.
  const [career, setCareer] = useState({ personId: null, data: null, error: null });

  useEffect(() => {
    let current = true;
    loadPlayers()
      .then((list) => current && setPlayers(list))
      .catch((err) => current && setListError(err.message));

    // Back and forward between players; leaving the view is App's to handle.
    const restore = () => {
      if (parseView(window.location.search).view === "players") setPlayerId(urlPlayerId());
    };
    window.addEventListener("popstate", restore);
    return () => {
      current = false;
      window.removeEventListener("popstate", restore);
    };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    let current = true;
    fetchCareer(playerId)
      .then((data) => current && setCareer({ personId: playerId, data, error: null }))
      .catch((err) => current && setCareer({ personId: playerId, data: null, error: err.message }));
    return () => {
      current = false;
    };
  }, [playerId]);

  function choose(player) {
    const id = String(player.id);
    recordView({ view: "players", playerId: id }, "push");
    setPlayerId(id);
  }

  const player = players?.find((p) => String(p.id) === playerId);
  // Nobody picked yet is not "loaded": career starts out tagged with a null
  // personId too, and would otherwise match.
  const loaded = playerId !== null && career.personId === playerId;

  let status = null;
  if (listError) status = { text: `Couldn't load the player list: ${listError}`, error: true };
  else if (!players) status = { text: "Loading players…" };
  else if (!playerId) status = null;
  else if (!player) status = { text: "That player isn't in the NBA's list." };
  else if (!loaded) status = { text: "Loading career…" };
  else if (career.error) status = { text: career.error, error: true };
  else if (!career.data) status = { text: `No regular-season games on record for ${player.name}.` };

  return (
    <main>
      <header>
        <ViewHeader title="Players" onHome={onHome} />
        {players && <PlayerSearch players={players} onSelect={choose} />}
      </header>

      {!status && player && career.data && (
        <section id="career">
          <CareerCard player={player} career={career.data} />
        </section>
      )}

      {status && (
        <p id="status" className={status.error ? "muted error" : "muted"}>
          {status.text}
        </p>
      )}
    </main>
  );
}
