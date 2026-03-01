const BASE = '/api';

export async function getCategories() {
  const res = await fetch(`${BASE}/categories`);
  return res.json();
}

export async function createCategory(name, type = 'generic') {
  const res = await fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type }),
  });
  return res.json();
}

export async function deleteCategory(id) {
  await fetch(`${BASE}/categories/${id}`, { method: 'DELETE' });
}

export async function getItems(categoryId) {
  const res = await fetch(`${BASE}/categories/${categoryId}/items`);
  return res.json();
}

export async function createItem(categoryId, text, metadata = null) {
  const res = await fetch(`${BASE}/categories/${categoryId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, metadata }),
  });
  return res.json();
}

export async function deleteItem(id) {
  await fetch(`${BASE}/items/${id}`, { method: 'DELETE' });
}

export async function reorderItems(categoryId, orderedIds) {
  await fetch(`${BASE}/categories/${categoryId}/items/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  });
}

// Search APIs
export async function searchBooks(query) {
  const res = await fetch(`${BASE}/search/books?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function searchMovies(query) {
  const res = await fetch(`${BASE}/search/movies?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function searchTV(query) {
  const res = await fetch(`${BASE}/search/tv?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getBookDetails(workId) {
  const res = await fetch(`${BASE}/search/books/${encodeURIComponent(workId)}/details`);
  return res.json();
}

export async function getMovieDetails(tmdbId) {
  const res = await fetch(`${BASE}/search/movies/${tmdbId}/details`);
  return res.json();
}

export async function getTVDetails(tmdbId) {
  const res = await fetch(`${BASE}/search/tv/${tmdbId}/details`);
  return res.json();
}
