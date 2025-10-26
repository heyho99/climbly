import os
from datetime import datetime, timedelta, timezone, date
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import psycopg
import httpx

from app.schemas import TaskIn, TaskOut, TaskUpdate, DailyPlanOut, DailyPlanBulkItem

# JWT 設定（user-service と同一シークレット/アルゴリズム）
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

# DB 設定（task-db）
DB_HOST = os.getenv("DB_HOST", "climbly-task-db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "task_db")
DB_USER = os.getenv("DB_USER", "climbly")
DB_PASSWORD = os.getenv("DB_PASSWORD", "climbly")

# user-service URL
USER_SVC_BASE = os.getenv("USER_SVC_BASE", "http://user-service/v1")

auth_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="Climbly Task Service", version="1.0.0")


def get_conn():
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        autocommit=True,
    )


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail={"message": "invalid token"})
        return int(sub)
    except JWTError:
        raise HTTPException(status_code=401, detail={"message": "invalid token"})


async def get_current_user_id(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme),
) -> int:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail={"message": "missing bearer token"})
    return decode_token(creds.credentials)


def get_auth_token(creds: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme)) -> str:
    """認証トークンを取得（user-serviceへの転送用）"""
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail={"message": "missing bearer token"})
    return creds.credentials


def check_task_permission(task_id: int, user_id: int, token: str) -> bool:
    """ユーザーが指定されたタスクへのアクセス権を持っているかチェック"""
    try:
        with httpx.Client(timeout=10.0) as client:
            auth_resp = client.get(
                f"{USER_SVC_BASE}/task_auths",
                params={"task_id": task_id},
                headers={"authorization": f"Bearer {token}"}
            )
            if auth_resp.is_success:
                task_auths = auth_resp.json()
                return len(task_auths) > 0
            return False
    except httpx.RequestError:
        return False


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# Tasks
@app.get("/v1/tasks", response_model=List[TaskOut])
def list_tasks(
    mine: bool = Query(default=True),   # bool: 自分がアクセス権を持つタスクのみ取得する場合はTrue
    category: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None, regex="^(active|completed|paused|cancelled)$"),
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token),
):
    query = (
        "SELECT task_id, created_by, task_name, task_content, start_at, end_at, "
        "category, target_time, comment, status, created_at, updated_at FROM tasks"
    )
    params: List = []
    where = []
    
    if mine:
        # user-serviceからログインユーザーがアクセス権を持つtask_idリストを取得
        try:
            with httpx.Client(timeout=10.0) as client:
                auth_resp = client.get(
                    f"{USER_SVC_BASE}/task_auths",
                    headers={"authorization": f"Bearer {token}"}
                )
                if not auth_resp.is_success:
                    raise HTTPException(
                        status_code=502,
                        detail={"message": "failed to get task_auths", "error": auth_resp.text}
                    )
                task_auths = auth_resp.json()
                authorized_task_ids = [auth["task_id"] for auth in task_auths]
                
                if authorized_task_ids:
                    # 権限のあるタスクIDで絞り込む
                    where.append("task_id = ANY(%s)")
                    params.append(authorized_task_ids)
                else:
                    # 権限のあるタスクがない場合は空を返す
                    return []
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail={"message": "user-service unavailable", "error": str(e)}
            )
    
    if category is not None:
        where.append("category=%s")
        params.append(category)
    if status is not None:
        where.append("status=%s")
        params.append(status)
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY task_id DESC"

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [
                TaskOut(
                    task_id=r[0],
                    created_by=r[1],
                    task_name=r[2],
                    task_content=r[3],
                    start_at=r[4],
                    end_at=r[5],
                    category=r[6],
                    target_time=r[7],
                    comment=r[8],
                    status=r[9],
                    created_at=r[10],
                    updated_at=r[11],
                )
                for r in rows
            ]


@app.post("/v1/tasks", response_model=TaskOut)
def create_task(
    req: TaskIn, 
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token)
):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                (
                    "INSERT INTO tasks (created_by, task_name, task_content, start_at, end_at, category, target_time, comment, status) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    "RETURNING task_id, created_by, task_name, task_content, start_at, end_at, category, target_time, comment, status, created_at, updated_at"
                ),
                (
                    current_user_id,
                    req.task_name,
                    req.task_content,
                    req.start_at,
                    req.end_at,
                    req.category,
                    req.target_time,
                    req.comment,
                    req.status,
                ),
            )
            r = cur.fetchone()
            task_id = r[0]
            
            # タスク作成後、作成者のtask_authをadminで作成
            try:
                with httpx.Client(timeout=10.0) as client:
                    auth_resp = client.post(
                        f"{USER_SVC_BASE}/task_auths",
                        json={
                            "task_id": task_id,
                            "user_id": current_user_id,
                            "task_user_auth": "admin"
                        },
                        headers={"authorization": f"Bearer {token}"}
                    )
                    if not auth_resp.is_success:
                        # task_auth作成に失敗した場合、タスクを削除してロールバック
                        cur.execute("DELETE FROM tasks WHERE task_id=%s", (task_id,))
                        raise HTTPException(
                            status_code=502, 
                            detail={"message": "failed to create task_auth", "error": auth_resp.text}
                        )
            except httpx.RequestError as e:
                # user-serviceに到達できない場合、タスクを削除してロールバック
                cur.execute("DELETE FROM tasks WHERE task_id=%s", (task_id,))
                raise HTTPException(
                    status_code=502, 
                    detail={"message": "user-service unavailable", "error": str(e)}
                )
            
            return TaskOut(
                task_id=r[0],
                created_by=r[1],
                task_name=r[2],
                task_content=r[3],
                start_at=r[4],
                end_at=r[5],
                category=r[6],
                target_time=r[7],
                comment=r[8],
                status=r[9],
                created_at=r[10],
                updated_at=r[11],
            )


