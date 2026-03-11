import { useState, useEffect, useRef } from 'react';
import * as api from '../api.js';

// Steps: loading | connect | pin | servers | users | user-pin | list | creating | exists-confirm | done | error

function PlexPlaylistModal({ categories, onClose }) {
  const [step, setStep] = useState('loading');
  const [pinData, setPinData] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPinInput, setUserPinInput] = useState('');
  const [userToken, setUserToken] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [existingName, setExistingName] = useState('');
  const pollRef = useRef(null);

  // Restore saved server/user token from localStorage
  useEffect(() => {
    const savedServer = localStorage.getItem('plexServer');
    if (savedServer) {
      try { setSelectedServer(JSON.parse(savedServer)); } catch {}
    }
    const savedToken = localStorage.getItem('plexUserToken');
    if (savedToken) setUserToken(savedToken);
  }, []);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const checkStatus = async () => {
    setStep('loading');
    setError('');
    try {
      const status = await api.getPlexStatus();
      if (status.authenticated) {
        const savedStr = localStorage.getItem('plexServer');
        if (savedStr) {
          try {
            const saved = JSON.parse(savedStr);
            setSelectedServer(saved);
            await loadUsers(saved);
            return;
          } catch {}
        }
        await loadServers();
      } else {
        setStep('connect');
      }
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  const loadServers = async () => {
    setStep('loading');
    try {
      const svrs = await api.getPlexServers();
      if (svrs.length === 0) {
        setError('No Plex servers found. Make sure Plex Media Server is running and connected to your Plex account.');
        setStep('error');
        return;
      }
      if (svrs.length === 1) {
        setSelectedServer(svrs[0]);
        localStorage.setItem('plexServer', JSON.stringify(svrs[0]));
        await loadUsers(svrs[0]);
      } else {
        setServers(svrs);
        setStep('servers');
      }
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('reconnect')) {
        setStep('connect');
      } else {
        setError(err.message);
        setStep('error');
      }
    }
  };

  const loadUsers = async (server) => {
    setStep('loading');
    try {
      const us = await api.getPlexUsers();
      // Filter out duplicates/invalid, only show if there are real home users
      const validUsers = us.filter(u => u.uuid && u.title);
      if (validUsers.length <= 1) {
        // Single user or no home — use admin token directly
        setSelectedUser(validUsers[0] || null);
        setUserToken(null);
        localStorage.removeItem('plexUserToken');
        setStep('list');
      } else {
        setUsers(validUsers);
        setStep('users');
      }
    } catch {
      // If home users endpoint fails, just proceed with server token
      setSelectedUser(null);
      setUserToken(null);
      setStep('list');
    }
  };

  const startPinAuth = async () => {
    setError('');
    try {
      const data = await api.initPlexPin();
      setPinData(data);
      setStep('pin');

      pollRef.current = setInterval(async () => {
        try {
          const status = await api.checkPlexPin(data.pinId);
          if (status.authorized) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            await loadServers();
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  const handleServerSelect = async (server) => {
    setSelectedServer(server);
    localStorage.setItem('plexServer', JSON.stringify(server));
    await loadUsers(server);
  };

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    setError('');
    if (!user.isManaged) {
      // Admin user — no switch needed, use server token directly
      setUserToken(null);
      localStorage.removeItem('plexUserToken');
      setStep('list');
    } else if (user.hasPin) {
      setUserPinInput('');
      setStep('user-pin');
    } else {
      await switchUser(user, null);
    }
  };

  const switchUser = async (user, pin) => {
    setStep('loading');
    try {
      const res = await api.switchPlexUser(user.uuid, pin);
      setUserToken(res.userToken);
      localStorage.setItem('plexUserToken', res.userToken);
      setStep('list');
    } catch (err) {
      setError(err.message);
      if (user.hasPin) {
        setStep('user-pin');
      } else {
        setStep('error');
      }
    }
  };

  const handleCreatePlaylist = async (confirmed = false) => {
    if (!selectedCategoryId || !selectedServer) return;
    setStep('creating');
    setError('');
    try {
      const res = await api.createPlexPlaylist({
        categoryId: selectedCategoryId,
        serverId: selectedServer.id,
        serverConnections: selectedServer.connections,
        serverToken: selectedServer.accessToken,
        userToken,
        confirmed,
      });
      if (res.exists) {
        setExistingName(res.playlistName);
        setStep('exists-confirm');
        return;
      }
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  const handleDisconnect = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await api.disconnectPlex();
    localStorage.removeItem('plexServer');
    localStorage.removeItem('plexUserToken');
    setSelectedServer(null);
    setUserToken(null);
    setSelectedUser(null);
    setPinData(null);
    setStep('connect');
  };

  const movieTvCategories = categories.filter(c => ['movies', 'tvshows'].includes(c.type));

  return (
    <div className="plex-modal-overlay" onClick={onClose}>
      <div className="plex-modal" onClick={e => e.stopPropagation()}>
        <div className="plex-modal-header">
          <span className="plex-logo-icon">▶</span>
          <h3>Create Plex Playlist</h3>
          <button className="plex-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="plex-modal-body">
          {step === 'loading' && (
            <div className="plex-centered">
              <div className="plex-spinner" />
              <p>Connecting to Plex...</p>
            </div>
          )}

          {step === 'connect' && (
            <div className="plex-step">
              <p>Connect your Plex account to create playlists directly from your lists.</p>
              <button className="plex-btn plex-btn-primary" onClick={startPinAuth}>
                Connect to Plex
              </button>
            </div>
          )}

          {step === 'pin' && pinData && (
            <div className="plex-step">
              <p>Open the link below in your browser and sign in to authorize MyLists:</p>
              <a
                className="plex-auth-link"
                href={pinData.authUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Authorize MyLists on Plex &rarr;
              </a>
              <div className="plex-pin-box">
                <span className="plex-pin-label">PIN:</span>
                <strong className="plex-pin-code">{pinData.pinCode.toUpperCase()}</strong>
              </div>
              <p className="plex-hint">Waiting for authorization&hellip;</p>
            </div>
          )}

          {step === 'servers' && (
            <div className="plex-step">
              <p>Select your Plex Media Server:</p>
              <div className="plex-option-list">
                {servers.map(s => (
                  <button key={s.id} className="plex-option-item" onClick={() => handleServerSelect(s)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'users' && (
            <div className="plex-step">
              <p>Which Plex profile would you like to use?</p>
              <div className="plex-option-list">
                {users.map(u => (
                  <button key={u.uuid || u.id} className="plex-option-item plex-user-item" onClick={() => handleUserSelect(u)}>
                    {u.thumb && <img src={u.thumb} alt="" className="plex-user-thumb" />}
                    <span>{u.title}</span>
                    {u.isManaged && u.hasPin && <span className="plex-pin-badge">PIN</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'user-pin' && selectedUser && (
            <div className="plex-step">
              <p>Enter the PIN for <strong>{selectedUser.title}</strong>:</p>
              <input
                type="password"
                inputMode="numeric"
                className="plex-pin-input"
                value={userPinInput}
                onChange={e => setUserPinInput(e.target.value)}
                placeholder="Enter PIN"
                maxLength={6}
                autoFocus
              />
              {error && <p className="plex-error-msg">{error}</p>}
              <div className="plex-btn-row">
                <button className="plex-btn plex-btn-secondary" onClick={() => { setError(''); setStep('users'); }}>
                  Back
                </button>
                <button
                  className="plex-btn plex-btn-primary"
                  disabled={!userPinInput}
                  onClick={() => { setError(''); switchUser(selectedUser, userPinInput); }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'list' && (
            <div className="plex-step">
              <div className="plex-context-bar">
                <span>Server: <strong>{selectedServer?.name}</strong></span>
                {selectedUser && <span> &middot; Profile: <strong>{selectedUser.title}</strong></span>}
                <button className="plex-link-btn" onClick={() => { setError(''); setStep('users'); }}>
                  Change
                </button>
              </div>

              {movieTvCategories.length === 0 ? (
                <p className="plex-warn">
                  You don&apos;t have any Movies or TV Shows lists yet. Create a list with type &ldquo;Movies&rdquo; or &ldquo;TV Shows&rdquo; to use this feature.
                </p>
              ) : (
                <>
                  <p>Select a list to export to Plex:</p>
                  <div className="plex-option-list">
                    {movieTvCategories.map(c => (
                      <button
                        key={c.id}
                        className={`plex-option-item ${selectedCategoryId === c.id ? 'plex-option-selected' : ''}`}
                        onClick={() => setSelectedCategoryId(c.id)}
                      >
                        <span className="plex-type-icon">{c.type === 'movies' ? '🎬' : '📺'}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="plex-btn-row plex-btn-row-top">
                    <button
                      className="plex-btn plex-btn-primary"
                      disabled={!selectedCategoryId}
                      onClick={() => handleCreatePlaylist(false)}
                    >
                      Create Playlist
                    </button>
                  </div>
                </>
              )}

              <button className="plex-link-btn plex-disconnect-btn" onClick={handleDisconnect}>
                Disconnect Plex
              </button>
            </div>
          )}

          {step === 'exists-confirm' && (
            <div className="plex-step">
              <p>
                A playlist named <strong>&ldquo;{existingName}&rdquo;</strong> already exists in Plex.
              </p>
              <p>Click OK to delete the existing playlist and recreate it with your current list data.</p>
              <div className="plex-btn-row plex-btn-row-top">
                <button className="plex-btn plex-btn-secondary" onClick={() => setStep('list')}>
                  Cancel
                </button>
                <button className="plex-btn plex-btn-primary" onClick={() => handleCreatePlaylist(true)}>
                  OK, Replace It
                </button>
              </div>
            </div>
          )}

          {step === 'creating' && (
            <div className="plex-centered">
              <div className="plex-spinner" />
              <p>Searching Plex library and creating playlist&hellip;</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="plex-step plex-done">
              <div className="plex-success-icon">&#10003;</div>
              <p>
                <strong>&ldquo;{result.playlistName}&rdquo;</strong> {result.replaced ? 'updated' : 'created'} in Plex!
              </p>
              <p className="plex-hint">
                {result.itemCount} of {result.totalItems} item{result.totalItems !== 1 ? 's' : ''} added.
              </p>
              {result.notFound && result.notFound.length > 0 && (
                <div className="plex-not-found">
                  <p>Not found in Plex library:</p>
                  <ul>
                    {result.notFound.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              <button className="plex-btn plex-btn-primary" onClick={onClose}>Done</button>
            </div>
          )}

          {step === 'error' && (
            <div className="plex-step">
              <p className="plex-error-msg">{error}</p>
              <div className="plex-btn-row plex-btn-row-top">
                <button className="plex-btn plex-btn-secondary" onClick={onClose}>Close</button>
                <button className="plex-btn plex-btn-primary" onClick={checkStatus}>Try Again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlexPlaylistModal;
