import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const router = Router();

// Helper: verify the category belongs to the logged-in user
function ownsCategory(categoryId, userId) {
  return db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(categoryId, userId);
}

// GET /api/categories/:categoryId/items — list items for a category
router.get('/:categoryId/items', (req, res) => {
  const { categoryId } = req.params;
  if (!ownsCategory(categoryId, req.user.id)) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const items = db.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY sort_order').all(categoryId);
  items.forEach(item => {
    if (item.metadata) item.metadata = JSON.parse(item.metadata);
  });
  res.json(items);
});

// POST /api/categories/:categoryId/items — add an item to a category
router.post('/:categoryId/items', (req, res) => {
  const { categoryId } = req.params;
  const { text, metadata } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!ownsCategory(categoryId, req.user.id)) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM items WHERE category_id = ?').get(categoryId);
  const result = db.prepare("INSERT INTO items (category_id, text, sort_order, metadata, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run(categoryId, text.trim(), maxOrder.max_order + 1, metadataJson);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  if (item.metadata) item.metadata = JSON.parse(item.metadata);
  res.status(201).json(item);
});

// DELETE /api/items/:id — delete a single item (verify ownership via category)
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Verify ownership through the item's category
  const item = db.prepare(
    'SELECT i.id FROM items i JOIN categories c ON i.category_id = c.id WHERE i.id = ? AND c.user_id = ?'
  ).get(id, req.user.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(id);

  // Clean up uploaded files for this item
  const uploadsDir = path.join(UPLOADS_DIR, String(id));
  fs.rm(uploadsDir, { recursive: true, force: true }, () => {});

  res.status(204).end();
});

// PUT /api/categories/:categoryId/items/reorder — reorder items
router.put('/:categoryId/items/reorder', (req, res) => {
  const { categoryId } = req.params;
  const { orderedIds } = req.body;

  if (!ownsCategory(categoryId, req.user.id)) {
    return res.status(404).json({ error: 'Category not found' });
  }

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
