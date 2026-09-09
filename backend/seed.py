import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user import User, RoleEnum
from app.models.classroom import ClassroomSession, StudentSession, AttentionEvent, Alert
from app.core.security import get_password_hash

async def seed_db():
    print("Creating tables (if using local PG for testing, otherwise use Alembic for Supabase)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("Seeding default user...")
    async with AsyncSessionLocal() as db:
        user = User(
            email="admin@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Admin User",
            role=RoleEnum.ADMIN
        )
        db.add(user)
        try:
            await db.commit()
            print("Successfully seeded user!")
            print("Email: admin@example.com")
            print("Password: password123")
        except Exception as e:
            print("User already exists or error occurred:", e)

if __name__ == "__main__":
    asyncio.run(seed_db())
