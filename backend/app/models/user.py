from sqlalchemy import Column, String, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base
from app.models.base import BaseModel

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    USER = "USER"

class User(BaseModel, Base):
    __tablename__ = "users"

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.USER, nullable=False)
    is_active = Column(Boolean, default=True)

    projects = relationship("Project", back_populates="owner")
    tasks = relationship("Task", back_populates="assignee")
