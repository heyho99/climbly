from fastapi import APIRouter
from typing import Optional

router = APIRouter(tags=["tasks"])


@router.get("/tasks")
def list_tasks(mine: Optional[bool] = True, category: Optional[str] = None, page: int = 1, per_page: int = 50):
    # TODO: task-serviceへ委譲 + グラフ用データ付与
    return {
        "items": [
            {"task_id": 1, "task_name": "読書", "category": "study"},
            {"task_id": 2, "task_name": "アウトライン作成", "category": "creation"},
        ],
        "page": page,
        "per_page": per_page,
        "total": 2,
    }


@router.get("/tasks/{task_id}")
def get_task(task_id: int):
    # TODO: task-service + daily_plans + record summary
    return {
        "task": {"task_id": task_id, "task_name": "読書", "target_time": 600},
        "daily_plans": [],
        "records_summary": {},
    }


@router.post("/tasks")
def create_task(payload: dict):
    # TODO: task作成 → daily_plans作成
    return {"task_id": 100, **payload}


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: dict):
    return {"task_id": task_id, **payload}


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    return {"ok": True}
