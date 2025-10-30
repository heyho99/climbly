import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import psycopg

from app.schemas.records import RecordIn, RecordOut, RecordUpdate

# JWT 設定（user-service と同一シークレット/アルゴリズム）
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"

# DB 設定（record-db）
DB_HOST = os.getenv("DB_HOST", "climbly-record-db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "record_db")
DB_USER = os.getenv("DB_USER", "climbly")
DB_PASSWORD = os.getenv("DB_PASSWORD", "climbly")

auth_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="Climbly Record Service", version="1.0.0")


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


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/v1/records", response_model=List[RecordOut])
def list_records(
    task_id: Optional[int] = Query(default=None),
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user_id: int = Depends(get_current_user_id),
):
    """実績一覧を取得"""
    query = """
        SELECT record_work_id, task_id, created_by, start_at, end_at, 
               progress_value, work_time, note, last_updated_user, created_at, updated_at
        FROM record_works
        WHERE created_by = %s
    """
    params = [current_user_id]

    if task_id is not None:
        query += " AND task_id = %s"
        params.append(task_id)
    
    if from_:
        query += " AND start_at >= %s"
        params.append(from_)
    
    if to:
        query += " AND end_at <= %s"
        params.append(to)

    query += " ORDER BY start_at DESC LIMIT %s OFFSET %s"
    params.extend([per_page, (page - 1) * per_page])

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [
                RecordOut(
                    record_work_id=r[0],
                    task_id=r[1],
                    created_by=r[2],
                    start_at=r[3],
                    end_at=r[4],
                    progress_value=r[5],
                    work_time=r[6],
                    note=r[7],
                    last_updated_user=r[8],
                    created_at=r[9],
                    updated_at=r[10],
                )
                for r in rows
            ]


@app.get("/v1/records/daily_aggregate")
def get_daily_aggregate(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    current_user_id: int = Depends(get_current_user_id)
):
    """日次実績作業時間の集計を取得（ダッシュボード用）
    各日付の実績作業時間の合計を返す（累積ではない）
    """
    query = """
        SELECT DATE(start_at) as target_date, COALESCE(SUM(work_time), 0) as total_work_time
        FROM record_works
        WHERE created_by = %s
    """
    params = [current_user_id]
    
    if from_date:
        query += " AND DATE(start_at) >= %s"
        params.append(from_date)
    if to_date:
        query += " AND DATE(start_at) <= %s"
        params.append(to_date)
    
    query += " GROUP BY DATE(start_at) ORDER BY target_date ASC"
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            
            result = []
            for row in rows:
                if row[0]:
                    # dateオブジェクトをYYYY-MM-DD形式の文字列に変換
                    target_date = row[0].strftime('%Y-%m-%d') if hasattr(row[0], 'strftime') else str(row[0])
                    result.append({
                        "target_date": target_date,
                        "total_work_time": int(row[1])
                    })
            
            return result


