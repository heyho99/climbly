-- demo records for record-service
INSERT INTO record_works (task_id, created_by, start_at, end_at, progress_value, work_time, note)
VALUES (1, 1, NOW() - INTERVAL '2 hour', NOW() - INTERVAL '1 hour', 10, 60, 'デモ作業')
ON CONFLICT DO NOTHING;