@app.get("/v1/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int, 
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token)
):
    # アクセス権チェック
    if not check_task_permission(task_id, current_user_id, token):
        raise HTTPException(status_code=404, detail={"message": "task not found"})
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                (
                    "SELECT task_id, created_by, task_name, task_content, start_at, end_at, category, target_time, comment, status, created_at, updated_at "
                    "FROM tasks WHERE task_id=%s"
                ),
                (task_id,),
            )
            r = cur.fetchone()
            if r is None:
                raise HTTPException(status_code=404, detail={"message": "task not found"})
            return TaskOut(
                task_id=r[0],
                created_by=r[1],
                task_name=r[2],
                task_content=r[3],
                start_at=r[4],
                end_at=r[5],
                category=r[6],
                target_time=r[7],
                comment=r[8],
                status=r[9],
                created_at=r[10],
                updated_at=r[11],
            )


@app.patch("/v1/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int, 
    req: TaskUpdate, 
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token)
):
    # アクセス権チェック
    if not check_task_permission(task_id, current_user_id, token):
        raise HTTPException(status_code=404, detail={"message": "task not found"})
    
    fields = []
    params: List = []
    for col, val in (
        ("task_name", req.task_name),
        ("task_content", req.task_content),
        ("start_at", req.start_at),
        ("end_at", req.end_at),
        ("category", req.category),
        ("target_time", req.target_time),
        ("comment", req.comment),
        ("status", req.status),
    ):
        if val is not None:
            fields.append(f"{col}=%s")
            params.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail={"message": "no fields to update"})
    params.append(task_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE tasks SET {', '.join(fields)}, updated_at=NOW() WHERE task_id=%s",
                params,
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail={"message": "task not found"})
            cur.execute(
                (
                    "SELECT task_id, created_by, task_name, task_content, start_at, end_at, category, target_time, comment, status, created_at, updated_at "
                    "FROM tasks WHERE task_id=%s"
                ),
                (task_id,),
            )
            r = cur.fetchone()
            return TaskOut(
                task_id=r[0],
                created_by=r[1],
                task_name=r[2],
                task_content=r[3],
                start_at=r[4],
                end_at=r[5],
                category=r[6],
                target_time=r[7],
                comment=r[8],
                status=r[9],
                created_at=r[10],
                updated_at=r[11],
            )


@app.delete("/v1/tasks/{task_id}")
def delete_task(
    task_id: int, 
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token)
):
    # アクセス権チェック
    if not check_task_permission(task_id, current_user_id, token):
        raise HTTPException(status_code=404, detail={"message": "task not found"})
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            # 関連(daily_plans)は外部キーでON DELETE CASCADEを採用
            cur.execute("DELETE FROM tasks WHERE task_id=%s", (task_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail={"message": "task not found"})
    return {"ok": True}


# Daily Plans
@app.get("/v1/tasks/{task_id}/daily_plans", response_model=List[DailyPlanOut])
def get_daily_plans(
    task_id: int,
    from_: Optional[date] = Query(default=None, alias="from"),
    to: Optional[date] = None,
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token),
):
    # アクセス権チェック
    if not check_task_permission(task_id, current_user_id, token):
        raise HTTPException(status_code=404, detail={"message": "task not found"})
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            query = (
                "SELECT daily_time_plan_id, task_id, created_by, target_date, work_plan_value, time_plan_value, created_at, updated_at "
                "FROM daily_plans WHERE task_id=%s"
            )
            params: List = [task_id]
            if from_ is not None:
                query += " AND target_date >= %s"
                params.append(from_)
            if to is not None:
                query += " AND target_date <= %s"
                params.append(to)
            query += " ORDER BY target_date ASC"
            cur.execute(query, params)
            rows = cur.fetchall()
            return [
                DailyPlanOut(
                    daily_time_plan_id=r[0],
                    task_id=r[1],
                    created_by=r[2],
                    target_date=r[3],
                    work_plan_value=r[4],
                    time_plan_value=r[5],
                    created_at=r[6],
                    updated_at=r[7],
                )
                for r in rows
            ]


