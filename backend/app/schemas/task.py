from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.task import TaskStatusEnum

class TaskBase(BaseModel):
    title: str
    status: Optional[TaskStatusEnum] = TaskStatusEnum.TODO
    assignee_id: Optional[UUID] = None

class TaskCreate(TaskBase):
    project_id: UUID

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[TaskStatusEnum] = None
    assignee_id: Optional[UUID] = None

class TaskResponse(TaskBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
