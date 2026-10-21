-- schema.sql v1 — D1（06 §2.3、schema_v1）。全部 IF NOT EXISTS，可重跑。
-- 遷移：09 寫 PRAGMA user_version，但 D1 拒絕（實測 SQLITE_AUTH）→ 往後改加 migrations/000N_*.sql（wrangler d1 migrations）。
-- 資料最小化：不存 email、不存 IP、不存原始座標（checkins 只有地標與距離）。

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,                 -- UUID v4
  google_sub  TEXT UNIQUE,                      -- 綁定 Google 後才有（Sprint 2）
  share_token TEXT UNIQUE,                      -- opt-in 分享（Sprint 3）
  merged_into TEXT,                             -- device 帳併入 Google 帳後指向對方
  created_at  TEXT NOT NULL,                    -- ISO-8601 UTC
  last_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grants (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('house','part','shard','decor')),
  item_id     TEXT NOT NULL,                    -- 'sys:minnan'
  state       TEXT NOT NULL CHECK (state IN ('stock','placed','dismantled')),
  seed        INTEGER NOT NULL DEFAULT 0,
  landmark_id TEXT,
  visit_n     INTEGER NOT NULL DEFAULT 1,
  mood        INTEGER CHECK (mood IS NULL OR mood BETWEEN 0 AND 4),
  note        TEXT CHECK (note IS NULL OR length(note) <= 40),
  at          TEXT NOT NULL,                    -- 伺服器時間
  op_id       TEXT UNIQUE,                      -- 客端產；重送回同一結果
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_grants_user ON grants (user_id, state);

CREATE TABLE IF NOT EXISTS checkins (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  landmark_id TEXT NOT NULL,                    -- 'daily' = 每日簽到
  day         TEXT NOT NULL,                    -- 台北時間 −4 h 的日期
  grant_id    TEXT NOT NULL,
  dist_m      INTEGER,
  at          TEXT NOT NULL,
  UNIQUE (user_id, landmark_id, day)
);
CREATE INDEX IF NOT EXISTS idx_checkins_user_day ON checkins (user_id, day);

CREATE TABLE IF NOT EXISTS towns (
  id          TEXT PRIMARY KEY,                 -- 獨立 id，預留第二座鎮
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grid_json   TEXT NOT NULL CHECK (length(grid_json) <= 32768),
  rev         INTEGER NOT NULL DEFAULT 0,
  last_op     TEXT,                             -- 最近一次 PUT 的 op_id（重送去重）
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_towns_user ON towns (user_id);

-- Google 綁定後的 session（Sprint 2）；只存 SHA-256(token)
CREATE TABLE IF NOT EXISTS sessions (
  id_hash     TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- D1 計數限速：key = '<路由>:<user 或 IP 雜湊>'，win = 分鐘
CREATE TABLE IF NOT EXISTS rate (
  key TEXT NOT NULL,
  win INTEGER NOT NULL,
  n   INTEGER NOT NULL,
  PRIMARY KEY (key, win)
);
