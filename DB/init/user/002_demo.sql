-- demo records for user-service
INSERT INTO users (username, password, email) 
VALUES
  ('dev', '$2b$12$pkJRenUDb0JPPKBcuz1Aw.oklsMGKF43GRq8ZNH6oR7P1KE1BDXTG', 'dev@climbly.com')
ON CONFLICT DO NOTHING;

-- task_auths のデモレコード（user_id=1, task_id=1 を admin 権限に）
INSERT INTO task_auths (task_id, user_id, task_user_auth)
VALUES (1, 1, 'admin')
ON CONFLICT DO NOTHING;
