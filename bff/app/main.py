from fastapi import FastAPI
from .routers import auth, users, dashboard, tasks, records

app = FastAPI(title="Climbly BFF", version="1.0.0")

# Prefix: /bff/v1
app.include_router(auth.router, prefix="/bff/v1")
app.include_router(users.router, prefix="/bff/v1")
app.include_router(dashboard.router, prefix="/bff/v1")
app.include_router(tasks.router, prefix="/bff/v1")
app.include_router(records.router, prefix="/bff/v1")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
