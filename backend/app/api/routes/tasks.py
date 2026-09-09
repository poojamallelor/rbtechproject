from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any
from app.core.database import get_db
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter()

@router.post("/", response_model=dict)
async def create_task(task_in: TaskCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> Any:
    task = Task(
        title=task_in.title,
        status=task_in.status,
        project_id=task_in.project_id,
        assignee_id=task_in.assignee_id or current_user.id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return {"success": True, "message": "Task created", "data": {"id": task.id, "title": task.title}}

@router.get("/project/{project_id}", response_model=dict)
async def read_tasks(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = result.scalars().all()
    data = [{"id": t.id, "title": t.title, "status": t.status} for t in tasks]
    return {"success": True, "message": "Tasks fetched", "data": data}
