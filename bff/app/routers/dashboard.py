import asyncio
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, Query
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
    
    # 遅延タスク数を取得
    lagging_tasks_count = 0
    try:
        # lagging_tasksエンドポイントから遅延数を取得
        lagging_data = await lagging_tasks(auth_header)
        lagging_tasks_count = len(lagging_data) if lagging_data else 0
    except Exception:
        pass
    
    return {
        "active_tasks": active_tasks,
        "completed_tasks_total": completed_tasks_total,
        "completed_tasks_this_month": completed_tasks_this_month,
        "work_time_this_month": work_time_this_month,
        "work_time_total": work_time_total,
        "lagging_tasks_count": lagging_tasks_count,
    }


@router.get("/dashboard/lagging_tasks")
async def lagging_tasks(auth_header: dict = Depends(get_auth_header)):
    """遅延タスクを取得"""
    lagging = []
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. 進行中タスクを取得
            tasks_response = await client.get(
                "http://task-service/v1/tasks",
                params={"mine": "true", "status": "active"},
                headers=auth_header,
                timeout=10.0
            )
            
            if tasks_response.status_code != 200:
                return []
            
            tasks = tasks_response.json()
            
            # 2. 各タスクの遅延を並列で計算
            async def check_task_lag(task):
                task_id = task["task_id"]
                task_name = task.get("task_name", "")
                
                # 計画進捗と実績進捗を並列取得
                plan_response, record_response = await asyncio.gather(
                    client.get(
                        "http://task-service/v1/daily_plans/latest_progress",
                        params={"task_id": task_id},
                        headers=auth_header,
                        timeout=10.0
                    ),
                    client.get(
                        "http://record-service/v1/records/latest_progress",
                        params={"task_id": task_id},
                        headers=auth_header,
                        timeout=10.0
                    ),
                    return_exceptions=True
                )
                
                # デフォルト値
                work_plan_value = 0
                progress_value = 0
                
                if not isinstance(plan_response, Exception) and plan_response.status_code == 200:
                    work_plan_value = plan_response.json().get("work_plan_value", 0)
                
                if not isinstance(record_response, Exception) and record_response.status_code == 200:
                    progress_value = record_response.json().get("progress_value", 0)
                
                # 遅延判定: work_plan_value > progress_value
                progress_gap = progress_value - work_plan_value
                
                if work_plan_value > progress_value:
                    return {
                        "task_id": task_id,
                        "task_name": task_name,
                        "progress_gap": progress_gap,
                        "work_plan_value": work_plan_value,
                        "progress_value": progress_value
                    }
                return None
            
            # 全タスクを並列処理
            results = await asyncio.gather(
                *[check_task_lag(task) for task in tasks],
                return_exceptions=True
            )
            
            # 遅延タスクのみフィルタ
            lagging = [r for r in results if r is not None and not isinstance(r, Exception)]
    
    except Exception:
        return []
    
    return lagging


@router.get("/dashboard/daily_plan_aggregate")
async def daily_plan_aggregate(
    from_date: str = Query(default=None, alias="from"),
    to_date: str = Query(default=None, alias="to"),
    auth_header: dict = Depends(get_auth_header)
):
    """日次計画の集計を取得（ダッシュボード用）"""
    try:
        async with httpx.AsyncClient() as client:
            params = {}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            
            response = await client.get(
                "http://task-service/v1/daily_plans/aggregate",
                params=params,
                headers=auth_header,
                timeout=10.0
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    
    return []


@router.get("/dashboard/daily_record_aggregate")
async def daily_record_aggregate(
    from_date: str = Query(default=None, alias="from"),
    to_date: str = Query(default=None, alias="to"),
    auth_header: dict = Depends(get_auth_header)
):
    """日次実績の集計を取得（ダッシュボード用）"""
    try:
        async with httpx.AsyncClient() as client:
            params = {}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            
            response = await client.get(
                "http://record-service/v1/records/daily_aggregate",
                params=params,
                headers=auth_header,
                timeout=10.0
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    
    return []
