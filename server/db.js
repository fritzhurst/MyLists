import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'mylists.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
// Enable foreign key enforcement (must be set per-connection)
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    text        TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
`);

// Migrations: add type and metadata columns (safe, idempotent)
const catColumns = db.prepare("PRAGMA table_info(categories)").all();
if (!catColumns.find(c => c.name === 'type')) {
  db.exec("ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'generic'");
}

const itemColumns = db.prepare("PRAGMA table_info(items)").all();
if (!itemColumns.find(c => c.name === 'metadata')) {
  db.exec("ALTER TABLE items ADD COLUMN metadata TEXT DEFAULT NULL");
}

export default db;
