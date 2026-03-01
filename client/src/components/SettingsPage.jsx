import { useState, useEffect } from 'react';
import * as api from '../api.js';

function SettingsPage({ user, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [tmdbKey, setTmdbKey] = useState('');
  const [tmdbMsg, setTmdbMsg] = useState('');
  const [tmdbError, setTmdbError] = useState('');

  useEffect(() => {
    api.getTmdbKey().then((data) => setTmdbKey(data.tmdbApiKey || '')).catch(() => {});
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMsg('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const handleTmdbSave = async (e) => {
    e.preventDefault();
    setTmdbMsg('');
    setTmdbError('');

    try {
      await api.updateTmdbKey(tmdbKey);
      setTmdbMsg('TMDB API key saved');
    } catch (err) {
      setTmdbError(err.message);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        <p className="settings-user">Logged in as <strong>{user.email}</strong></p>

        <form className="settings-form" onSubmit={handlePasswordChange}>
          <h3>Change Password</h3>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />
          {passwordError && <div className="login-error">{passwordError}</div>}
          {passwordMsg && <div className="settings-success">{passwordMsg}</div>}
          <button type="submit">Update Password</button>
        </form>

        <form className="settings-form" onSubmit={handleTmdbSave}>
          <h3>TMDB API Key</h3>
          <p className="settings-hint">
            Your personal TMDB key for Movies/TV searches. Leave blank to use the server default.
          </p>
          <input
            type="text"
            value={tmdbKey}
            onChange={(e) => setTmdbKey(e.target.value)}
            placeholder="TMDB API key"
          />
          {tmdbError && <div className="login-error">{tmdbError}</div>}
          {tmdbMsg && <div className="settings-success">{tmdbMsg}</div>}
          <button type="submit">Save Key</button>
        </form>
      </div>
    </div>
  );
}

export default SettingsPage;
