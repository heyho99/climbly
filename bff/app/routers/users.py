from fastapi import APIRouter, HTTPException, Request
import httpx

router = APIRouter(tags=["users"])

USER_SVC_BASE = "http://user-service/v1"


@router.get("/users/me")
def me(request: Request):
    # Authorization ヘッダを透過
    headers = {}
    auth = request.headers.get("authorization")
    if auth:
        headers["authorization"] = auth
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{USER_SVC_BASE}/users/me", headers=headers)
        if resp.is_success:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail={"message": "user-service unavailable", "error": str(e)})
