const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function authFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers),
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
  return res;
}

// Auth APIs
export async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
}

export async function getMe() {
  const res = await authFetch(`${BASE}/auth/me`);
  return res.json();
}

export async function getUsers() {
  const res = await authFetch(`${BASE}/auth/users`);
  return res.json();
}

export async function registerUser(email) {
  const res = await authFetch(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Registration failed');
  }
  return res.json();
}

export async function deleteUser(id) {
  await authFetch(`${BASE}/auth/users/${id}`, { method: 'DELETE' });
}

// Category APIs
export async function getCategories() {
  const res = await authFetch(`${BASE}/categories`);
  return res.json();
}

export async function createCategory(name, type = 'generic') {
  const res = await authFetch(`${BASE}/categories`, {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  });
  return res.json();
}

export async function deleteCategory(id) {
  await authFetch(`${BASE}/categories/${id}`, { method: 'DELETE' });
}

// Item APIs
export async function getItems(categoryId) {
  const res = await authFetch(`${BASE}/categories/${categoryId}/items`);
  return res.json();
}

export async function createItem(categoryId, text, metadata = null) {
  const res = await authFetch(`${BASE}/categories/${categoryId}/items`, {
    method: 'POST',
    body: JSON.stringify({ text, metadata }),
  });
  return res.json();
}

export async function deleteItem(id) {
  await authFetch(`${BASE}/items/${id}`, { method: 'DELETE' });
}

export async function reorderItems(categoryId, orderedIds) {
  await authFetch(`${BASE}/categories/${categoryId}/items/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}

// Search APIs
export async function searchBooks(query) {
  const res = await authFetch(`${BASE}/search/books?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function searchMovies(query) {
  const res = await authFetch(`${BASE}/search/movies?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function searchTV(query) {
  const res = await authFetch(`${BASE}/search/tv?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getBookDetails(workId) {
  const res = await authFetch(`${BASE}/search/books/${encodeURIComponent(workId)}/details`);
  return res.json();
}

export async function getMovieDetails(tmdbId) {
  const res = await authFetch(`${BASE}/search/movies/${tmdbId}/details`);
  return res.json();
}

export async function getTVDetails(tmdbId) {
  const res = await authFetch(`${BASE}/search/tv/${tmdbId}/details`);
  return res.json();
}

// Settings APIs
export async function changePassword(currentPassword, newPassword) {
  const res = await authFetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Password change failed');
  }
  return res.json();
}

export async function updateTmdbKey(tmdbApiKey) {
  const res = await authFetch(`${BASE}/auth/tmdb-key`, {
    method: 'PUT',
    body: JSON.stringify({ tmdbApiKey }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to update TMDB key');
  }
  return res.json();
}

export async function getTmdbKey() {
  const res = await authFetch(`${BASE}/auth/tmdb-key`);
  return res.json();
}

// Email APIs
export async function getEmailStatus() {
  const res = await authFetch(`${BASE}/auth/email-status`);
  return res.json();
}

export async function sendTestEmail(to) {
  const res = await authFetch(`${BASE}/auth/test-email`, {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to send test email');
  }
  return res.json();
}
