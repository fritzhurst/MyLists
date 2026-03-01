import { useState, useEffect } from 'react';
import * as api from '../api.js';

function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testEmailMsg, setTestEmailMsg] = useState('');

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
    api.getEmailStatus().then((data) => setEmailConfigured(data.configured)).catch(() => {});
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const result = await api.registerUser(newEmail.trim());
      setUsers((prev) => [...prev, result]);
      setNewEmail('');
      const emailNote = result.emailSent
        ? ' A welcome email has been sent.'
        : ' (Email not configured — tell them their password is "changeme")';
      setSuccess(`User "${result.email}" created.${emailNote}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.email}" and all their data?`)) return;
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTestEmail = async (e) => {
    e.preventDefault();
    setTestEmailMsg('');
    try {
      const result = await api.sendTestEmail(testEmailTo);
      setTestEmailMsg(result.message);
    } catch (err) {
      setTestEmailMsg(err.message);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h2>User Management</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        <form className="settings-form" onSubmit={handleAddUser}>
          <label>Add New User</label>
          <div className="settings-row">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
            <button type="submit">Add User</button>
          </div>
          <p className="settings-hint">
            New users log in with temporary password "changeme" and must change it.
            {emailConfigured && ' A welcome email will be sent automatically.'}
          </p>
        </form>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}

        <div className="user-list">
          <h3>Users</h3>
          {users.map((user) => (
            <div key={user.id} className="user-row">
              <span className="user-email">{user.email}</span>
              <span className="user-role">{user.role}</span>
              {user.role !== 'admin' && (
                <button
                  className="user-delete"
                  onClick={() => handleDeleteUser(user)}
                  title="Delete user"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="settings-form" style={{ marginTop: '16px' }}>
          <h3>Email</h3>
          <p className="settings-hint" style={{ marginBottom: '8px' }}>
            Status: {emailConfigured
              ? <span style={{ color: '#27ae60' }}>Configured</span>
              : <span style={{ color: '#e74c3c' }}>Not configured (set SMTP_USER and SMTP_PASS in .env)</span>
            }
          </p>
          {emailConfigured && (
            <form onSubmit={handleTestEmail}>
              <div className="settings-row">
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="test@example.com"
                  required
                />
                <button type="submit">Send Test</button>
              </div>
              {testEmailMsg && <p className="settings-hint" style={{ marginTop: '6px' }}>{testEmailMsg}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
