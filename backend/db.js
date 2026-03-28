const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const raw = new sqlite3.Database(path.join(__dirname, 'social.db'));

const db = {
  // SELECT vários rows
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },
  // SELECT um row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
    });
  },
  // INSERT / UPDATE / DELETE  → resolve({ lastID, changes })
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastInsertRowid: this.lastID, changes: this.changes });
      });
    });
  },
  // Executa múltiplos statements de uma vez
  exec(sql) {
    return new Promise((resolve, reject) => {
      raw.exec(sql, err => err ? reject(err) : resolve());
    });
  }
};

// ─── Inicialização ────────────────────────────────────────────────────────────

async function init() {
  await db.run('PRAGMA journal_mode = WAL');
  await db.run('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      handle      TEXT    NOT NULL UNIQUE,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      bio         TEXT    DEFAULT '',
      avatar_url  TEXT    DEFAULT '',
      banner_url  TEXT    DEFAULT '',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     TEXT    NOT NULL,
      image_url   TEXT    DEFAULT NULL,
      parent_id   INTEGER DEFAULT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS shares (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS saved_posts (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL CHECK(type IN ('like','comment','share','follow')),
      post_id     INTEGER DEFAULT NULL REFERENCES posts(id) ON DELETE CASCADE,
      read        INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Banco de dados pronto');
}

init().catch(err => { console.error('Erro ao inicializar banco:', err); process.exit(1); });

module.exports = db;