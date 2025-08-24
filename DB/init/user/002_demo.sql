-- demo records for user-service
INSERT INTO users (username, password, email) 
VALUES
  ('dev', 'dev', 'dev@climbly.com')
ON CONFLICT DO NOTHING;

-- task_auths のデモレコード（user_id=1, task_id=1 を admin 権限に）
INSERT INTO task_auths (task_id, user_id, task_user_auth)
VALUES (1, 1, 'admin')
ON CONFLICT DO NOTHING;
