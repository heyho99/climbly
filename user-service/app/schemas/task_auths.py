from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TaskAuthIn(BaseModel):
    task_id: int
    user_id: int
    task_user_auth: str  # read/write/admin


class TaskAuthOut(BaseModel):
    task_auth_id: int
    task_id: int
    user_id: int
    task_user_auth: str
    last_updated_user: Optional[int]
    created_at: datetime
    updated_at: datetime


class TaskAuthUpdate(BaseModel):
    task_user_auth: str
