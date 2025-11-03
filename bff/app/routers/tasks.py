from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import httpx

router = APIRouter(tags=["tasks"])

TASK_SVC_BASE = "http://task-service/v1"
RECORD_SVC_BASE = "http://record-service/v1"


def _forward_auth_headers(request: Request) -> dict:
    headers = {}
    auth = request.headers.get("authorization")
    if auth:
        headers["authorization"] = auth
    return headers


def _aggregate_daily_actuals(
    records: List[Dict],
    expected_dates: Optional[List[str]] = None,
    upto_date: Optional[date] = None,
) -> List[Dict]:
    """
    実績データを日付ごとに集計（累積値）
    records: [{ start_at, progress_value, work_time, ... }]
    戻り値: [{ target_date, work_actual_value, time_actual_value }]
    """
    if not records:
        return []
    
    # 日付ごとにグループ化
    daily_data = {}
    
    for record in sorted(records, key=lambda r: r.get("start_at", "")):
        start_at_str = record.get("start_at")
        if not start_at_str:
            continue
        
        try:
            # ISO形式の日時から日付部分を抽出
            date_str = start_at_str.split("T")[0]  # "2025-01-01T10:00:00" -> "2025-01-01"
        except:
            continue
        
        if date_str not in daily_data:
            daily_data[date_str] = {
                "progress_sum": 0,
                "time_sum": 0
            }
        
        daily_data[date_str]["progress_sum"] += record.get("progress_value", 0)
        daily_data[date_str]["time_sum"] += record.get("work_time", 0)
    
    timeline_set = set()

    for key in daily_data.keys():
        key_date = _parse_iso_date(key)
        if key_date and (upto_date is None or key_date <= upto_date):
            timeline_set.add(key_date.isoformat())

    if expected_dates:
        for expected in expected_dates:
            expected_date = _parse_iso_date(expected)
            if expected_date and (upto_date is None or expected_date <= upto_date):
                timeline_set.add(expected_date.isoformat())

    timeline = sorted(timeline_set)

    cumulative_progress = 0

    result = []
    for date_str in timeline:
        day_values = daily_data.get(date_str)
        if day_values:
            cumulative_progress += day_values["progress_sum"]
            daily_time = day_values["time_sum"]
        else:
            daily_time = 0

        cumulative_progress = min(cumulative_progress, 100)

        result.append({
            "target_date": date_str,
            "work_actual_value": cumulative_progress,
            "time_actual_value": daily_time,
        })

    return result


def _parse_iso_date(value) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(value).date()
    except (TypeError, ValueError):
        try:
            return date.fromisoformat(str(value))
        except (TypeError, ValueError):
            return None


def _to_int(value: Any) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def _compute_today_summary(task: Dict[str, Any], today: date) -> None:
    summary = {
        "work_plan_cumulative": 0,
        "work_actual_cumulative": 0,
        "time_plan_cumulative": 0,
        "time_actual_cumulative": 0,
    }

    plans = task.get("daily_plans") or []
    latest_plan_entry = None
    time_plan_total = 0

    for plan in plans:
        plan_date = _parse_iso_date(plan.get("target_date"))
        if plan_date and plan_date <= today:
            time_plan_total += _to_int(plan.get("time_plan_value"))
            if latest_plan_entry is None or plan_date > latest_plan_entry[0]:
                latest_plan_entry = (plan_date, plan)

    summary["time_plan_cumulative"] = time_plan_total
    if latest_plan_entry:
        summary["work_plan_cumulative"] = _to_int(latest_plan_entry[1].get("work_plan_value"))

    actuals = task.get("daily_actuals") or []
    latest_work_value = 0
    total_time_actual = 0

    for actual in actuals:
        actual_date = _parse_iso_date(actual.get("target_date"))
        if actual_date and actual_date <= today:
            latest_work_value = _to_int(actual.get("work_actual_value"))
            total_time_actual += _to_int(actual.get("time_actual_value"))

    summary["work_actual_cumulative"] = latest_work_value
    summary["time_actual_cumulative"] = total_time_actual

    task["summary_today"] = summary


@router.get("/tasks")
def list_tasks(request: Request, mine: Optional[bool] = True, category: Optional[str] = None, status: Optional[str] = None, include_daily_plans: Optional[bool] = False, include_actuals: Optional[bool] = False, page: int = 1, per_page: int = 50):
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
            
            today = datetime.utcnow().date()

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
            
            # include_actualsがTrueの場合、各タスクの実績データを取得して集計
            if include_actuals:
                headers = _forward_auth_headers(request)
                for task in items:
                    if not isinstance(task, dict):
                        continue
                    task_id = task.get("task_id")
                    if task_id:
                        try:
                            # record-serviceから実績を取得
                            records_resp = client.get(
                                f"{RECORD_SVC_BASE}/records",
                                params={"task_id": task_id},
                                headers=headers
                            )
                            if records_resp.is_success:
                                records = records_resp.json()
                                # 日付ごとに集計
                                plan_dates = []
                                if include_daily_plans:
                                    plan_dates = [
                                        p.get("target_date")
                                        for p in task.get("daily_plans") or []
                                        if isinstance(p, dict) and p.get("target_date")
                                    ]
                                task["daily_actuals"] = _aggregate_daily_actuals(
                                    records,
                                    plan_dates if plan_dates else None,
                                    upto_date=today,
                                )
                            else:
                                task["daily_actuals"] = []
                        except Exception as e:
                            print(f"Error fetching actuals for task {task_id}: {e}")
                            task["daily_actuals"] = []
                    else:
                        task["daily_actuals"] = []
            
            for task in items:
                if isinstance(task, dict):
                    _compute_today_summary(task, today)

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
