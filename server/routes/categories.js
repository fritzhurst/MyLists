import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/categories — list all categories ordered by sort_order
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(categories);
});

// POST /api/categories — create a new category
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM categories').get();
  const result = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder.max_order + 1);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

// DELETE /api/categories/:id — delete a category and its items (cascade)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.status(204).end();
});

export default router;
