// Generated from schema.sql. The worker runs these once per instance, so a fresh database sets itself up.
export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, plan TEXT NOT NULL DEFAULT 'free', pro_until INTEGER, credits INTEGER NOT NULL DEFAULT 0, stripe_customer TEXT, handle TEXT, streak INTEGER NOT NULL DEFAULT 0, last_daily TEXT, email TEXT )",
  "CREATE TABLE IF NOT EXISTS readings ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT, excerpt TEXT NOT NULL, raw INTEGER NOT NULL, score INTEGER NOT NULL, tier INTEGER NOT NULL, metrics TEXT NOT NULL, vote_count INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS readings_new ON readings(hidden, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS readings_top ON readings(hidden, vote_count DESC)",
  "CREATE TABLE IF NOT EXISTS votes ( reading_id TEXT NOT NULL, user_id TEXT NOT NULL, tier INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (reading_id, user_id) )",
  "CREATE INDEX IF NOT EXISTS votes_reading ON votes(reading_id)",
  "CREATE TABLE IF NOT EXISTS reports ( reading_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (reading_id, user_id) )",
  "CREATE TABLE IF NOT EXISTS usage ( user_id TEXT NOT NULL, day TEXT NOT NULL, wingman INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day) )",
  "CREATE TABLE IF NOT EXISTS daily_entries ( day TEXT NOT NULL, user_id TEXT NOT NULL, lines TEXT NOT NULL, score INTEGER NOT NULL, tier INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (day, user_id) )",
  "CREATE INDEX IF NOT EXISTS daily_board ON daily_entries(day, score ASC)",
  "CREATE TABLE IF NOT EXISTS daily_likes ( day TEXT NOT NULL, entry_user TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (day, entry_user, user_id) )",
  "CREATE TABLE IF NOT EXISTS reactions ( reading_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (reading_id, user_id, emoji) )",
  "CREATE TABLE IF NOT EXISTS pens ( id TEXT PRIMARY KEY, title TEXT, created_by TEXT NOT NULL, line_count INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS pen_lines ( pen_id TEXT NOT NULL, idx INTEGER NOT NULL, user_id TEXT NOT NULL, handle TEXT, text TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (pen_id, idx) )",
  "CREATE INDEX IF NOT EXISTS pen_lines_user ON pen_lines(user_id)",
  "CREATE TABLE IF NOT EXISTS login_tokens ( token TEXT PRIMARY KEY, email TEXT NOT NULL, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS events ( day TEXT NOT NULL, type TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, type) )"
];

// Column additions for databases created before these existed. Each runs on its own; 'duplicate column' errors are expected and ignored.
export const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN email TEXT",
];
