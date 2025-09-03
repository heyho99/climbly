from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RecordIn(BaseModel):
    task_id: int = Field(gt=0)
    start_at: datetime
    end_at: datetime
    progress_value: int = Field(ge=0)
    work_time: int = Field(ge=0)
    note: Optional[str] = None


class RecordUpdate(BaseModel):
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    progress_value: Optional[int] = Field(default=None, ge=0)
    work_time: Optional[int] = Field(default=None, ge=0)
    note: Optional[str] = None


class RecordOut(BaseModel):
    record_work_id: int
    task_id: int
    created_by: int
    start_at: datetime
    end_at: datetime
    progress_value: int
    work_time: int
    note: Optional[str]
    last_updated_user: Optional[int]
    created_at: datetime
    updated_at: datetime
