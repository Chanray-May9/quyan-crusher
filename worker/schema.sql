-- 蛆言现场 · 投稿墙

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  text        TEXT    NOT NULL,
  scene       TEXT,
  likes       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  ip_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_likes   ON posts(likes DESC, created_at DESC);

-- 纯防刷用。不记录内容，只记录一个不可逆的哈希和时间。
CREATE TABLE IF NOT EXISTS rate (
  ip_hash  TEXT PRIMARY KEY,
  last_at  INTEGER NOT NULL,
  day      INTEGER NOT NULL,
  day_cnt  INTEGER NOT NULL DEFAULT 0
);
