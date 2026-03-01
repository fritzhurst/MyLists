import { Router } from 'express';
import db from '../db.js';

const router = Router();
const DEFAULT_TMDB_KEY = process.env.TMDB_API_KEY || '';

function getTmdbKey(userId) {
  const user = db.prepare('SELECT tmdb_api_key FROM users WHERE id = ?').get(userId);
  return user?.tmdb_api_key || DEFAULT_TMDB_KEY;
}

// --- Books: Open Library ---
router.get('/books', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query is required' });

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.docs || []).map(doc => ({
      externalId: doc.key,
      title: doc.title,
      author: (doc.author_name || []).join(', '),
      year: doc.first_publish_year || null,
      coverUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      thumbnailUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`
        : null,
    }));

    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Failed to search Open Library' });
  }
});

// Fetch book description from Open Library works API
router.get('/books/:workId/details', async (req, res) => {
  const { workId } = req.params;
  try {
    const url = `https://openlibrary.org/works/${workId}.json`;
    const response = await fetch(url);
    const data = await response.json();

    let description = null;
    if (typeof data.description === 'string') {
      description = data.description;
    } else if (data.description?.value) {
      description = data.description.value;
    }

    res.json({ description: description ? description.substring(0, 500) : null });
  } catch (err) {
    res.json({ description: null });
  }
});

// --- Movies: TMDB ---
router.get('/movies', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query is required' });

  const apiKey = getTmdbKey(req.user.id);
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key not configured' });

  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q)}&page=1`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || []).slice(0, 8).map(m => ({
      externalId: m.id,
      title: m.title,
      year: m.release_date ? m.release_date.substring(0, 4) : null,
      overview: m.overview,
      rating: m.vote_average,
      posterUrl: m.poster_path
        ? `https://image.tmdb.org/t/p/w300${m.poster_path}`
        : null,
      thumbnailUrl: m.poster_path
        ? `https://image.tmdb.org/t/p/w92${m.poster_path}`
        : null,
    }));

    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Failed to search TMDB' });
  }
});

// Fetch movie details (director, runtime)
router.get('/movies/:tmdbId/details', async (req, res) => {
  const { tmdbId } = req.params;
  const apiKey = getTmdbKey(req.user.id);
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key not configured' });

  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&append_to_response=credits`;
    const response = await fetch(url);
    const data = await response.json();

    const director = data.credits?.crew?.find(c => c.job === 'Director')?.name || null;

    res.json({
      director,
      runtime: data.runtime || null,
      rating: data.vote_average || null,
      overview: data.overview ? data.overview.substring(0, 500) : null,
    });
  } catch (err) {
    res.json({ director: null, runtime: null, rating: null, overview: null });
  }
});

// --- TV Shows: TMDB ---
router.get('/tv', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query is required' });

  const apiKey = getTmdbKey(req.user.id);
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key not configured' });

  try {
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(q)}&page=1`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || []).slice(0, 8).map(tv => ({
      externalId: tv.id,
      title: tv.name,
      year: tv.first_air_date ? tv.first_air_date.substring(0, 4) : null,
      overview: tv.overview,
      rating: tv.vote_average,
      posterUrl: tv.poster_path
        ? `https://image.tmdb.org/t/p/w300${tv.poster_path}`
        : null,
      thumbnailUrl: tv.poster_path
        ? `https://image.tmdb.org/t/p/w92${tv.poster_path}`
        : null,
    }));

    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Failed to search TMDB' });
  }
});

// Fetch TV show details (creator, network, seasons, episodes, status)
router.get('/tv/:tmdbId/details', async (req, res) => {
  const { tmdbId } = req.params;
  const apiKey = getTmdbKey(req.user.id);
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key not configured' });

  try {
    const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json({
      creator: (data.created_by || []).map(c => c.name).join(', ') || null,
      network: (data.networks || []).map(n => n.name).join(', ') || null,
      seasons: data.number_of_seasons || null,
      episodes: data.number_of_episodes || null,
      status: data.status || null,
      rating: data.vote_average || null,
      overview: data.overview ? data.overview.substring(0, 500) : null,
    });
  } catch (err) {
    res.json({ creator: null, network: null, seasons: null, episodes: null, status: null, rating: null, overview: null });
  }
});

export default router;
