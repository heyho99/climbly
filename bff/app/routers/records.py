from fastapi import APIRouter
from typing import Optional

router = APIRouter(tags=["records"])


@router.get("/records")
def list_records(mode: Optional[str] = None, task_id: Optional[int] = None, page: int = 1, per_page: int = 50, from_: Optional[str] = None, to: Optional[str] = None):
    # TODO: record-serviceへ委譲
    return {
        "items": [
            {"record_work_id": 1, "task_id": 1, "work_time": 60, "progress_value": 5},
            {"record_work_id": 2, "task_id": 2, "work_time": 30, "progress_value": 3},
        ],
        "page": page,
        "per_page": per_page,
        "total": 2,
    }


@router.post("/records")
def create_record(payload: dict):
    return {"record_work_id": 1000, **payload}


@router.patch("/records/{record_work_id}")
def update_record(record_work_id: int, payload: dict):
    return {"record_work_id": record_work_id, **payload}


@router.delete("/records/{record_work_id}")
def delete_record(record_work_id: int):
    return {"ok": True}
