-- user-service schema
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_auths (
  task_auth_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL, -- 他DB参照のため外部キーは張らない
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  task_user_auth VARCHAR(16) NOT NULL, -- read/write/admin
  last_updated_user INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
