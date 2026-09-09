from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any, List
from app.core.database import get_db
from app.api.dependencies import get_current_active_user, get_admin_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/me", response_model=dict)
async def read_users_me(current_user: User = Depends(get_current_active_user)) -> Any:
    return {
        "success": True, 
        "message": "User fetched", 
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "is_active": current_user.is_active
        }
    }

@router.get("/", response_model=dict)
async def read_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)) -> Any:
    result = await db.execute(select(User))
    users = result.scalars().all()
    data = [{"id": u.id, "email": u.email, "role": u.role} for u in users]
    return {"success": True, "message": "Users fetched", "data": data}
