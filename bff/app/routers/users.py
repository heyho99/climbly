from fastapi import APIRouter

router = APIRouter(tags=["users"])


@router.get("/users/me")
def me():
    # TODO: user-serviceへ委譲（Authorizationから判定）
    return {"user_id": 1, "username": "demo", "email": "demo@example.com"}
