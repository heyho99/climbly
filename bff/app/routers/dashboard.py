import asyncio
import httpx
from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(tags=["dashboard"])
auth_scheme = HTTPBearer(auto_error=False)


async def get_auth_header(creds: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> dict:
    """認証ヘッダーを取得"""
    if not creds:
        return {}
    return {"Authorization": f"Bearer {creds.credentials}"}


@router.get("/dashboard/summary")
async def summary(auth_header: dict = Depends(get_auth_header)):
    """ダッシュボードサマリを取得"""
    active_tasks = 0
    completed_tasks_total = 0
    
    # task-serviceから進行中タスクと完了タスクを並列取得
    try:
        async with httpx.AsyncClient() as client:
            # 並列実行で高速化
            results = await asyncio.gather(
                client.get(
                    "http://task-service/v1/tasks",
                    params={"mine": "true", "status": "active"},
                    headers=auth_header,
                    timeout=10.0
                ),
                client.get(
                    "http://task-service/v1/tasks",
                    params={"mine": "true", "status": "completed"},
                    headers=auth_header,
                    timeout=10.0
                ),
                return_exceptions=True  # エラーでも継続
            )
            
            # 進行中タスク数
            active_response = results[0]
            if not isinstance(active_response, Exception) and active_response.status_code == 200:
                active_tasks = len(active_response.json())
            
            # 完了タスク数（累計）
            completed_response = results[1]
            if not isinstance(completed_response, Exception) and completed_response.status_code == 200:
                completed_tasks_total = len(completed_response.json())
                
    except Exception:
        # 予期しないエラーの場合は0を返す
        pass
    
    return {
        "active_tasks": active_tasks,
        "completed_tasks_total": completed_tasks_total,
        "completed_tasks_this_month": 2,  # TODO: 後で実装
        "work_time_this_month": 540,  # minutes, TODO: 後で実装
        "work_time_total": 4320,  # TODO: 後で実装
    }


@router.get("/dashboard/lagging_tasks")
def lagging_tasks():
    # TODO: task-service + daily_plans + record_works から遅れ計算
    return [
        {"task_id": 10, "task_name": "英語学習", "progress_gap": "progress behind plan", "time_gap": 60},
        {"task_id": 22, "task_name": "ブログ執筆", "progress_gap": "work time behind plan", "time_gap": 120},
    ]
