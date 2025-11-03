from datetime import datetime, timedelta, timezone
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError # joseはJWTの生成や検証のライブラリ
from app.schemas import (
    RegisterReq,
    LoginReq,
    TokenOut,
    UserOut,
    TaskAuthIn,
    TaskAuthOut,
    TaskAuthUpdate,
)
import psycopg  # PythonからPostgreSQLに接続するためのドライバ
from passlib.context import CryptContext # passlibはパスワードのハッシュ化のライブラリ

# JWTの設定
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7")) # JWTの有効期限

# DBの設定
DB_HOST = os.getenv("DB_HOST", "climbly-user-db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "user_db")
DB_USER = os.getenv("DB_USER", "climbly")
DB_PASSWORD = os.getenv("DB_PASSWORD", "climbly")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
auth_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="Climbly User Service", version="1.0.0")



# Helpers
def get_conn():
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        autocommit=True,
    )


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=JWT_EXPIRE_DAYS)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


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


# Routes
@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/v1/auth/register", response_model=TokenOut)
def register(req: RegisterReq):
    hashed = pwd_context.hash(req.password)
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Check uniqueness
            cur.execute(
                "SELECT 1 FROM users WHERE username=%s OR email=%s",
                (req.username, req.email),
            )
            if cur.fetchone() is not None:
                raise HTTPException(status_code=409, detail={"message": "user already exists"})
            # Insert user
            cur.execute(
                """
                INSERT INTO users (username, password, email)
                VALUES (%s, %s, %s)
                RETURNING user_id, username, email, is_active, last_login_at, created_at, updated_at
                """,
                (req.username, hashed, req.email),
            )
            row = cur.fetchone()
    token = create_access_token(row[0])
    user = UserOut(
        user_id=row[0],
        username=row[1],
        email=row[2],
        is_active=row[3],
        last_login_at=row[4],
        created_at=row[5],
        updated_at=row[6],
    )
    return TokenOut(token=token, user=user)


@app.post("/v1/auth/login", response_model=TokenOut)
def login(req: LoginReq):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, username, email, password, is_active, last_login_at, created_at, updated_at
                FROM users
                WHERE username=%s OR email=%s
                """,
                (req.username_or_email, req.username_or_email),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=400, detail={"message": "invalid credentials"})
            user_id, username, email, hashed, is_active, last_login_at, created_at, updated_at = row
            if not pwd_context.verify(req.password, hashed):
                raise HTTPException(status_code=400, detail={"message": "invalid credentials"})
            # update last_login_at
            cur.execute("UPDATE users SET last_login_at=NOW(), updated_at=NOW() WHERE user_id=%s", (user_id,))
    token = create_access_token(user_id)
    return TokenOut(
        token=token,
        user=UserOut(
            user_id=user_id,
            username=username,
            email=email,
            is_active=is_active,
            last_login_at=last_login_at,
            created_at=created_at,
            updated_at=updated_at,
        ),
    )


@app.post("/v1/auth/logout")
def logout():
    # JWTの無効化はサーバ側では行わない（v1）。クライアント破棄。
    return {"ok": True}


@app.get("/v1/users/me", response_model=UserOut)
def me(current_user_id: int = Depends(get_current_user_id)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, username, email, is_active, last_login_at, created_at, updated_at
                FROM users
                WHERE user_id=%s
                """,
                (current_user_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail={"message": "user not found"})
            return UserOut(
                user_id=row[0],
                username=row[1],
                email=row[2],
                is_active=row[3],
                last_login_at=row[4],
                created_at=row[5],
                updated_at=row[6],
            )


@app.patch("/v1/task_auths/{task_auth_id}", response_model=TaskAuthOut)
def update_task_auth(
    task_auth_id: int,
    req: TaskAuthUpdate,
    current_user_id: int = Depends(get_current_user_id),
):
    if req.task_user_auth not in ["read", "write", "admin"]:
        raise HTTPException(status_code=400, detail={"message": "task_user_auth must be read, write, or admin"})

    with get_conn() as conn:
        row = _get_task_auth(conn, task_auth_id)
        if row is None:
            raise HTTPException(status_code=404, detail={"message": "task_auth not found"})

        task_id = row[1]
        target_user_id = row[2]
        current_role = row[3]

        if not _is_admin(conn, task_id, current_user_id):
            raise HTTPException(status_code=403, detail={"message": "forbidden"})

        # 最後のadminを一般権限へ下げることを防止
        if current_role == "admin" and req.task_user_auth != "admin":
            admin_count = _count_admin(conn, task_id)
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail={"message": "cannot demote the last admin"})

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE task_auths SET task_user_auth=%s, last_updated_user=%s, updated_at=NOW() "
                "WHERE task_auth_id=%s RETURNING task_auth_id, task_id, user_id, task_user_auth, last_updated_user, created_at, updated_at",
                (req.task_user_auth, current_user_id, task_auth_id),
            )
            updated = cur.fetchone()
            if updated is None:
                raise HTTPException(status_code=404, detail={"message": "task_auth not found"})

            return TaskAuthOut(
                task_auth_id=updated[0],
                task_id=updated[1],
                user_id=updated[2],
                task_user_auth=updated[3],
                last_updated_user=updated[4],
                created_at=updated[5],
                updated_at=updated[6],
            )


