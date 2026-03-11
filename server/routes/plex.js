import { Router } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const router = Router();

const PLEX_PRODUCT = 'MyLists';
const PLEX_VERSION = '1.6.1';

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

function getPlexToken(userId) {
  const user = db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
  return user?.plex_token || null;
}

// GET /api/plex/status
router.get('/status', (req, res) => {
  const token = getPlexToken(req.user.id);
  res.json({ authenticated: !!token, clientId: PLEX_CLIENT_ID });
});

// POST /api/plex/pin — initiate Plex PIN auth
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

// GET /api/plex/pin/:pinId — poll for PIN authorization
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

// DELETE /api/plex/token — disconnect Plex
router.delete('/token', (req, res) => {
  db.prepare('UPDATE users SET plex_token = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// GET /api/plex/servers — list user's Plex Media Servers
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

// GET /api/plex/users — list Plex Home users
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
  } catch (err) {
    // Plex Home might not be enabled — return empty list to signal skip
    res.json([]);
  }
});

// POST /api/plex/switch-user — switch to a Plex Home managed user
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

// Helper: probe server connections to find the first reachable URI
async function findServerUrl(connections, token) {
  const local = connections.filter(c => c.local && !c.relay);
  const remote = connections.filter(c => !c.local && !c.relay);
  const relay = connections.filter(c => c.relay);

  for (const conn of [...local, ...remote]) {
    try {
      const r = await fetch(`${conn.uri}/identity`, {
        headers: { 'X-Plex-Token': token, Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) return conn.uri;
    } catch { /* try next */ }
  }

  // Fall back to relay if available
  if (relay.length > 0) return relay[0].uri;
  return null;
}

// POST /api/plex/playlist — create or replace a Plex playlist from a MyLists category
router.post('/playlist', async (req, res) => {
  const { categoryId, serverId, serverConnections, serverToken, userToken, confirmed } = req.body;

  if (!categoryId || !serverId || !serverConnections || !serverToken) {
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
  const serverUrl = await findServerUrl(serverConnections, activeToken);
  if (!serverUrl) {
    return res.status(502).json({ error: 'Cannot reach Plex server. Make sure Plex is running and accessible from this host.' });
  }

  const sectionType = category.type === 'movies' ? 'movie' : 'show';
  const playlistName = category.name;

  try {
    // Get library sections
    const sectResp = await fetch(`${serverUrl}/library/sections`, {
      headers: { 'X-Plex-Token': activeToken, Accept: 'application/json' },
    });
    if (!sectResp.ok) throw new Error('Failed to get Plex library sections');
    const sectData = await sectResp.json();
    const sections = sectData.MediaContainer?.Directory || [];
    const section = sections.find(s => s.type === sectionType);
    if (!section) {
      throw new Error(`No ${sectionType === 'movie' ? 'Movies' : 'TV Shows'} library found in Plex`);
    }

    // Check for existing playlist
    const plResp = await fetch(`${serverUrl}/playlists?playlistType=video`, {
      headers: { 'X-Plex-Token': activeToken, Accept: 'application/json' },
    });
    let existingKey = null;
    if (plResp.ok) {
      const plData = await plResp.json();
      const existing = (plData.MediaContainer?.Metadata || []).find(p => p.title === playlistName);
      if (existing) existingKey = existing.ratingKey;
    }

    // If playlist exists and not yet confirmed, ask client to confirm replacement
    if (existingKey && !confirmed) {
      return res.json({ exists: true, playlistName });
    }

    // Search for each item in the Plex library
    const ratingKeys = [];
    const notFound = [];

    for (const item of items) {
      let meta = {};
      try { meta = item.metadata ? JSON.parse(item.metadata) : {}; } catch {}
      const title = meta.title || item.text;
      const year = meta.year || null;

      const searchUrl = `${serverUrl}/library/sections/${section.key}/search?query=${encodeURIComponent(title)}`;
      const sResp = await fetch(searchUrl, {
        headers: { 'X-Plex-Token': activeToken, Accept: 'application/json' },
      });

      let match = null;
      if (sResp.ok) {
        const sData = await sResp.json();
        const results = sData.MediaContainer?.Metadata || [];
        if (year) {
          match = results.find(r => r.title?.toLowerCase() === title.toLowerCase() && String(r.year) === String(year));
        }
        if (!match) match = results.find(r => r.title?.toLowerCase() === title.toLowerCase());
        if (!match && results.length > 0) match = results[0];
      }

      if (match) ratingKeys.push(match.ratingKey);
      else notFound.push(title);
    }

    if (ratingKeys.length === 0) {
      return res.status(404).json({
        error: 'None of the items in your list were found in the Plex library.',
        notFound,
      });
    }

    // Delete existing playlist if confirmed replacement
    if (existingKey) {
      await fetch(`${serverUrl}/playlists/${existingKey}`, {
        method: 'DELETE',
        headers: { 'X-Plex-Token': activeToken },
      });
    }

    // Create new playlist
    const uri = `server://${serverId}/com.plexapp.plugins.library/library/metadata/${ratingKeys.join(',')}`;
    const createUrl = `${serverUrl}/playlists?uri=${encodeURIComponent(uri)}&title=${encodeURIComponent(playlistName)}&type=video&smart=0`;
    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: { 'X-Plex-Token': activeToken, Accept: 'application/json' },
    });

    if (!createResp.ok) {
      const txt = await createResp.text();
      throw new Error(`Plex returned ${createResp.status}: ${txt.substring(0, 200)}`);
    }

    res.json({
      success: true,
      playlistName,
      itemCount: ratingKeys.length,
      totalItems: items.length,
      notFound,
      replaced: !!existingKey,
    });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to create Plex playlist' });
  }
});

export default router;
