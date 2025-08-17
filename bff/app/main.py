from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

app = FastAPI(title="Climbly BFF", version="0.1.0")

# CORS (開発用: 適宜調整)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 開発用フロントエンド
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@app.get("/api/v1/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    # デモ用: 固定トークンを返す（実装時はJWTに置換）
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="username/password required")
    return TokenResponse(access_token="dev-token")


@app.post("/api/v1/logout")
async def logout():
    # デモ用: 何もしない
    return {"ok": True}


@app.get("/api/v1/users/me")
async def me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1]
    if token != "dev-token":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"user_id": 1, "username": "demo"}


@app.get("/api/v1/tasks")
async def list_tasks(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    # デモ用スタブ（本実装ではUser/Auth/Taskサービスへ問い合わせ）
    demo_tasks = [
        {"task_id": 1, "task_name": "英語学習", "completion_rate": 40, "start_at": None, "end_at": None},
        {"task_id": 2, "task_name": "アプリ開発", "completion_rate": 20, "start_at": None, "end_at": None},
    ]
    return {"tasks": demo_tasks}
