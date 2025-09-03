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
    """タスク別実績一覧をrecord-serviceから取得"""
    params = {}
    if task_id is not None:
        params["task_id"] = task_id
    if from_ is not None:
        params["from"] = from_
    if to is not None:
        params["to"] = to

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{RECORD_SVC_BASE}/records/by_task",
                params=params,
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
            
            # BFF用に形式を変換
            records = response.json()
            items = [
                {
                    "record_work_id": r["record_work_id"],
                    "task_id": r["task_id"],
                    "task_title": f"Task #{r['task_id']}",  # 簡易版、本来はtask-serviceから取得
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
