// Opens on a landing screen that leads to the two modes: games, which shows
// each team's leading scorer in a chosen game, and players, which shows any
// player's career averages. Which one is showing lives in the URL.

import { useEffect, useState } from "react";
import GamesView from "./components/GamesView.jsx";
import Landing from "./components/Landing.jsx";
import PlayersView from "./components/PlayersView.jsx";
import { parseView, recordView } from "./lib/view.js";

const currentView = () => parseView(window.location.search).view;

export default function App() {
  const [view, setView] = useState(currentView);

  // Back and forward can cross between modes; each view restores its own
  // details from the URL.
  useEffect(() => {
    const sync = () => setView(currentView());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function go(next) {
    recordView({ view: next }, "push");
    setView(next);
  }

  const home = () => go("home");
  if (view === "games") return <GamesView onHome={home} />;
  if (view === "players") return <PlayersView onHome={home} />;
  return <Landing onPick={go} />;
}
