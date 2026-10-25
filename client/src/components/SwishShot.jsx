// The landing's banner: a ball arcs from the left, drops through the hoop,
// swishes the net and bounces to rest under it. Plays once; a click shoots
// again. All the motion lives in style.css.

import { useState } from "react";

export default function SwishShot() {
  // A new key remounts the ball and net, which restarts their animations.
  const [shot, setShot] = useState(0);

  return (
    <svg
      className="swish"
      viewBox="0 0 400 140"
      aria-hidden="true"
      onClick={() => setShot((n) => n + 1)}
    >
      <line className="swish-floor" x1="0" y1="140" x2="400" y2="140" />
      <rect className="swish-board" x="366" y="14" width="6" height="56" rx="2" />
      <line className="swish-rim" x1="352" y1="50" x2="366" y2="50" />
      {/* The back of the rim, behind the ball. */}
      <path className="swish-rim" d="M308 50 A22 5 0 0 1 352 50" />

      <g key={shot}>
        <g className="ball-x">
          <g className="ball-y">
            <g className="ball-spin">
              <circle className="ball" cx="30" cy="120" r="10" />
              <path
                className="ball-seam"
                d="M20 120 H40 M30 110 V130 M23 113 Q28 120 23 127 M37 113 Q32 120 37 127"
              />
            </g>
          </g>
        </g>

        {/* The net and the front of the rim, over the ball. */}
        <path
          className="swish-net"
          d="M308 50 L316 80 L344 80 L352 50 M316 50 L322 80 M330 50 V80 M344 50 L338 80 M311 61 H349 M313 70 H347"
        />
      </g>
      <path className="swish-rim" d="M308 50 A22 5 0 0 0 352 50" />
    </svg>
  );
}
