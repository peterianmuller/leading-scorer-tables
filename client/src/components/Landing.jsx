// The first screen: Games at the top, Players at the bottom.
export default function Landing({ onPick }) {
  return (
    <main className="landing">
      <h1>Leading Scorers</h1>
      <button type="button" className="mode" onClick={() => onPick("games")}>
        Games
        <span>Each team&rsquo;s leading scorer in any game since 2019-20</span>
      </button>
      <button type="button" className="mode" onClick={() => onPick("players")}>
        Players
        <span>Career averages for anyone who has played in the NBA</span>
      </button>
    </main>
  );
}
