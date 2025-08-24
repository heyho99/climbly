from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["auth"])


class LoginReq(BaseModel):
    username_or_email: str
    password: str


class RegisterReq(BaseModel):
    username: str
    email: str
    password: str


@router.post("/auth/login")
def login(req: LoginReq):
    # TODO: user-serviceへ委譲
    if not req.username_or_email or not req.password:
        raise HTTPException(status_code=400, detail={"message": "invalid credentials"})
    return {
        "token": "demo-token",
        "user": {"user_id": 1, "username": "demo", "email": "demo@example.com"},
    }


@router.post("/auth/register")
def register(req: RegisterReq):
    # TODO: user-serviceへ委譲
    return {
        "token": "demo-token",
        "user": {"user_id": 1, "username": req.username, "email": req.email},
    }


@router.post("/auth/logout")
def logout():
    return {"ok": True}
