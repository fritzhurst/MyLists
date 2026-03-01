function ItemPopover({ item, categoryType }) {
  const m = item.metadata;
  if (!m) return null;

  return (
    <div className="item-popover">
      {(m.coverUrl || m.posterUrl) && (
        <img src={m.coverUrl || m.posterUrl} alt="" className="popover-image" />
      )}
      <div className="popover-details">
        <h3>{item.text}</h3>

        {categoryType === 'books' && (
          <>
            {m.author && <p><strong>Author:</strong> {m.author}</p>}
            {m.year && <p><strong>Published:</strong> {m.year}</p>}
            {m.description && <p className="popover-overview">{m.description}</p>}
          </>
        )}

        {categoryType === 'movies' && (
          <>
            {m.director && <p><strong>Director:</strong> {m.director}</p>}
            {m.year && <p><strong>Year:</strong> {m.year}</p>}
            {m.runtime != null && <p><strong>Runtime:</strong> {m.runtime} min</p>}
            {m.rating != null && <p><strong>Rating:</strong> {m.rating}/10</p>}
            {m.overview && <p className="popover-overview">{m.overview}</p>}
          </>
        )}

        {categoryType === 'tvshows' && (
          <>
            {m.creator && <p><strong>Creator:</strong> {m.creator}</p>}
            {m.network && <p><strong>Network:</strong> {m.network}</p>}
            {m.seasons != null && <p><strong>Seasons:</strong> {m.seasons}</p>}
            {m.episodes != null && <p><strong>Episodes:</strong> {m.episodes}</p>}
            {m.status && <p><strong>Status:</strong> {m.status}</p>}
            {m.rating != null && <p><strong>Rating:</strong> {m.rating}/10</p>}
            {m.overview && <p className="popover-overview">{m.overview}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default ItemPopover;
