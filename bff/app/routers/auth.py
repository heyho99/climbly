from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
import httpx

router = APIRouter(tags=["auth"])


class LoginReq(BaseModel):
    username_or_email: str
    password: str


class RegisterReq(BaseModel):
    username: str
    email: EmailStr
    password: str


USER_SVC_BASE = "http://user-service/v1"


@router.post("/auth/login")
def login(req: LoginReq):
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(f"{USER_SVC_BASE}/auth/login", json=req.model_dump())
        if resp.is_success:
            return resp.json()
        # エラーレスポンスの処理
        try:
            detail = resp.json()
        except Exception:
            detail = {"message": "user-service error", "status_code": resp.status_code}
        raise HTTPException(status_code=resp.status_code, detail=detail)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "user-service unavailable", "error": str(e)})


@router.post("/auth/register")
def register(req: RegisterReq):
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(f"{USER_SVC_BASE}/auth/register", json=req.model_dump())
        if resp.is_success:
            return resp.json()
        # エラーレスポンスの処理
        try:
            detail = resp.json()
        except Exception:
            detail = {"message": "user-service error", "status_code": resp.status_code}
        raise HTTPException(status_code=resp.status_code, detail=detail)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "user-service unavailable", "error": str(e)})


@router.post("/auth/logout")
def logout():
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(f"{USER_SVC_BASE}/auth/logout")
        if resp.is_success:
            return resp.json()
        # エラーレスポンスの処理
        try:
            detail = resp.json()
        except Exception:
            detail = {"message": "user-service error", "status_code": resp.status_code}
        raise HTTPException(status_code=resp.status_code, detail=detail)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "user-service unavailable", "error": str(e)})
