import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from '../db.js';

const router = Router();

const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const itemDir = path.join(UPLOADS_DIR, String(req.params.itemId));
    fs.mkdirSync(itemDir, { recursive: true });
    cb(null, itemDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = crypto.randomUUID() + ext;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Helper: verify item ownership through category
function ownsItem(itemId, userId) {
  return db.prepare(
    'SELECT i.id FROM items i JOIN categories c ON i.category_id = c.id WHERE i.id = ? AND c.user_id = ?'
  ).get(itemId, userId);
}

// GET /api/items/:itemId/notes — list notes and attachments for an item
router.get('/:itemId/notes', (req, res) => {
  const { itemId } = req.params;
  if (!ownsItem(itemId, req.user.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const notes = db.prepare('SELECT * FROM notes WHERE item_id = ? ORDER BY created_at DESC').all(itemId);
  const attachments = db.prepare('SELECT * FROM attachments WHERE item_id = ? ORDER BY created_at DESC').all(itemId);
  res.json({ notes, attachments });
});

// POST /api/items/:itemId/notes — add a text note
router.post('/:itemId/notes', (req, res) => {
  const { itemId } = req.params;
  const { content } = req.body;
  if (!ownsItem(itemId, req.user.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const result = db.prepare('INSERT INTO notes (item_id, content) VALUES (?, ?)').run(itemId, content.trim());
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(note);
});

// DELETE /api/items/:itemId/notes/:noteId — delete a note
router.delete('/:itemId/notes/:noteId', (req, res) => {
  const { itemId, noteId } = req.params;
  if (!ownsItem(itemId, req.user.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  db.prepare('DELETE FROM notes WHERE id = ? AND item_id = ?').run(noteId, itemId);
  res.sendStatus(204);
});

// POST /api/items/:itemId/attachments — upload file(s)
router.post('/:itemId/attachments', upload.array('files', 10), (req, res) => {
  const { itemId } = req.params;
  const noteId = req.body.noteId || null;
  if (!ownsItem(itemId, req.user.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const insert = db.prepare(
    'INSERT INTO attachments (item_id, note_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertAll = db.transaction((files) => {
    return files.map(f => {
      const result = insert.run(itemId, noteId, f.filename, f.originalname, f.mimetype, f.size);
      return db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
    });
  });

  const attachments = insertAll(req.files);
  res.status(201).json(attachments);
});

// DELETE /api/items/:itemId/attachments/:attachmentId — delete an attachment
router.delete('/:itemId/attachments/:attachmentId', (req, res) => {
  const { itemId, attachmentId } = req.params;
  if (!ownsItem(itemId, req.user.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ? AND item_id = ?').get(attachmentId, itemId);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  // Delete file from disk
  const filePath = path.join(UPLOADS_DIR, String(itemId), attachment.filename);
  try { fs.unlinkSync(filePath); } catch {}

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  res.sendStatus(204);
});

export default router;
