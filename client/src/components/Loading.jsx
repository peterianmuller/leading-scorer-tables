// A loading message with a ball dribbling beside it. The motion lives in
// style.css; the text is what screen readers announce.

export default function Loading({ id, children }) {
  return (
    <p id={id} className="muted loading" role="status">
      <svg className="dribble" viewBox="0 0 20 28" aria-hidden="true">
        <ellipse className="dribble-shadow" cx="10" cy="26" rx="6" ry="1.5" />
        <g className="dribble-ball">
          <circle cx="10" cy="7" r="6" />
          <path d="M4 7 H16 M10 1 V13 M6 3 Q8.5 7 6 11 M14 3 Q11.5 7 14 11" />
        </g>
      </svg>
      {children}
    </p>
  );
}
