from fastapi import APIRouter, HTTPException, Request
from typing import Optional
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
