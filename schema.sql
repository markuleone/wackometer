-- Wackometer database (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',   -- free | pro
  pro_until     INTEGER,                         -- ms timestamp, null = not pro
  credits       INTEGER NOT NULL DEFAULT 0,
  stripe_customer TEXT,
  handle        TEXT,                            -- public display name for leaderboards
  streak        INTEGER NOT NULL DEFAULT 0,
  last_daily    TEXT,                            -- YYYY-MM-DD of last Daily W entry
  email         TEXT,                            -- set once they sign in by email
  username      TEXT,                            -- public @handle, unique
  display_name  TEXT,
  bio           TEXT,
  avatar        INTEGER,                         -- crew member 0-5
  color         TEXT,                            -- profile banner color
  genre         TEXT,
  links         TEXT,                            -- JSON of music/social links
  pinned        TEXT,                            -- signature line
  age_ok        INTEGER,                         -- confirmed 13 or older
  human_until   INTEGER,                         -- passed the bot check until (ms)
  notify        INTEGER NOT NULL DEFAULT 1       -- email notifications on/off
);

CREATE TABLE IF NOT EXISTS readings (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT,
  excerpt     TEXT NOT NULL,
  raw         INTEGER NOT NULL,
  score       INTEGER NOT NULL,
  tier        INTEGER NOT NULL,
  metrics     TEXT NOT NULL,                     -- JSON
  vote_count  INTEGER NOT NULL DEFAULT 0,
  reports     INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS readings_new ON readings(hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS readings_top ON readings(hidden, vote_count DESC);

CREATE TABLE IF NOT EXISTS votes (
  reading_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  tier        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (reading_id, user_id)
);
CREATE INDEX IF NOT EXISTS votes_reading ON votes(reading_id);

CREATE TABLE IF NOT EXISTS reports (
  reading_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (reading_id, user_id)
);

CREATE TABLE IF NOT EXISTS usage (
  user_id  TEXT NOT NULL,
  day      TEXT NOT NULL,
  wingman  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS daily_entries (
  day         TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  lines       TEXT NOT NULL,
  score       INTEGER NOT NULL,
  tier        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (day, user_id)
);
CREATE INDEX IF NOT EXISTS daily_board ON daily_entries(day, score ASC);

-- crowd "fire" votes on Daily W entries
CREATE TABLE IF NOT EXISTS daily_likes (
  day         TEXT NOT NULL,
  entry_user  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  PRIMARY KEY (day, entry_user, user_id)
);

-- emoji reactions on Wall posts
CREATE TABLE IF NOT EXISTS reactions (
  reading_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  PRIMARY KEY (reading_id, user_id, emoji)
);

-- Pass the Pen: songs written one line at a time by different people
CREATE TABLE IF NOT EXISTS pens (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  created_by  TEXT NOT NULL,
  line_count  INTEGER NOT NULL DEFAULT 0,
  closed      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pen_lines (
  pen_id      TEXT NOT NULL,
  idx         INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  handle      TEXT,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (pen_id, idx)
);
CREATE INDEX IF NOT EXISTS pen_lines_user ON pen_lines(user_id);

-- email sign-in links
CREATE TABLE IF NOT EXISTS login_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  code        TEXT,              -- 6-digit code sent with the link
  tries       INTEGER NOT NULL DEFAULT 0
);

-- simple daily counters for what people do (shares, saves, swaps)
CREATE TABLE IF NOT EXISTS events (
  day    TEXT NOT NULL,
  type   TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type)
);

-- friends: one row per pair, a < b alphabetically
CREATE TABLE IF NOT EXISTS friends (
  a             TEXT NOT NULL,
  b             TEXT NOT NULL,
  requested_by  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS friends_b ON friends(b);

-- head-to-head battles between friends
CREATE TABLE IF NOT EXISTS battles (
  id          TEXT PRIMARY KEY,
  emoji       TEXT,
  prompt      TEXT NOT NULL,
  challenger  TEXT NOT NULL,
  opponent    TEXT NOT NULL,
  c_lines     TEXT,
  o_lines     TEXT,
  c_score     INTEGER,
  o_score     INTEGER,
  status      TEXT NOT NULL DEFAULT 'open',   -- open | done | declined
  created_at  INTEGER NOT NULL,
  done_at     INTEGER
);
CREATE INDEX IF NOT EXISTS battles_c ON battles(challenger);
CREATE INDEX IF NOT EXISTS battles_o ON battles(opponent);

-- site settings (e.g. an auto-generated cookie signing key when SESSION_SECRET isn't set)
CREATE TABLE IF NOT EXISTS settings (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL
);

-- people you've blocked (they can't friend you or battle you)
CREATE TABLE IF NOT EXISTS blocks (
  blocker     TEXT NOT NULL,
  blocked     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (blocker, blocked)
);

-- reports on profiles (offensive name, bio, impersonation)
CREATE TABLE IF NOT EXISTS profile_reports (
  target      TEXT NOT NULL,
  reporter    TEXT NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (target, reporter)
);

-- keeps notification emails from piling up (one per key per window)
CREATE TABLE IF NOT EXISTS notify_log (
  k   TEXT PRIMARY KEY,
  at  INTEGER NOT NULL
);

-- DAW plugin waitlist (Pro perk, not built yet)
CREATE TABLE IF NOT EXISTS waitlist (
  email      TEXT PRIMARY KEY,
  daw        TEXT,
  user_id    TEXT,
  created_at INTEGER NOT NULL
);

-- lyric reviews of released songs and albums (written by admins)
CREATE TABLE IF NOT EXISTS reviews (
  slug         TEXT PRIMARY KEY,
  kind         TEXT NOT NULL DEFAULT 'song',   -- song | album
  artist       TEXT NOT NULL,
  title        TEXT NOT NULL,
  genre        TEXT,
  released     TEXT,                            -- free text, e.g. 2026 or Oct 2026
  score        INTEGER NOT NULL,                -- 0-100 on the meter (0 = Wicked, 100 = Wack)
  verdict      TEXT NOT NULL,                   -- one-line take
  body         TEXT,                            -- the review (blank line = new paragraph, "> " = quote)
  best_line    TEXT,                            -- one short lyric quote
  standouts    TEXT,                            -- album: standout tracks, comma separated
  cover_url    TEXT,
  spotify_url  TEXT,
  youtube_url  TEXT,
  apple_url    TEXT,
  artist_url   TEXT,
  artist_ig    TEXT,
  reviewer     TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',   -- draft | live
  featured     INTEGER NOT NULL DEFAULT 0,      -- 1 = in the front-page hero
  submitted    INTEGER NOT NULL DEFAULT 0,      -- 1 = the artist paid to submit it (noted on the page)
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS reviews_live ON reviews(status, published_at DESC);

-- crowd score: one tier vote (0 Wicked .. 4 Wack) per person per review
CREATE TABLE IF NOT EXISTS review_votes (
  slug        TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  tier        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (slug, user_id)
);

-- artists asking to be reviewed
CREATE TABLE IF NOT EXISTS review_requests (
  id          TEXT PRIMARY KEY,
  artist      TEXT NOT NULL,
  title       TEXT,
  link        TEXT NOT NULL,
  email       TEXT,
  note        TEXT,
  user_id     TEXT,
  status      TEXT NOT NULL DEFAULT 'new',     -- pending (not paid yet) | new | done
  paid        INTEGER NOT NULL DEFAULT 0,      -- 1 = paid the submission fee
  amount      INTEGER,                         -- cents paid
  stripe_session TEXT,
  created_at  INTEGER NOT NULL
);

-- critics: the people who write reviews; artists can pick one when they submit
CREATE TABLE IF NOT EXISTS critics (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT,                            -- one line, e.g. "Producer, Miami"
  bio         TEXT,
  photo_url   TEXT,
  genres      TEXT,                            -- comma separated
  ig          TEXT,
  link        TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
-- review_requests.critic: slug of the critic the artist picked (migration)

-- people applying to review for Wackometer
CREATE TABLE IF NOT EXISTS critic_applications (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  link        TEXT,
  genres      TEXT,
  why         TEXT,
  user_id     TEXT,
  status      TEXT NOT NULL DEFAULT 'new',     -- new | accepted | passed
  created_at  INTEGER NOT NULL
);
