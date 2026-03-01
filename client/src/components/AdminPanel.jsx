import { useState, useEffect } from 'react';
import * as api from '../api.js';

function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const user = await api.registerUser(newEmail.trim());
      setUsers((prev) => [...prev, user]);
      setNewEmail('');
      setSuccess(`User "${user.email}" created with temporary password "changeme"`);
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
          <p className="settings-hint">New users will log in with temporary password "changeme" and must change it.</p>
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
      </div>
    </div>
  );
}

export default AdminPanel;
