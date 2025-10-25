import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

# record-service URL (既存パターンに合わせてハードコード)
RECORD_SVC_BASE = "http://record-service/v1"

auth_scheme = HTTPBearer(auto_error=False)
router = APIRouter(tags=["records"])


async def get_auth_header(creds: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> dict:
    """認証ヘッダーを取得"""
    if not creds:
        raise HTTPException(status_code=401, detail={"message": "missing bearer token"})
    return {"Authorization": f"Bearer {creds.credentials}"}


@router.get("/records/by_task")
async def list_records_by_task(
    task_id: Optional[int] = None,
    from_: Optional[str] = None,
    to: Optional[str] = None,
    auth_header: dict = Depends(get_auth_header),
):
    """タスク別実績一覧をrecord-serviceから取得し、全タスクとマージ"""
    try:
        async with httpx.AsyncClient() as client:
            # 1. 全タスクを取得
            tasks_response = await client.get(
                "http://task-service/v1/tasks",
                params={"mine": "true"},
                headers=auth_header,
                timeout=30.0
            )
            if tasks_response.status_code != 200:
                raise HTTPException(
                    status_code=tasks_response.status_code,
                    detail={"message": "task service error"}
                )
            all_tasks = tasks_response.json()
            
            # 2. 実績データを取得
            params = {}
            if task_id is not None:
                params["task_id"] = task_id
            if from_ is not None:
                params["from"] = from_
            if to is not None:
                params["to"] = to
                
            records_response = await client.get(
                f"{RECORD_SVC_BASE}/records/by_task",
                params=params,
                headers=auth_header,
                timeout=30.0
            )
            
            # 実績データの取得に失敗した場合は空の実績として扱う
            if records_response.status_code == 200:
                records_data = records_response.json()
                tasks_with_records = {t["task_id"]: t for t in records_data.get("tasks", [])}
            else:
                tasks_with_records = {}
            
            # 3. 全タスクと実績をマージ
            merged_tasks = []
            for task in all_tasks:
                current_task_id = task["task_id"]
                
                # task_idでフィルタリング（指定されている場合）
                if task_id is not None and task_id != current_task_id:
                    continue
                    
                if current_task_id in tasks_with_records:
                    # 実績があるタスク
                    task_with_records = tasks_with_records[current_task_id]
                    merged_tasks.append({
                        "task_id": task["task_id"],
                        "task_title": task["task_name"],
                        "assignees": [],
                        "records": task_with_records["records"]
                    })
                else:
                    # 実績がないタスク
                    merged_tasks.append({
                        "task_id": task["task_id"],
                        "task_title": task["task_name"],
                        "assignees": [],
                        "records": []
                    })
            
            total_records = sum(len(t["records"]) for t in merged_tasks)
            
            return {
                "from": from_,
                "to": to,
                "tasks": merged_tasks,
                "total_tasks": len(merged_tasks),
                "total_records": total_records,
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail={"message": "service unavailable", "error": str(e)})


@router.get("/records/diary")
async def list_records_diary(
    page: int = 1,
    per_page: int = 50,
    from_: Optional[str] = None,
    to: Optional[str] = None,
    auth_header: dict = Depends(get_auth_header),
):
    """時系列実績一覧をrecord-serviceから取得"""
    params = {
        "page": page,
        "per_page": per_page,
    }
    if from_ is not None:
        params["from"] = from_
    if to is not None:
        params["to"] = to

    try:
        async with httpx.AsyncClient() as client:
            # 1. 実績データを取得
            response = await client.get(
                f"{RECORD_SVC_BASE}/records",
                params=params,
                headers=auth_header,
                timeout=30.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json() if response.headers.get("content-type") == "application/json" else {"message": "record service error"}
                )
            
            records = response.json()
            
            # 2. 全タスクを取得してタスク名をマッピング
            tasks_response = await client.get(
                "http://task-service/v1/tasks",
                params={"mine": "true"},
                headers=auth_header,
                timeout=30.0
            )
            
            task_name_map = {}
            if tasks_response.status_code == 200:
                all_tasks = tasks_response.json()
                task_name_map = {t["task_id"]: t["task_name"] for t in all_tasks}
            
            # 3. BFF用に形式を変換（タスク名をマージ）
            items = [
                {
                    "record_work_id": r["record_work_id"],
                    "task_id": r["task_id"],
                    "task_title": task_name_map.get(r["task_id"]),
                    "start_at": r["start_at"],
                    "end_at": r["end_at"],
                    "work_time": r["work_time"],
                    "progress_value": r["progress_value"],
                    "note": r["note"],
                }
                for r in records
            ]
            
            return {
                "from": from_,
                "to": to,
                "items": items,
                "page": page,
                "per_page": per_page,
                "total": len(items),  # 簡易版、本来はtotal countを取得
            }
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail={"message": "record service unavailable", "error": str(e)})


@router.get("/records/{record_work_id}")
async def get_record(record_work_id: int, auth_header: dict = Depends(get_auth_header)):
    """単一実績をrecord-serviceから取得"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{RECORD_SVC_BASE}/records/{record_work_id}",
                headers=auth_header,
                timeout=30.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json() if response.headers.get("content-type") == "application/json" else {"message": "record service error"}
                )
            return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail={"message": "record service unavailable", "error": str(e)})


@router.post("/records")
async def create_record(payload: dict, auth_header: dict = Depends(get_auth_header)):
    """実績作成をrecord-serviceに委譲"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{RECORD_SVC_BASE}/records",
                json=payload,
                headers=auth_header,
                timeout=30.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json() if response.headers.get("content-type") == "application/json" else {"message": "record service error"}
                )
            return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail={"message": "record service unavailable", "error": str(e)})


@router.patch("/records/{record_work_id}")
async def update_record(record_work_id: int, payload: dict, auth_header: dict = Depends(get_auth_header)):
    """実績更新をrecord-serviceに委譲"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{RECORD_SVC_BASE}/records/{record_work_id}",
                json=payload,
                headers=auth_header,
                timeout=30.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json() if response.headers.get("content-type") == "application/json" else {"message": "record service error"}
                )
            return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail={"message": "record service unavailable", "error": str(e)})


@router.delete("/records/{record_work_id}")
async def delete_record(record_work_id: int, auth_header: dict = Depends(get_auth_header)):
    """実績削除をrecord-serviceに委譲"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{RECORD_SVC_BASE}/records/{record_work_id}",
                headers=auth_header,
                timeout=30.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json() if response.headers.get("content-type") == "application/json" else {"message": "record service error"}
                )
            return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail={"message": "record service unavailable", "error": str(e)})
