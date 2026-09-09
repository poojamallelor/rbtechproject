from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

Base = declarative_base()

engine = None
AsyncSessionLocal = None

if settings.SQLALCHEMY_DATABASE_URI:
    try:
        engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=True)
        AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    except Exception as e:
        print(f"[WARN] Database initialization skipped: {e}")

async def get_db():
    if AsyncSessionLocal is None:
        raise RuntimeError("Database connection not configured. Set DATABASE_URL in .env")
    async with AsyncSessionLocal() as session:
        yield session
