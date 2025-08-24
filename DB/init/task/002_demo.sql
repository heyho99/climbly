-- demo records for task-service
INSERT INTO tasks (created_by, task_name, task_content, start_at, end_at, category, target_time, comment)
VALUES (1, 'サンプルタスク', '説明', NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 day', 'study', 420, 'デモです')
ON CONFLICT DO NOTHING;

-- 均等配分の例（7日間）
DO $$
DECLARE d integer;
BEGIN
  FOR d IN 0..6 LOOP
    INSERT INTO daily_plans (task_id, created_by, target_date, work_plan_value, time_plan_value)
    VALUES (1, 1, (CURRENT_DATE + d), 100/7, 420/7);
  END LOOP;
END$$;
