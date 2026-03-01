import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
    mustChangePassword: !!user.must_change_password,
  });
});

// GET /api/auth/me — get current user info
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/auth/register — admin creates a new user (just email, user sets password on first login)
router.post('/register', requireAuth, requireAdmin, (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Temp password — user must change on first login
  const tempPassword = bcrypt.hashSync('changeme', 10);
  const result = db.prepare('INSERT INTO users (email, password, role, must_change_password) VALUES (?, ?, ?, 1)').run(email.trim(), tempPassword, 'user');

  const user = db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// GET /api/auth/users — admin: list all users
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, role, created_at FROM users').all();
  res.json(users);
});

// DELETE /api/auth/users/:id — admin: delete a user
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Clean up user's categories and items
  db.prepare('DELETE FROM categories WHERE user_id = ?').run(id);

  res.status(204).end();
});

// POST /api/auth/change-password — change own password
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

// GET /api/auth/tmdb-key — get user's TMDB key
router.get('/tmdb-key', requireAuth, (req, res) => {
  const user = db.prepare('SELECT tmdb_api_key FROM users WHERE id = ?').get(req.user.id);
  res.json({ tmdbApiKey: user?.tmdb_api_key || '' });
});

// PUT /api/auth/tmdb-key — update user's TMDB key
router.put('/tmdb-key', requireAuth, (req, res) => {
  const { tmdbApiKey } = req.body;
  db.prepare('UPDATE users SET tmdb_api_key = ? WHERE id = ?').run(tmdbApiKey || null, req.user.id);
  res.json({ message: 'TMDB API key updated' });
});

export default router;
