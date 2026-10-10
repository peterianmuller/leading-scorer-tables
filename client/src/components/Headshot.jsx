import { useEffect, useState } from "react";
import { fetchHeadshot } from "../lib/api.js";
import { initials } from "../lib/stats.js";

// The player's Wikimedia Commons photo with its required credit, or their
// initials when Commons has none, the lookup fails, or the image won't load.
export default function Headshot({ player }) {
  // Tagged with the personId it belongs to, so switching games never shows
  // the previous player's photo while the next one loads.
  const [photo, setPhoto] = useState({ personId: null, data: null });
  const [broken, setBroken] = useState(null); // personId whose image failed

  useEffect(() => {
    let current = true;
    fetchHeadshot(player.personId)
      .then((data) => current && setPhoto({ personId: player.personId, data }))
      .catch(() => current && setPhoto({ personId: player.personId, data: null }));
    return () => {
      current = false;
    };
  }, [player.personId]);

  const data = photo.personId === player.personId && broken !== player.personId ? photo.data : null;

  return (
    <figure className="headshot">
      {data ? (
        <img src={data.url} alt={player.name} onError={() => setBroken(player.personId)} />
      ) : (
        <div className="initials" aria-hidden="true">
          {initials(player)}
        </div>
      )}
      {data && <Credit photo={data} />}
    </figure>
  );
}

// What CC licenses ask for: the author, the license, and a link to the source.
function Credit({ photo }) {
  return (
    <figcaption className="credit muted">
      <a href={photo.page} target="_blank" rel="noreferrer">
        Photo
      </a>
      {photo.artist && <> by {photo.artist}</>}
      {photo.license && (
        <>
          {" · "}
          {photo.licenseUrl ? (
            <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
              {photo.license}
            </a>
          ) : (
            photo.license
          )}
        </>
      )}
    </figcaption>
  );
}
