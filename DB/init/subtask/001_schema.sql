-- subtask-service schema
CREATE TABLE IF NOT EXISTS subtasks (
  subtask_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL, -- 他DB参照のため外部キーは張らない
  created_by INTEGER NOT NULL,
  subtask_name VARCHAR(255) NOT NULL,
  subtask_content TEXT NULL,
  status VARCHAR(16) NOT NULL,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  comment TEXT NULL,
  last_updated_user INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
