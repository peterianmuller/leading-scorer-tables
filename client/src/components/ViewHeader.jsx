// A mode's title, with the way back to the landing screen above it. It's a
// real link, so it can be opened in a new tab; a plain click stays in the app.
export default function ViewHeader({ title, onHome }) {
  function home(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onHome();
  }

  return (
    <>
      <a className="home-link" href={window.location.pathname} onClick={home}>
        &larr; Home
      </a>
      <h1>{title}</h1>
    </>
  );
}
