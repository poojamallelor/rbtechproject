from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any
from app.core.database import get_db
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter()

@router.post("/", response_model=dict)
async def create_project(project_in: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> Any:
    project = Project(
        name=project_in.name,
        description=project_in.description,
        owner_id=current_user.id
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {"success": True, "message": "Project created", "data": {"id": project.id, "name": project.name}}

@router.get("/", response_model=dict)
async def read_projects(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Project).where(Project.owner_id == current_user.id))
    projects = result.scalars().all()
    data = [{"id": p.id, "name": p.name, "description": p.description} for p in projects]
    return {"success": True, "message": "Projects fetched", "data": data}
