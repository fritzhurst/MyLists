import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'mylists.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
// Enable foreign key enforcement (must be set per-connection)
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'user',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

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
if (!catColumns.find(c => c.name === 'user_id')) {
  db.exec("ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id)");
}

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.find(c => c.name === 'tmdb_api_key')) {
  db.exec("ALTER TABLE users ADD COLUMN tmdb_api_key TEXT DEFAULT NULL");
}
if (!userColumns.find(c => c.name === 'must_change_password')) {
  db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
}

const itemColumns = db.prepare("PRAGMA table_info(items)").all();
if (!itemColumns.find(c => c.name === 'metadata')) {
  db.exec("ALTER TABLE items ADD COLUMN metadata TEXT DEFAULT NULL");
}

// Seed admin user if not exists
const admin = db.prepare("SELECT id FROM users WHERE email = 'admin'").get();
if (!admin) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare("INSERT INTO users (email, password, role) VALUES ('admin', ?, 'admin')").run(hash);
  console.log('Default admin user created (login: admin / admin)');
}

export default db;
