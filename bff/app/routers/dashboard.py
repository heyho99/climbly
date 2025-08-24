from fastapi import APIRouter

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary")
def summary():
    # TODO: record-service などから集計
    return {
        "active_tasks": 3,
        "completed_tasks_total": 12,
        "completed_tasks_this_month": 2,
        "work_time_this_month": 540,  # minutes
        "work_time_total": 4320,
    }


@router.get("/dashboard/lagging_tasks")
def lagging_tasks():
    # TODO: task-service + daily_plans + record_works から遅れ計算
    return [
        {"task_id": 10, "task_name": "英語学習", "lag_reason": "progress behind plan"},
        {"task_id": 22, "task_name": "ブログ執筆", "lag_reason": "work time behind plan"},
    ]
