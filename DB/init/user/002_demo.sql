-- demo records for user-service
INSERT INTO users (username, password, email) 
VALUES
  ('dev', 'dev', 'dev@climbly.com')
ON CONFLICT DO NOTHING;
