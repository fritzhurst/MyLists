import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/categories — list categories for the logged-in user
router.get('/', (req, res) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order'
  ).all(req.user.id);
  res.json(categories);
});

// POST /api/categories — create a new category for the logged-in user
router.post('/', (req, res) => {
  const { name, type } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const validTypes = ['generic', 'books', 'movies', 'tvshows'];
  const categoryType = validTypes.includes(type) ? type : 'generic';

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM categories WHERE user_id = ?'
  ).get(req.user.id);
  const result = db.prepare(
    'INSERT INTO categories (name, sort_order, type, user_id) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), maxOrder.max_order + 1, categoryType, req.user.id);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

// PUT /api/categories/reorder — reorder categories for logged-in user
router.put('/reorder', (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array' });
  }

  const update = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ? AND user_id = ?');
  const reorderAll = db.transaction((ids, userId) => {
    ids.forEach((id, index) => {
      update.run(index, id, userId);
    });
  });

  reorderAll(orderedIds, req.user.id);
  res.sendStatus(200);
});

// DELETE /api/categories/:id — delete a category and its items (cascade)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare(
    'DELETE FROM categories WHERE id = ? AND user_id = ?'
  ).run(id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.status(204).end();
});

export default router;
