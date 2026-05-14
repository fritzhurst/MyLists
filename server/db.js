import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
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
if (!userColumns.find(c => c.name === 'plex_token')) {
  db.exec("ALTER TABLE users ADD COLUMN plex_token TEXT DEFAULT NULL");
}

const itemColumns = db.prepare("PRAGMA table_info(items)").all();
if (!itemColumns.find(c => c.name === 'metadata')) {
  db.exec("ALTER TABLE items ADD COLUMN metadata TEXT DEFAULT NULL");
}
if (!itemColumns.find(c => c.name === 'created_at')) {
  db.exec("ALTER TABLE items ADD COLUMN created_at TEXT DEFAULT NULL");
  db.exec("UPDATE items SET created_at = datetime('now') WHERE created_at IS NULL");
}

// Create notes table
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL,
    content     TEXT    DEFAULT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
`);

// Create attachments table
db.exec(`
  CREATE TABLE IF NOT EXISTS attachments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id       INTEGER NOT NULL,
    note_id       INTEGER DEFAULT NULL,
    filename      TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    mime_type     TEXT    NOT NULL,
    size          INTEGER NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
  );
`);

// Seed admin user if not exists; generate a random temp password and force change.
const admin = db.prepare("SELECT id, password, must_change_password FROM users WHERE email = 'admin'").get();
function printAdminBanner(lines) {
  const bar = '='.repeat(65);
  console.log(`\n${bar}`);
  for (const line of lines) console.log(`  ${line}`);
  console.log(`${bar}\n`);
}
if (!admin) {
  const tempPassword = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(tempPassword, 10);
  db.prepare("INSERT INTO users (email, password, role, must_change_password) VALUES ('admin', ?, 'admin', 1)").run(hash);
  printAdminBanner([
    'FIRST-RUN ADMIN CREDENTIALS',
    'Login:              admin',
    `Temporary password: ${tempPassword}`,
    'You will be required to change this on first login.',
  ]);
} else if (bcrypt.compareSync('admin', admin.password) && !admin.must_change_password) {
  // Existing install with legacy default password — force change on next login.
  db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(admin.id);
  printAdminBanner([
    'SECURITY: existing admin user still has the default password "admin".',
    'You will be required to change it on next login.',
  ]);
}

export default db;
