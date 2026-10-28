import { Router } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const router = Router();

const PLEX_PRODUCT = 'MyLists';
const PLEX_VERSION = '1.7.0';

// Library index cache: key -> { at, index }
const INDEX_TTL_MS = 10 * 60 * 1000;
const indexCache = new Map();

// Get or create a stable Plex client ID persisted alongside the database
const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), 'data');
const clientIdFile = path.join(dataDir, 'plex_client_id');
let PLEX_CLIENT_ID;
try {
  PLEX_CLIENT_ID = fs.readFileSync(clientIdFile, 'utf8').trim();
} catch {
  PLEX_CLIENT_ID = randomUUID();
  try { fs.writeFileSync(clientIdFile, PLEX_CLIENT_ID); } catch {}
}

function plexTvHeaders(token = null) {
  const h = {
    'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
    'X-Plex-Product': PLEX_PRODUCT,
    'X-Plex-Version': PLEX_VERSION,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) h['X-Plex-Token'] = token;
  return h;
}

function serverHeaders(token) {
  return {
    'X-Plex-Token': token,
    'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
    'X-Plex-Product': PLEX_PRODUCT,
    'X-Plex-Version': PLEX_VERSION,
    'Accept': 'application/json',
  };
}

function getPlexToken(userId) {
  const user = db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
  return user?.plex_token || null;
}