@app.delete("/v1/task_auths/{task_auth_id}")
def delete_task_auth(task_auth_id: int, current_user_id: int = Depends(get_current_user_id)):
    with get_conn() as conn:
        row = _get_task_auth(conn, task_auth_id)
        if row is None:
            raise HTTPException(status_code=404, detail={"message": "task_auth not found"})

        task_id = row[1]
        target_user_id = row[2]
        role = row[3]

        if not _is_admin(conn, task_id, current_user_id):
            raise HTTPException(status_code=403, detail={"message": "forbidden"})

        # 自分自身を削除する場合: 最後のadminなら拒否
        if role == "admin":
            admin_count = _count_admin(conn, task_id)
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail={"message": "cannot remove the last admin"})

        with conn.cursor() as cur:
            cur.execute("DELETE FROM task_auths WHERE task_auth_id=%s", (task_auth_id,))

        return {"ok": True}


def _get_task_auth(conn, task_auth_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT task_auth_id, task_id, user_id, task_user_auth, last_updated_user, created_at, updated_at "
            "FROM task_auths WHERE task_auth_id=%s",
            (task_auth_id,),
        )
        return cur.fetchone()


def _is_admin(conn, task_id: int, user_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM task_auths WHERE task_id=%s AND user_id=%s AND task_user_auth='admin'",
            (task_id, user_id),
        )
        return cur.fetchone() is not None


def _count_admin(conn, task_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM task_auths WHERE task_id=%s AND task_user_auth='admin'",
            (task_id,),
        )
        row = cur.fetchone()
        return row[0] if row else 0


@app.get("/v1/task_auths")
def get_task_auths(
    task_id: Optional[int] = None,
    current_user_id: int = Depends(get_current_user_id),
):
    query = (
        "SELECT task_auth_id, task_id, user_id, task_user_auth, last_updated_user, created_at, updated_at "
        "FROM task_auths"
    )
    params: list = []

    with get_conn() as conn:
        if task_id is not None:
            if _is_admin(conn, task_id, current_user_id):
                query += " WHERE task_id=%s"
                params = [task_id]
            else:
                query += " WHERE task_id=%s AND user_id=%s"
                params = [task_id, current_user_id]
        else:
            query += " WHERE user_id=%s"
            params = [current_user_id]

        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [
                {
                    "task_auth_id": r[0],
                    "task_id": r[1],
                    "user_id": r[2],
                    "task_user_auth": r[3],
                    "last_updated_user": r[4],
                    "created_at": r[5],
                    "updated_at": r[6],
                }
                for r in rows
            ]


@app.post("/v1/task_auths", response_model=TaskAuthOut)
def create_task_auth(req: TaskAuthIn, current_user_id: int = Depends(get_current_user_id)):
    if req.task_user_auth not in ["read", "write", "admin"]:
        raise HTTPException(status_code=400, detail={"message": "task_user_auth must be read, write, or admin"})

    with get_conn() as conn:
        if not _is_admin(conn, req.task_id, current_user_id):
            raise HTTPException(status_code=403, detail={"message": "forbidden"})
        with conn.cursor() as cur:
            # ユーザー存在確認
            cur.execute("SELECT 1 FROM users WHERE user_id=%s", (req.user_id,))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail={"message": f"user {req.user_id} not found"})
            
            # 重複チェック（同じtask_idとuser_idの組み合わせが既に存在するか）
            cur.execute(
                "SELECT 1 FROM task_auths WHERE task_id=%s AND user_id=%s",
                (req.task_id, req.user_id),
            )
            if cur.fetchone() is not None:
                raise HTTPException(status_code=409, detail={"message": "task_auth already exists"})
            
            # task_auth作成
            cur.execute(
                """
                INSERT INTO task_auths (task_id, user_id, task_user_auth, last_updated_user)
                VALUES (%s, %s, %s, %s)
                RETURNING task_auth_id, task_id, user_id, task_user_auth, last_updated_user, created_at, updated_at
                """,
                (req.task_id, req.user_id, req.task_user_auth, current_user_id),
            )
            row = cur.fetchone()
            return TaskAuthOut(
                task_auth_id=row[0],
                task_id=row[1],
                user_id=row[2],
                task_user_auth=row[3],
                last_updated_user=row[4],
                created_at=row[5],
                updated_at=row[6],
            )
