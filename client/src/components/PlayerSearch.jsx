import { useId, useMemo, useState } from "react";
import { careerYears, matchPlayers } from "../lib/players.js";

// A name box that suggests players as you type. Arrow keys move through the
// suggestions, Enter picks one, Escape closes the list; a click works too.
export default function PlayerSearch({ players, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const matches = useMemo(() => matchPlayers(players, query), [players, query]);
  const showList = open && matches.length > 0;

  function pick(player) {
    setQuery(player.name);
    setOpen(false);
    onSelect(player);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.min(Math.max(i + step, 0), matches.length - 1));
    } else if (e.key === "Enter" && showList) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="search">
      <label htmlFor={`${id}-input`}>Player</label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        spellCheck="false"
        placeholder="Start typing a name, e.g. LeBron James"
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        aria-expanded={showList}
        aria-activedescendant={showList ? `${id}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="suggestions">
          {matches.map((player, i) => (
            <li
              key={player.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keeps focus in the input, so its blur doesn't close the list
              // before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(player)}
            >
              {player.name} <span className="muted">{careerYears(player)}</span>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && matches.length === 0 && (
        <p className="muted">No players match &ldquo;{query.trim()}&rdquo;.</p>
      )}
    </div>
  );
}
