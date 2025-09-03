from fastapi import APIRouter
from typing import Optional

router = APIRouter(tags=["records"])


@router.get("/records/by_task")
def list_records_by_task(task_id: Optional[int] = None, from_: Optional[str] = None, to: Optional[str] = None):
    # TODO: record-serviceへ委譲
    # ダミー: タスク別に実績をネストして返却
    tasks = [
        {
            "task_id": 1,
            "task_title": "API設計",
            "assignees": ["taro", "hana"],
            "records": [
                {
                    "record_work_id": 101,
                    "start_at": "2025-09-01T09:00:00+09:00",
                    "end_at": "2025-09-01T10:30:00+09:00",
                    "work_time": 90,
                    "progress_value": 8,
                    "created_by": 11,
                    "note": "エンドポイント整理とバリデーション方針作成",
                },
                {
                    "record_work_id": 102,
                    "start_at": "2025-09-02T18:00:00+09:00",
                    "end_at": "2025-09-02T18:45:00+09:00",
                    "work_time": 45,
                    "progress_value": 3,
                    "created_by": 12,
                    "note": "エラーレスポンスの統一案作成",
                },
                {
                    "record_work_id": 103,
                    "start_at": "2025-09-02T20:00:00+09:00",
                    "end_at": "2025-09-02T21:00:00+09:00",
                    "work_time": 60,
                    "progress_value": 5,
                    "created_by": 11,
                    "note": "OpenAPIの共通エラーフォーマット草案",
                },
            ],
        },
        {
            "task_id": 2,
            "task_title": "フロントUI",
            "assignees": ["ken"],
            "records": [
                {
                    "record_work_id": 201,
                    "start_at": "2025-09-01T13:00:00+09:00",
                    "end_at": "2025-09-01T14:00:00+09:00",
                    "work_time": 60,
                    "progress_value": 5,
                    "created_by": 13,
                    "note": "カードレイアウトとドラッグの検証",
                },
                {
                    "record_work_id": 202,
                    "start_at": "2025-09-02T10:15:00+09:00",
                    "end_at": "2025-09-02T11:00:00+09:00",
                    "work_time": 45,
                    "progress_value": 4,
                    "created_by": 13,
                    "note": "ボードのスタイル調整（余白と配色）",
                }
            ],
        },
        {
            "task_id": 3,
            "task_title": "DB調整",
            "assignees": ["saki"],
            "records": [],
        },
        {
            "task_id": 4,
            "task_title": "通知機能",
            "assignees": ["yui", "taro"],
            "records": [
                {
                    "record_work_id": 401,
                    "start_at": "2025-09-01T08:30:00+09:00",
                    "end_at": "2025-09-01T09:00:00+09:00",
                    "work_time": 30,
                    "progress_value": 2,
                    "created_by": 14,
                    "note": "メール送信の検証（開発環境）",
                }
            ],
        },
    ]

    if task_id is not None:
        tasks = [t for t in tasks if t["task_id"] == task_id]

    total_records = sum(len(t.get("records", [])) for t in tasks)
    return {
        "from": from_,
        "to": to,
        "tasks": tasks,
        "total_tasks": len(tasks),
        "total_records": total_records,
    }


@router.get("/records/diary")
def list_records_diary(page: int = 1, per_page: int = 50, from_: Optional[str] = None, to: Optional[str] = None):
    # TODO: record-serviceへ委譲
    # ダミー: 時系列のフラットな実績配列
    items = [
        {
            "record_work_id": 301,
            "task_id": 1,
            "task_title": "API設計",
            "start_at": "2025-09-02T19:00:00+09:00",
            "end_at": "2025-09-02T19:45:00+09:00",
            "work_time": 45,
            "progress_value": 3,
            "note": "エラーハンドリングの設計見直し",
        },
        {
            "record_work_id": 201,
            "task_id": 2,
            "task_title": "フロントUI",
            "start_at": "2025-09-01T13:00:00+09:00",
            "end_at": "2025-09-01T14:00:00+09:00",
            "work_time": 60,
            "progress_value": 5,
            "note": "カードの並び替え試作",
        },
        {
            "record_work_id": 101,
            "task_id": 1,
            "task_title": "API設計",
            "start_at": "2025-09-01T09:00:00+09:00",
            "end_at": "2025-09-01T10:30:00+09:00",
            "work_time": 90,
            "progress_value": 8,
            "note": "仕様のドラフト共有",
        },
    ]

    return {
        "from": from_,
        "to": to,
        "items": items[(page - 1) * per_page : page * per_page],
        "page": page,
        "per_page": per_page,
        "total": len(items),
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
