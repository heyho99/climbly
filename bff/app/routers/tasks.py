from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List, Dict, Any
import httpx

router = APIRouter(tags=["tasks"])

TASK_SVC_BASE = "http://task-service/v1"


def _forward_auth_headers(request: Request) -> dict:
    headers = {}
    auth = request.headers.get("authorization")
    if auth:
        headers["authorization"] = auth
    return headers


@router.get("/tasks")
def list_tasks(request: Request, mine: Optional[bool] = True, category: Optional[str] = None, page: int = 1, per_page: int = 50):
    # v1: task-service への単純委譲（ページングは後続拡張でBFF側対応）
    params = {"mine": mine}
    if category is not None:
        params["category"] = category
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{TASK_SVC_BASE}/tasks", params=params, headers=_forward_auth_headers(request))
        if resp.is_success:
            items = resp.json()
            return {
                "items": items,
                "page": page,
                "per_page": per_page,
                "total": len(items),
            }
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})


@router.get("/tasks/{task_id}")
def get_task(task_id: int, request: Request):
    # v1: task本体 + 日次計画をtask-serviceから取得して返却
    headers = _forward_auth_headers(request)
    try:
        with httpx.Client(timeout=10.0) as client:
            task_resp = client.get(f"{TASK_SVC_BASE}/tasks/{task_id}", headers=headers)
            if not task_resp.is_success:
                raise HTTPException(status_code=task_resp.status_code, detail=task_resp.json())
            plans_resp = client.get(f"{TASK_SVC_BASE}/tasks/{task_id}/daily_plans", headers=headers)
            if not plans_resp.is_success:
                raise HTTPException(status_code=plans_resp.status_code, detail=plans_resp.json())
        return {
            "task": task_resp.json(),
            "daily_plans": plans_resp.json(),
            "records_summary": {},  # v1では未実装（record-service連携は後続）
        }
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})


@router.post("/tasks")
def create_task(payload: dict, request: Request):
    headers = _forward_auth_headers(request)
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(f"{TASK_SVC_BASE}/tasks", json=payload, headers=headers)
        if resp.is_success:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: dict, request: Request):
    headers = _forward_auth_headers(request)
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.patch(f"{TASK_SVC_BASE}/tasks/{task_id}", json=payload, headers=headers)
        if resp.is_success:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, request: Request):
    headers = _forward_auth_headers(request)
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.delete(f"{TASK_SVC_BASE}/tasks/{task_id}", headers=headers)
        if resp.is_success:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})


# 合成API: タスク作成 + 日次計画一括登録（失敗時は補償削除）
@router.post("/tasks_with_plans")
def create_task_with_plans(payload: Dict[str, Any], request: Request):
    """
    入力例:
    {
      "task": { ... TaskIn 相当 ... },
      "daily_plans": { "items": [ {"target_date":"YYYY-MM-DD","work_plan_value":int,"time_plan_value":int}, ... ] }
    }
    """
    headers = _forward_auth_headers(request)
    task_body = payload.get("task")
    plans = payload.get("daily_plans") or {}
    items: List[Dict[str, Any]] = plans.get("items") or []

    if not task_body or not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail={"message": "task and daily_plans.items are required"})

    # 軽量検証: 合計チェック（不整合なら task-service を呼ばない）
    sum_work = sum(int(x.get("work_plan_value", 0)) for x in items)
    sum_time = sum(int(x.get("time_plan_value", 0)) for x in items)
    target_time = int(task_body.get("target_time", 0))
    if sum_work != 100:
        raise HTTPException(status_code=400, detail={"message": "sum(work_plan_value) must be 100"})
    if sum_time != target_time:
        raise HTTPException(status_code=400, detail={"message": "sum(time_plan_value) must equal task.target_time"})

    created_task = None
    try:
        with httpx.Client(timeout=10.0) as client:
            # 1) タスク作成
            task_resp = client.post(f"{TASK_SVC_BASE}/tasks", json=task_body, headers=headers)
            if not task_resp.is_success:
                raise HTTPException(status_code=task_resp.status_code, detail=task_resp.json())
            created_task = task_resp.json()
            task_id = created_task.get("task_id")
            if not task_id:
                # 念のためガード
                raise HTTPException(status_code=502, detail={"message": "invalid response from task-service: missing task_id"})

            # 2) 日次計画一括
            bulk_resp = client.put(
                f"{TASK_SVC_BASE}/tasks/{task_id}/daily_plans/bulk",
                json=items,
                headers=headers,
            )
            if not bulk_resp.is_success:
                # 失敗したら補償として作成タスクを削除
                try:
                    client.delete(f"{TASK_SVC_BASE}/tasks/{task_id}", headers=headers)
                finally:
                    raise HTTPException(status_code=bulk_resp.status_code, detail=bulk_resp.json())

        # 成功
        return {"task": created_task, "daily_plans_count": len(items)}
    except httpx.RequestError as e:
        # task-service自体に到達できない
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})
