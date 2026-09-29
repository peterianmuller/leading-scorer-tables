export default function ManualLoad({ onLoad }) {
  function handleSubmit(e) {
    e.preventDefault();
    onLoad(new FormData(e.currentTarget).get("gameId").trim());
  }

  return (
    <details id="manual">
      <summary>Load by game ID</summary>
      <form onSubmit={handleSubmit}>
        <label>
          Game ID
          <input name="gameId" placeholder="0022500002" pattern={String.raw`\d{10}`} />
        </label>
        <button type="submit">Load</button>
      </form>
    </details>
  );
}
