import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/categories/:categoryId/items — list items for a category
router.get('/:categoryId/items', (req, res) => {
  const { categoryId } = req.params;
  const items = db.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY sort_order').all(categoryId);
  res.json(items);
});

// POST /api/categories/:categoryId/items — add an item to a category
router.post('/:categoryId/items', (req, res) => {
  const { categoryId } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM items WHERE category_id = ?').get(categoryId);
  const result = db.prepare('INSERT INTO items (category_id, text, sort_order) VALUES (?, ?, ?)').run(categoryId, text.trim(), maxOrder.max_order + 1);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// DELETE /api/items/:id — delete a single item
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.status(204).end();
});

// PUT /api/categories/:categoryId/items/reorder — reorder items
router.put('/:categoryId/items/reorder', (req, res) => {
  const { categoryId } = req.params;
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array' });
  }

  const update = db.prepare('UPDATE items SET sort_order = ? WHERE id = ? AND category_id = ?');
  const reorderAll = db.transaction((ids, catId) => {
    ids.forEach((id, index) => {
      update.run(index, id, catId);
    });
  });

  reorderAll(orderedIds, categoryId);
  res.sendStatus(200);
});

export default router;
