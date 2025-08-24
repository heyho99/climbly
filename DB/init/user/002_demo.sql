-- demo records for user-service
INSERT INTO users (username, password, email) VALUES
  ('alice', '$2b$10$hashhashhash', 'alice@example.com'),
  ('bob', '$2b$10$hashhashhash', 'bob@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO task_auths (task_id, user_id, task_user_auth)
SELECT 1, user_id, 'admin' FROM users WHERE username='alice'
ON CONFLICT DO NOTHING;
