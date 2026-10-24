CREATE TABLE IF NOT EXISTS subs (
  endpoint TEXT PRIMARY KEY,
  tz TEXT NOT NULL,
  times TEXT NOT NULL,
  skip_date TEXT,
  skip_times TEXT,
  updated INTEGER NOT NULL
);
