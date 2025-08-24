-- task-service schema
CREATE TABLE IF NOT EXISTS tasks (
  task_id SERIAL PRIMARY KEY,
  created_by INTEGER NOT NULL, -- 他DB参照のため外部キーは張らない
  task_name VARCHAR(255) NOT NULL,
  task_content TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  category VARCHAR(32) NOT NULL,
  target_time INTEGER NOT NULL,
  comment TEXT NULL,
  last_updated_user INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_plans (
  daily_time_plan_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL,
  target_date DATE NOT NULL,
  work_plan_value INTEGER NOT NULL,
  time_plan_value INTEGER NOT NULL,
  last_updated_user INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