@app.put("/v1/tasks/{task_id}/daily_plans/bulk")
def put_daily_plans_bulk(
    task_id: int,
    items: List[DailyPlanBulkItem],
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token),
):
    # アクセス権チェック
    if not check_task_permission(task_id, current_user_id, token):
        raise HTTPException(status_code=404, detail={"message": "task not found"})
    
    # 仕様: Σ(work_plan_value)=100, Σ(time_plan_value)=tasks.target_time
    with get_conn() as conn:
        # 差分適用を原子的に行いたいのでトランザクションを明示管理
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                # タスクの目標時間を取得
                cur.execute("SELECT target_time FROM tasks WHERE task_id=%s", (task_id,))
                r = cur.fetchone()
                if r is None:
                    conn.rollback()
                    raise HTTPException(status_code=404, detail={"message": "task not found"})
                target_time = int(r[0])

                # 合計検証 - work_plan_valueは累積値なので最大値が100であることを確認
                max_work = max(i.work_plan_value for i in items) if items else 0
                sum_time = sum(i.time_plan_value for i in items)
                if max_work != 100 or sum_time != target_time:
                    conn.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "message": "invalid plan sum",
                            "details": {"max_work": max_work, "sum_time": sum_time, "target_time": target_time},
                        },
                    )

                # 既存レコードを取得（target_dateをキーに差分判定）
                cur.execute(
                    (
                        "SELECT target_date, daily_time_plan_id FROM daily_plans "
                        "WHERE task_id=%s ORDER BY target_date ASC"
                    ),
                    (task_id,),
                )
                rows = cur.fetchall()
                existing_dates = {row[0] for row in rows}

                # 入力の辞書化（target_date -> item）
                incoming_map = {i.target_date: i for i in items}
                incoming_dates = set(incoming_map.keys())

                # 1) UPDATE/INSERT
                for td, it in incoming_map.items():
                    if td in existing_dates:
                        # 値更新（ID維持）。updated_atはDB側トリガ or NOW() 更新のいずれか。
                        cur.execute(
                            (
                                "UPDATE daily_plans SET work_plan_value=%s, time_plan_value=%s, updated_at=NOW() "
                                "WHERE task_id=%s AND target_date=%s"
                            ),
                            (it.work_plan_value, it.time_plan_value, task_id, td),
                        )
                    else:
                        # 新規挿入
                        cur.execute(
                            (
                                "INSERT INTO daily_plans (task_id, created_by, target_date, work_plan_value, time_plan_value) "
                                "VALUES (%s,%s,%s,%s,%s)"
                            ),
                            (task_id, current_user_id, it.target_date, it.work_plan_value, it.time_plan_value),
                        )

                # 2) PRUNE: 新配列に無い既存日付を削除
                to_delete = existing_dates - incoming_dates
                if to_delete:
                    # ここで records がある日付の扱いをポリシー化する場合は除外や事前検証を挟む
                    # 今は単純に削除する（将来拡張余地）
                    # IN 句用にタプル化
                    cur.execute(
                        (
                            "DELETE FROM daily_plans WHERE task_id=%s AND target_date = ANY(%s)"
                        ),
                        (task_id, list(to_delete)),
                    )

            conn.commit()
            return {"ok": True, "upserted": len(items), "pruned": len(to_delete)}
        except Exception:
            conn.rollback()
            raise


@app.get("/v1/daily_plans/aggregate")
def aggregate_daily_plans(
    from_: Optional[date] = Query(default=None, alias="from"),
    to: Optional[date] = Query(default=None, alias="to"),
    current_user_id: int = Depends(get_current_user_id),
    token: str = Depends(get_auth_token)
):
    """全タスクの日次計画を集計（ダッシュボード用）"""
    # user-serviceから権限のあるtask_idリストを取得
    try:
        with httpx.Client(timeout=10.0) as client:
            auth_resp = client.get(
                f"{USER_SVC_BASE}/task_auths",
                headers={"authorization": f"Bearer {token}"}
            )
            if not auth_resp.is_success:
                raise HTTPException(
                    status_code=502,
                    detail={"message": "failed to get task_auths", "error": auth_resp.text}
                )
            task_auths = auth_resp.json()
            authorized_task_ids = [auth["task_id"] for auth in task_auths]
            
            if not authorized_task_ids:
                return []
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail={"message": "user-service unavailable", "error": str(e)}
        )
    
    # daily_plansを日付ごとに集計
    with get_conn() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT target_date, SUM(time_plan_value) as total_time_plan
                FROM daily_plans
                WHERE task_id = ANY(%s)
            """
            params: List = [authorized_task_ids]
            
            if from_ is not None:
                query += " AND target_date >= %s"
                params.append(from_)
            if to is not None:
                query += " AND target_date <= %s"
                params.append(to)
            
            query += " GROUP BY target_date ORDER BY target_date ASC"
            
            cur.execute(query, params)
            rows = cur.fetchall()
            
            return [
                {
                    "target_date": str(r[0]),
                    "total_time_plan": int(r[1]) if r[1] else 0
                }
                for r in rows
            ]
