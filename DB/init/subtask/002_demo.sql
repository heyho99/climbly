-- demo records for subtask-service
INSERT INTO subtasks (task_id, created_by, subtask_name, subtask_content, status)
VALUES (1, 1, 'デモサブタスク', '説明', 'to Do')
ON CONFLICT DO NOTHING;
