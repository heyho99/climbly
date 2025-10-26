import asyncio
import httpx
from datetime import datetime
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
    completed_tasks_this_month = 0
    work_time_this_month = 0
    work_time_total = 0
    
    # 今月の開始日を計算
    now = datetime.now()
    current_month_start = datetime(now.year, now.month, 1)
    month_start_str = f"{now.year}-{now.month:02d}-01"
    
    # 各サービスから並列取得
    try:
        async with httpx.AsyncClient() as client:
            # 並列実行で高速化
            results = await asyncio.gather(
                # タスク: 進行中
                client.get(
                    "http://task-service/v1/tasks",
                    params={"mine": "true", "status": "active"},
                    headers=auth_header,
                    timeout=10.0
                ),
                # タスク: 完了（累計）
                client.get(
                    "http://task-service/v1/tasks",
                    params={"mine": "true", "status": "completed"},
                    headers=auth_header,
                    timeout=10.0
                ),
                # 作業時間: 今月
                client.get(
                    "http://record-service/v1/metrics/work_time/summary",
                    params={"from": month_start_str},
                    headers=auth_header,
                    timeout=10.0
                ),
                # 作業時間: 累計
                client.get(
                    "http://record-service/v1/metrics/work_time/summary",
                    headers=auth_header,
                    timeout=10.0
                ),
                return_exceptions=True  # エラーでも継続
            )
            
            # 進行中タスク数
            active_response = results[0]
            if not isinstance(active_response, Exception) and active_response.status_code == 200:
                active_tasks = len(active_response.json())
            
            # 完了タスク数（累計・今月）
            completed_response = results[1]
            if not isinstance(completed_response, Exception) and completed_response.status_code == 200:
                completed_tasks = completed_response.json()
                completed_tasks_total = len(completed_tasks)
                
                # 今月完了数を計算
                for task in completed_tasks:
                    updated_at_str = task.get("updated_at")
                    if updated_at_str:
                        try:
                            # ISO 8601形式をパース（"2025-10-26T10:30:00" or "2025-10-26T10:30:00Z"）
                            # タイムゾーン情報を削除してnaiveなdatetimeとして比較
                            updated_at = datetime.fromisoformat(updated_at_str.replace("Z", "").split("+")[0])
                            if updated_at >= current_month_start:
                                completed_tasks_this_month += 1
                        except (ValueError, AttributeError):
                            # パースエラーは無視
                            pass
            
            # 今月作業時間
            work_time_this_month_response = results[2]
            if not isinstance(work_time_this_month_response, Exception) and work_time_this_month_response.status_code == 200:
                work_time_this_month = work_time_this_month_response.json().get("total_work_time", 0)
            
            # 累計作業時間
            work_time_total_response = results[3]
            if not isinstance(work_time_total_response, Exception) and work_time_total_response.status_code == 200:
                work_time_total = work_time_total_response.json().get("total_work_time", 0)
                
    except Exception:
        # 予期しないエラーの場合は0を返す
        pass
    
    return {
        "active_tasks": active_tasks,
        "completed_tasks_total": completed_tasks_total,
        "completed_tasks_this_month": completed_tasks_this_month,
        "work_time_this_month": work_time_this_month,
        "work_time_total": work_time_total,
    }


@router.get("/dashboard/lagging_tasks")
def lagging_tasks():
    # TODO: task-service + daily_plans + record_works から遅れ計算
    return [
        {"task_id": 10, "task_name": "英語学習", "progress_gap": "progress behind plan", "time_gap": 60},
        {"task_id": 22, "task_name": "ブログ執筆", "progress_gap": "work time behind plan", "time_gap": 120},
    ]
