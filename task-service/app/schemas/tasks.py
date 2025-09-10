from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class TaskIn(BaseModel):
    task_name: str = Field(min_length=1, max_length=255)
    task_content: str = Field(default="")
    start_at: datetime
    end_at: datetime
    category: str = Field(pattern=r"^(study|creation|other)$")
    target_time: int = Field(ge=0)
    comment: Optional[str] = None
    status: str = Field(default="active", pattern=r"^(active|completed|paused|cancelled)$")


class TaskUpdate(BaseModel):
    task_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    task_content: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    category: Optional[str] = Field(default=None, pattern=r"^(study|creation|other)$")
    target_time: Optional[int] = Field(default=None, ge=0)
    comment: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern=r"^(active|completed|paused|cancelled)$")


class TaskOut(BaseModel):
    task_id: int
    created_by: int
    task_name: str
    task_content: str
    start_at: datetime
    end_at: datetime
    category: str
    target_time: int
    comment: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime


class DailyPlanOut(BaseModel):
    daily_time_plan_id: int
    task_id: int
    created_by: int
    target_date: date
    work_plan_value: int
    time_plan_value: int
    created_at: datetime
    updated_at: datetime


class DailyPlanBulkItem(BaseModel):
    target_date: date
    work_plan_value: int = Field(ge=0)
    time_plan_value: int = Field(ge=0)


class DailyPlanBulkIn(BaseModel):
    items: List[DailyPlanBulkItem]
