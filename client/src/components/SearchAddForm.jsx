import { useState, useEffect, useRef } from 'react';
import * as api from '../api.js';

const searchFnMap = {
  books: api.searchBooks,
  movies: api.searchMovies,
  tvshows: api.searchTV,
};

const detailFnMap = {
  books: (result) => api.getBookDetails(result.externalId.replace('/works/', '')),
  movies: (result) => api.getMovieDetails(result.externalId),
  tvshows: (result) => api.getTVDetails(result.externalId),
};

const placeholderMap = {
  books: 'Search or type a book title...',
  movies: 'Search or type a movie title...',
  tvshows: 'Search or type a TV show title...',
};

function SearchAddForm({ categoryType, onAddItem }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const debounceRef = useRef(null);

  // Debounced type-ahead search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const searchFn = searchFnMap[categoryType];
        const data = await searchFn(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, categoryType]);

  const handlePick = async (result) => {
    setPicking(true);
    try {
      const detailFn = detailFnMap[categoryType];
      let metadata = { ...result };

      if (detailFn) {
        const details = await detailFn(result);
        metadata = { ...metadata, ...details };
      }

      onAddItem(result.title, metadata);
    } catch {
      // Still add with basic metadata if details fetch fails
      onAddItem(result.title, { ...result });
    }
    setQuery('');
    setResults([]);
    setPicking(false);
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    onAddItem(query.trim(), null);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="search-add-form">
      <form className="add-item-form" onSubmit={handleManualAdd}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholderMap[categoryType] || 'Search...'}
          disabled={picking}
        />
        <button type="submit" disabled={picking || !query.trim()}>Add</button>
        {loading && <span className="search-spinner">Searching...</span>}
      </form>

      {results.length > 0 && !picking && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.externalId} className="search-result" onClick={() => handlePick(r)}>
              {(r.thumbnailUrl) && (
                <img src={r.thumbnailUrl} alt="" className="search-thumb" />
              )}
              <div className="search-result-info">
                <strong>{r.title}</strong>
                {r.year && <span className="search-result-year"> ({r.year})</span>}
                {r.author && <span className="search-result-detail"> &mdash; {r.author}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchAddForm;
