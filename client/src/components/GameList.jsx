import { isFinal } from "../lib/schedule.js";

// The day's games. Only finished ones can be opened.
export default function GameList({ games, activeGameId, onSelect }) {
  return (
    <div className="games">
      {games.map((game) =>
        isFinal(game) ? (
          <button
            key={game.gameId}
            type="button"
            className={game.gameId === activeGameId ? "game active" : "game"}
            onClick={() => onSelect(game.gameId)}
          >
            {game.away.tricode} {game.away.score} @ {game.home.tricode} {game.home.score}
          </button>
        ) : (
          // Scores are 0-0 until tip-off; showing them would read as a real
          // result, so an unplayed game shows the matchup and its start time.
          <button
            key={game.gameId}
            type="button"
            className="game"
            title={`${game.statusText} — no box score yet`}
            disabled
          >
            {game.away.tricode} @ {game.home.tricode}
          </button>
        )
      )}
    </div>
  );
}
