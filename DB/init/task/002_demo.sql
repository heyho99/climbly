-- demo records for task-service
INSERT INTO tasks (created_by, task_name, task_content, start_at, end_at, category, target_time, comment)
VALUES (1, 'サンプルタスク', '説明', NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 day', 'study', 420, 'デモです')
ON CONFLICT DO NOTHING;
