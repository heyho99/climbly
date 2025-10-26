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
def list_tasks(request: Request, mine: Optional[bool] = True, category: Optional[str] = None, status: Optional[str] = None, include_daily_plans: Optional[bool] = False, page: int = 1, per_page: int = 50):
    # v1: task-service への単純委譲（ページングは後続拡張でBFF側対応）
    params = {"mine": mine} # 自分のタスクのみ取得（デフォルトで?mine=trueというクエリが来る）
    if category is not None:
        params["category"] = category
    if status is not None:
        params["status"] = status
    try:
        # httpx.Clientやhttpx.getを使って、apiにアクセス
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{TASK_SVC_BASE}/tasks", params=params, headers=_forward_auth_headers(request)) # SVC：serviceのこと
            if not resp.is_success:
                raise HTTPException(status_code=resp.status_code, detail=resp.json())
            
            items = resp.json()
            
            # itemsがリストでない場合は空リストに
            if not isinstance(items, list):
                items = []
            
            # include_daily_plansがTrueの場合、各タスクのdaily_plansを取得
            if include_daily_plans:
                headers = _forward_auth_headers(request)
                for task in items:
                    # taskが辞書であることを確認
                    if not isinstance(task, dict):
                        continue
                    task_id = task.get("task_id")
                    if task_id:
                        try:
                            plans_resp = client.get(f"{TASK_SVC_BASE}/tasks/{task_id}/daily_plans", headers=headers)
                            if plans_resp.is_success:
                                task["daily_plans"] = plans_resp.json()
                            else:
                                task["daily_plans"] = []
                        except Exception as e:
                            print(f"Error fetching daily_plans for task {task_id}: {e}")
                            task["daily_plans"] = []
                    else:
                        task["daily_plans"] = []
            
            return {
                "items": items,
                "page": page,
                "per_page": per_page,
                "total": len(items),
            }
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
    sum_time = sum(int(x.get("time_plan_value", 0)) for x in items)
    target_time = int(task_body.get("target_time", 0))
    
    # work_plan_value は累積値なので、最大値が100であることを確認
    max_work = max(int(x.get("work_plan_value", 0)) for x in items) if items else 0
    if max_work != 100:
        raise HTTPException(status_code=400, detail={"message": "max(work_plan_value) must be 100 (cumulative)"})
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


# 合成API: タスク更新 + 日次計画一括更新（失敗時は補償で元に戻す）
@router.patch("/tasks_with_plans/{task_id}")
def update_task_with_plans(task_id: int, payload: Dict[str, Any], request: Request):
    """
    入力例:
    {
      "task": { ... TaskUpdate 相当（部分更新可） ... },
      "daily_plans": { "items": [ {"target_date":"YYYY-MM-DD","work_plan_value":int,"time_plan_value":int}, ... ] }
    }
    挙動:
      1) 現在のタスクを取得（補償用に保持）
      2) task PATCH（bodyが空ならスキップ）
      3) 日次計画 bulk（upsert+prune）
      4) 3) が失敗したら 2) の更新を補償（元タスクでPATCH）
    """
    headers = _forward_auth_headers(request)
    task_body: Dict[str, Any] = payload.get("task") or {}
    plans = payload.get("daily_plans") or {}
    items: List[Dict[str, Any]] = plans.get("items") or []

    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail={"message": "daily_plans.items is required"})

    try:
        with httpx.Client(timeout=10.0) as client:
            # 1) 現在のタスクを取得
            cur_task_resp = client.get(f"{TASK_SVC_BASE}/tasks/{task_id}", headers=headers)
            if not cur_task_resp.is_success:
                raise HTTPException(status_code=cur_task_resp.status_code, detail=cur_task_resp.json())
            original_task = cur_task_resp.json()

            # 2) タスク更新（task_bodyが空ならスキップ）
            updated_task = original_task
            if task_body:
                patch_resp = client.patch(f"{TASK_SVC_BASE}/tasks/{task_id}", json=task_body, headers=headers)
                if not patch_resp.is_success:
                    raise HTTPException(status_code=patch_resp.status_code, detail=patch_resp.json())
                updated_task = patch_resp.json()

            # 2.5) 軽量検証（合計チェック）。target_time は更新後の値で評価
            try:
                sum_time = sum(int(x.get("time_plan_value", 0)) for x in items)
                tgt_time = int(updated_task.get("target_time", 0))
                
                # work_plan_value は累積値なので、最大値が100であることを確認
                max_work = max(int(x.get("work_plan_value", 0)) for x in items) if items else 0
                if max_work != 100:
                    raise HTTPException(status_code=400, detail={"message": "max(work_plan_value) must be 100 (cumulative)"})
                if sum_time != tgt_time:
                    raise HTTPException(status_code=400, detail={"message": "sum(time_plan_value) must equal task.target_time"})
            except ValueError:
                raise HTTPException(status_code=400, detail={"message": "invalid daily_plans items"})

            # 3) 日次計画bulk（upsert+prune）
            bulk_resp = client.put(
                f"{TASK_SVC_BASE}/tasks/{task_id}/daily_plans/bulk",
                json=items,
                headers=headers,
            )
            if not bulk_resp.is_success:
                # 4) 補償: タスクを元に戻す（best-effort）
                try:
                    revert = {
                        "task_name": original_task.get("task_name"),
                        "task_content": original_task.get("task_content"),
                        "start_at": original_task.get("start_at"),
                        "end_at": original_task.get("end_at"),
                        "category": original_task.get("category"),
                        "target_time": original_task.get("target_time"),
                        "comment": original_task.get("comment"),
                    }
                    client.patch(f"{TASK_SVC_BASE}/tasks/{task_id}", json=revert, headers=headers)
                finally:
                    raise HTTPException(status_code=bulk_resp.status_code, detail=bulk_resp.json())

        # 成功
        return {"task": updated_task, "daily_plans_count": len(items)}
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "task-service unavailable", "error": str(e)})