// --- Title normalisation -------------------------------------------------
// "The Matrix" vs "Matrix, The", "Amélie" vs "Amelie", "Fast & Furious" vs
// "Fast and Furious" all need to collapse onto the same key.
export function normalizeTitle(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[’'`"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Leading articles are the most common TMDB-vs-Plex difference.
function looseTitle(value) {
  return normalizeTitle(value).replace(/^(the|a|an) /, '');
}

function tmdbIdFromItem(meta) {
  const raw = meta?.externalId ?? meta?.tmdbId ?? meta?.tmdb_id ?? null;
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/^tmdb:/, '').replace(/[^0-9]/g, '');
  return s || null;
}

function guidsToIds(entry) {
  const ids = {};
  for (const g of entry.Guid || []) {
    const id = String(g.id || '');
    if (id.startsWith('tmdb://')) ids.tmdb = id.slice(7);
    else if (id.startsWith('imdb://')) ids.imdb = id.slice(7);
    else if (id.startsWith('tvdb://')) ids.tvdb = id.slice(7);
  }
  return ids;
}

// --- Plex requests -------------------------------------------------------

async function fetchJson(url, token, extraHeaders = {}, timeout = 20000) {
  const r = await fetch(url, {
    headers: { ...serverHeaders(token), ...extraHeaders },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Plex returned ${r.status} for ${url.replace(/\?.*$/, '')}`);
    err.status = r.status;
    err.body = body.slice(0, 200);
    throw err;
  }
  return r.json();
}

async function getSections(base, token) {
  const data = await fetchJson(`${base}/library/sections`, token);
  return data.MediaContainer?.Directory || [];
}

async function getMachineIdentifier(base, token) {
  try {
    const data = await fetchJson(`${base}/identity`, token);
    return data.MediaContainer?.machineIdentifier || null;
  } catch {
    return null;
  }
}

// Pull a section's whole item list. `/library/sections/{key}/search` was removed
// from modern Plex Media Server (it answers 400 Bad Request), so items are listed
// once and matched locally instead. Paged in case the server caps page size.
async function fetchSectionItems(base, token, sectionKey) {
  const items = [];
  const pageSize = 500;
  let start = 0;

  for (;;) {
    const data = await fetchJson(
      `${base}/library/sections/${sectionKey}/all?includeGuids=1`,
      token,
      {
        'X-Plex-Container-Start': String(start),
        'X-Plex-Container-Size': String(pageSize),
      },
      30000
    );
    const page = data.MediaContainer?.Metadata || [];
    items.push(...page);
    const total = Number(data.MediaContainer?.totalSize ?? items.length);
    if (page.length === 0 || page.length < pageSize || items.length >= total) break;
    start += page.length;
  }

  return items;
}

// Every section of the requested type, indexed for matching. A library can hold
// several Movies sections (Movies, One Piece Movies, Family Videos, ...) and
// several TV sections; the old code looked at the first of each and nothing else.
export async function buildLibraryIndex(base, token, sectionType) {
  const cacheKey = `${base}|${sectionType}|${token.slice(-8)}`;
  const cached = indexCache.get(cacheKey);
  if (cached && Date.now() - cached.at < INDEX_TTL_MS) return cached.index;

  const sections = await getSections(base, token);
  const wanted = sections.filter(s => s.type === sectionType);
  if (wanted.length === 0) {
    const err = new Error(
      sectionType === 'movie'
        ? 'No Movies library found in Plex'
        : 'No TV Shows library found in Plex'
    );
    err.status = 404;
    throw err;
  }

  const index = {
    sections: wanted.map(s => ({ key: s.key, title: s.title })),
    entries: [],
    byTmdb: new Map(),
    byTitleYear: new Map(),
    byLooseTitleYear: new Map(),
    byTitle: new Map(),
    byLooseTitle: new Map(),
  };

  for (const section of wanted) {
    let items = [];
    try {
      items = await fetchSectionItems(base, token, section.key);
    } catch {
      continue; // one unreadable section must not sink the export
    }

    for (const item of items) {
      if (!item.ratingKey || !item.title) continue;
      const ids = guidsToIds(item);
      const entry = {
        ratingKey: String(item.ratingKey),
        title: item.title,
        year: item.year ? String(item.year) : null,
        sectionKey: section.key,
        sectionTitle: section.title,
        tmdb: ids.tmdb || null,
      };
      index.entries.push(entry);

      const norm = normalizeTitle(item.title);
      const loose = looseTitle(item.title);

      if (ids.tmdb && !index.byTmdb.has(ids.tmdb)) index.byTmdb.set(ids.tmdb, entry);
      if (entry.year) {
        if (!index.byTitleYear.has(`${norm}|${entry.year}`)) index.byTitleYear.set(`${norm}|${entry.year}`, entry);
        if (!index.byLooseTitleYear.has(`${loose}|${entry.year}`)) index.byLooseTitleYear.set(`${loose}|${entry.year}`, entry);
      }
      if (!index.byTitle.has(norm)) index.byTitle.set(norm, entry);
      if (!index.byLooseTitle.has(loose)) index.byLooseTitle.set(loose, entry);
    }
  }

  indexCache.set(cacheKey, { at: Date.now(), index });
  return index;
}

// Match a MyLists item against the library index: TMDB id first (exact), then
// title+year, then article-insensitive title forms.
export function matchItem(index, meta, fallbackText) {
  const title = meta?.title || fallbackText || '';
  const year = meta?.year ? String(meta.year) : null;
  const tmdb = tmdbIdFromItem(meta);
  const norm = normalizeTitle(title);
  const loose = looseTitle(title);

  if (tmdb && index.byTmdb.has(tmdb)) return { entry: index.byTmdb.get(tmdb), via: 'tmdb' };
  if (year) {
    if (index.byTitleYear.has(`${norm}|${year}`)) return { entry: index.byTitleYear.get(`${norm}|${year}`), via: 'title-year' };
    if (index.byLooseTitleYear.has(`${loose}|${year}`)) return { entry: index.byLooseTitleYear.get(`${loose}|${year}`), via: 'loose-title-year' };
  }
  if (index.byTitle.has(norm)) return { entry: index.byTitle.get(norm), via: 'title' };
  if (index.byLooseTitle.has(loose)) return { entry: index.byLooseTitle.get(loose), via: 'loose-title' };
  return null;
}

// Playlists whose title matches, case-insensitively.
export async function findPlaylists(base, token, name) {
  const wanted = normalizeTitle(name);
  try {
    const data = await fetchJson(`${base}/playlists?playlistType=video`, token);
    return (data.MediaContainer?.Metadata || [])
      .filter(p => normalizeTitle(p.title) === wanted)
      .map(p => ({ ratingKey: String(p.ratingKey), title: p.title }));
  } catch {
    return [];
  }
}

export async function deletePlaylist(base, token, ratingKey) {
  const r = await fetch(`${base}/playlists/${ratingKey}`, {
    method: 'DELETE',
    headers: serverHeaders(token),
    signal: AbortSignal.timeout(15000),
  });
  return r.ok;
}

export async function createPlaylist(base, token, machineId, name, ratingKeys) {
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKeys.join(',')}`;
  const params = new URLSearchParams({ uri, title: name, type: 'video', smart: '0' });
  const r = await fetch(`${base}/playlists?${params}`, {
    method: 'POST',
    headers: serverHeaders(token),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Plex refused the playlist (HTTP ${r.status}): ${body.slice(0, 200)}`);
  }
  const data = await r.json().catch(() => ({}));
  return String(data.MediaContainer?.Metadata?.[0]?.ratingKey || '');
}

// --- Routes -------------------------------------------------------------

router.get('/status', (req, res) => {
  const token = getPlexToken(req.user.id);
  res.json({ authenticated: !!token, clientId: PLEX_CLIENT_ID });
});

router.post('/pin', async (req, res) => {
  try {
    const r = await fetch('https://plex.tv/api/v2/pins?strong=true', {
      method: 'POST',
      headers: plexTvHeaders(),
    });
    if (!r.ok) throw new Error(`Plex returned ${r.status}`);
    const data = await r.json();
    const authUrl = `https://app.plex.tv/auth#?clientID=${encodeURIComponent(PLEX_CLIENT_ID)}&code=${encodeURIComponent(data.code)}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PLEX_PRODUCT)}`;
    res.json({ pinId: data.id, pinCode: data.code, authUrl });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to start Plex auth' });
  }
});

router.get('/pin/:pinId', async (req, res) => {
  try {
    const r = await fetch(`https://plex.tv/api/v2/pins/${req.params.pinId}`, {
      headers: plexTvHeaders(),
    });
    if (!r.ok) throw new Error(`Plex returned ${r.status}`);
    const data = await r.json();
    if (data.authToken) {
      db.prepare('UPDATE users SET plex_token = ? WHERE id = ?').run(data.authToken, req.user.id);
      res.json({ authorized: true });
    } else {
      res.json({ authorized: false });
    }
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to check PIN' });
  }
});

router.delete('/token', (req, res) => {
  db.prepare('UPDATE users SET plex_token = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.get('/servers', async (req, res) => {
  const token = getPlexToken(req.user.id);
  if (!token) return res.status(401).json({ error: 'Not authenticated with Plex' });

  try {
    const r = await fetch('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', {
      headers: plexTvHeaders(token),
    });
    if (r.status === 401) {
      db.prepare('UPDATE users SET plex_token = NULL WHERE id = ?').run(req.user.id);
      return res.status(401).json({ error: 'Plex session expired, please reconnect' });
    }
    if (!r.ok) throw new Error(`Plex returned ${r.status}`);
    const data = await r.json();

    const servers = (Array.isArray(data) ? data : [])
      .filter(item => item.provides?.split(',').includes('server'))
      .map(item => ({
        id: item.clientIdentifier,
        name: item.name,
        connections: (item.connections || []).map(c => ({
          uri: c.uri,
          local: !!c.local,
          relay: !!c.relay,
        })),
        accessToken: item.accessToken,
      }));

    res.json(servers);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to get Plex servers' });
  }
});

router.get('/users', async (req, res) => {
  const token = getPlexToken(req.user.id);
  if (!token) return res.status(401).json({ error: 'Not authenticated with Plex' });

  try {
    const r = await fetch('https://plex.tv/api/v2/home/users', {
      headers: plexTvHeaders(token),
    });
    if (!r.ok) throw new Error(`Plex returned ${r.status}`);
    const data = await r.json();
    res.json((data.users || []).map(u => ({
      id: u.id,
      uuid: u.uuid,
      title: u.title,
      thumb: u.thumb,
      isManaged: !!u.managed,
      hasPin: !!u.hasPassword,
    })));
  } catch {
    // Plex Home might not be enabled — return an empty list to signal skip
    res.json([]);
  }
});

router.post('/switch-user', async (req, res) => {
  const token = getPlexToken(req.user.id);
  if (!token) return res.status(401).json({ error: 'Not authenticated with Plex' });

  const { userUuid, pin } = req.body;
  if (!userUuid) return res.status(400).json({ error: 'userUuid is required' });

  try {
    let url = `https://plex.tv/api/v2/users/switch/${encodeURIComponent(userUuid)}`;
    if (pin) url += `?pin=${encodeURIComponent(pin)}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: plexTvHeaders(token),
    });
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: errData.message || 'Failed to switch user (wrong PIN?)' });
    }
    const data = await r.json();
    res.json({ userToken: data.authToken });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to switch user' });
  }
});

// Probe server connections to find the first reachable URI
export async function findServerUrl(connections, token) {
  const local = connections.filter(c => c.local && !c.relay);
  const remote = connections.filter(c => !c.local && !c.relay);
  const relay = connections.filter(c => c.relay);

  for (const conn of [...local, ...remote]) {
    try {
      const r = await fetch(`${conn.uri}/identity`, {
        headers: { 'X-Plex-Token': token, Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) return conn.uri.replace(/\/+$/, '');
    } catch { /* try next */ }
  }

  // Configured fallback (useful when plex.tv resources are stale), then relay.
  const configured = process.env.PLEX_URL;
  if (configured) {
    const url = configured.replace(/\/+$/, '');
    try {
      const r = await fetch(`${url}/identity`, {
        headers: { 'X-Plex-Token': token, Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) return url;
    } catch { /* ignore */ }
  }
  if (relay.length > 0) return relay[0].uri.replace(/\/+$/, '');
  return null;
}

// POST /api/plex/playlist
// Builds a Plex playlist named after the list. Any existing playlist with that
// name is replaced on every export — no confirmation step.
router.post('/playlist', async (req, res) => {
  const { categoryId, serverId, serverConnections, serverToken, userToken } = req.body;

  if (!categoryId || !Array.isArray(serverConnections) || !serverToken) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const category = db.prepare(
    'SELECT id, name, type FROM categories WHERE id = ? AND user_id = ?'
  ).get(categoryId, req.user.id);

  if (!category) return res.status(404).json({ error: 'List not found' });
  if (!['movies', 'tvshows'].includes(category.type)) {
    return res.status(400).json({ error: 'Only Movies and TV Shows lists can be exported to Plex' });
  }

  const items = db.prepare(
    'SELECT text, metadata FROM items WHERE category_id = ? ORDER BY sort_order'
  ).all(categoryId);

  if (items.length === 0) return res.status(400).json({ error: 'The list is empty' });

  const activeToken = userToken || serverToken;
  const base = await findServerUrl(serverConnections, activeToken);
  if (!base) {
    return res.status(502).json({ error: 'Cannot reach the Plex server. Make sure Plex is running and reachable from the MyLists host.' });
  }

  const sectionType = category.type === 'movies' ? 'movie' : 'show';
  const playlistName = category.name;

  try {
    const machineId = (await getMachineIdentifier(base, activeToken)) || serverId;
    if (!machineId) {
      return res.status(502).json({ error: 'Plex did not report its machine identifier, which is required to build the playlist' });
    }

    const index = await buildLibraryIndex(base, activeToken, sectionType);
    if (index.entries.length === 0) {
      return res.status(404).json({
        error: `Plex reports a ${sectionType === 'movie' ? 'Movies' : 'TV Shows'} library but no readable items in it.`,
        sections: index.sections.map(s => s.title),
      });
    }

    const seen = new Set();
    const ratingKeys = [];
    const notFound = [];
    const matchedBy = {};

    for (const item of items) {
      let meta = {};
      try { meta = item.metadata ? JSON.parse(item.metadata) : {}; } catch {}
      const hit = matchItem(index, meta, item.text);
      if (hit) {
        matchedBy[hit.via] = (matchedBy[hit.via] || 0) + 1;
        if (!seen.has(hit.entry.ratingKey)) {
          seen.add(hit.entry.ratingKey);
          ratingKeys.push(hit.entry.ratingKey);
        }
      } else {
        notFound.push(meta.title || item.text);
      }
    }

    if (ratingKeys.length === 0) {
      return res.status(404).json({
        error: 'None of the items in your list were found in the Plex library.',
        notFound,
        searchedSections: index.sections.map(s => s.title),
        searchedItems: index.entries.length,
      });
    }

    // Create the new playlist first, then remove the previous one(s) with the
    // same name — if Plex refuses the new one, the old playlist survives.
    const existing = await findPlaylists(base, activeToken, playlistName);
    const newKey = await createPlaylist(base, activeToken, machineId, playlistName, ratingKeys);

    let replacedCount = 0;
    for (const old of existing) {
      if (old.ratingKey === newKey) continue;
      if (await deletePlaylist(base, activeToken, old.ratingKey)) replacedCount += 1;
    }

    indexCache.delete(`${base}|${sectionType}|${activeToken.slice(-8)}`);

    res.json({
      success: true,
      playlistName,
      itemCount: ratingKeys.length,
      totalItems: items.length,
      notFound,
      replaced: replacedCount > 0,
      replacedCount,
      sections: index.sections.map(s => s.title),
      matchedBy,
    });
  } catch (err) {
    res.status(err.status && err.status >= 400 && err.status < 500 ? err.status : 502).json({
      error: err.message || 'Failed to create Plex playlist',
    });
  }
});

export default router;
