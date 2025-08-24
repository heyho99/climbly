-- record-service schema
CREATE TABLE IF NOT EXISTS record_works (
  record_work_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL, -- 他DB参照のため外部キーは張らない
  created_by INTEGER NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  progress_value INTEGER NOT NULL,
  work_time INTEGER NOT NULL,
  note TEXT NULL,
  last_updated_user INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