@app.get("/v1/records/by_task")
def list_records_by_task(
    task_id: Optional[int] = Query(default=None),
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    current_user_id: int = Depends(get_current_user_id),
):
    """タスク別に実績をグループ化して取得（カンバン表示用）"""
    query = """
        SELECT DISTINCT task_id FROM record_works WHERE created_by = %s
    """
    params = [current_user_id]
    
    if task_id is not None:
        query += " AND task_id = %s"
        params.append(task_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            task_ids = [row[0] for row in cur.fetchall()]

    tasks = []

    for tid in task_ids:
        # 実績データを取得
        record_query = """
            SELECT record_work_id, task_id, created_by, start_at, end_at,
                   progress_value, work_time, note, last_updated_user, created_at, updated_at
            FROM record_works
            WHERE task_id = %s AND created_by = %s
        """
        record_params = [tid, current_user_id]
        
        if from_:
            record_query += " AND start_at >= %s"
            record_params.append(from_)
        
        if to:
            record_query += " AND end_at <= %s"
            record_params.append(to)
            
        record_query += " ORDER BY start_at DESC"

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(record_query, record_params)
                record_rows = cur.fetchall()

        records = [
            {
                "record_work_id": r[0],
                "start_at": r[3].isoformat(),
                "end_at": r[4].isoformat(),
                "work_time": r[6],
                "progress_value": r[5],
                "note": r[7],
                "created_by": r[2],
            }
            for r in record_rows
        ]

        tasks.append({
            "task_id": tid,
            "task_title": "",  # シンプルなタイトル、詳細はBFFで取得
            "assignees": [],  # 簡易版では空配列
            "records": records,
        })

    total_records = sum(len(t["records"]) for t in tasks)
    
    return {
        "from": from_,
        "to": to,
        "tasks": tasks,
        "total_tasks": len(tasks),
        "total_records": total_records,
    }


@app.get("/v1/records/{record_work_id}", response_model=RecordOut)
def get_record(
    record_work_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """単一実績を取得"""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT record_work_id, task_id, created_by, start_at, end_at,
                       progress_value, work_time, note, last_updated_user, created_at, updated_at
                FROM record_works
                WHERE record_work_id = %s AND created_by = %s
                """,
                (record_work_id, current_user_id),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail={"message": "record not found"})
            
            return RecordOut(
                record_work_id=row[0],
                task_id=row[1],
                created_by=row[2],
                start_at=row[3],
                end_at=row[4],
                progress_value=row[5],
                work_time=row[6],
                note=row[7],
                last_updated_user=row[8],
                created_at=row[9],
                updated_at=row[10],
            )


@app.post("/v1/records", response_model=RecordOut)
def create_record(
    record: RecordIn,
    current_user_id: int = Depends(get_current_user_id),
):
    """実績を作成"""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO record_works (task_id, created_by, start_at, end_at, progress_value, work_time, note)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING record_work_id, task_id, created_by, start_at, end_at,
                          progress_value, work_time, note, last_updated_user, created_at, updated_at
                """,
                (
                    record.task_id,
                    current_user_id,
                    record.start_at,
                    record.end_at,
                    record.progress_value,
                    record.work_time,
                    record.note,
                ),
            )
            row = cur.fetchone()
            
            return RecordOut(
                record_work_id=row[0],
                task_id=row[1],
                created_by=row[2],
                start_at=row[3],
                end_at=row[4],
                progress_value=row[5],
                work_time=row[6],
                note=row[7],
                last_updated_user=row[8],
                created_at=row[9],
                updated_at=row[10],
            )


@app.patch("/v1/records/{record_work_id}", response_model=RecordOut)
def update_record(
    record_work_id: int,
    record: RecordUpdate,
    current_user_id: int = Depends(get_current_user_id),
):
    """実績を更新"""
    # 更新対象のフィールドを動的に構築
    fields = []
    params = []
    
    if record.start_at is not None:
        fields.append("start_at = %s")
        params.append(record.start_at)
    
    if record.end_at is not None:
        fields.append("end_at = %s")
        params.append(record.end_at)
        
    if record.progress_value is not None:
        fields.append("progress_value = %s")
        params.append(record.progress_value)
        
    if record.work_time is not None:
        fields.append("work_time = %s")
        params.append(record.work_time)
        
    if record.note is not None:
        fields.append("note = %s")
        params.append(record.note)
    
    if not fields:
        raise HTTPException(status_code=400, detail={"message": "no fields to update"})
    
    fields.append("last_updated_user = %s")
    fields.append("updated_at = NOW()")
    params.extend([current_user_id, record_work_id, current_user_id])

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE record_works 
                SET {', '.join(fields)}
                WHERE record_work_id = %s AND created_by = %s
                RETURNING record_work_id, task_id, created_by, start_at, end_at,
                          progress_value, work_time, note, last_updated_user, created_at, updated_at
                """,
                params,
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail={"message": "record not found"})
            
            return RecordOut(
                record_work_id=row[0],
                task_id=row[1],
                created_by=row[2],
                start_at=row[3],
                end_at=row[4],
                progress_value=row[5],
                work_time=row[6],
                note=row[7],
                last_updated_user=row[8],
                created_at=row[9],
                updated_at=row[10],
            )


@app.delete("/v1/records/{record_work_id}")
def delete_record(
    record_work_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """実績を削除"""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM record_works WHERE record_work_id = %s AND created_by = %s",
                (record_work_id, current_user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail={"message": "record not found"})
    
    return {"ok": True}


# Metrics
@app.get("/v1/metrics/work_time/summary")
def get_work_time_summary(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    current_user_id: int = Depends(get_current_user_id)
):
    """作業時間の集計を取得"""
    query = "SELECT COALESCE(SUM(work_time), 0) FROM record_works WHERE created_by=%s"
    params = [current_user_id]
    
    if from_date:
        query += " AND created_at >= %s"
        params.append(from_date)
    if to_date:
        query += " AND created_at < %s"
        params.append(to_date)
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            total = cur.fetchone()[0]
    
    return {"total_work_time": int(total)}
