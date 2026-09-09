from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.core.database import Base

class ClassroomSession(Base):
    __tablename__ = "classroom_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime(timezone=True), nullable=True)
    average_attention = Column(Float, nullable=True)
    peak_attention = Column(Float, nullable=True)
    lowest_attention = Column(Float, nullable=True)
    students_detected = Column(Integer, default=0)
    
    student_sessions = relationship("StudentSession", back_populates="session", cascade="all, delete-orphan")
    attention_events = relationship("AttentionEvent", back_populates="session", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="session", cascade="all, delete-orphan")

class StudentSession(Base):
    __tablename__ = "student_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("classroom_sessions.id"))
    anonymous_student_id = Column(String, index=True) # e.g. "Student 01"
    first_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    session = relationship("ClassroomSession", back_populates="student_sessions")
    attention_events = relationship("AttentionEvent", back_populates="student_session", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="student_session", cascade="all, delete-orphan")

class AttentionEvent(Base):
    __tablename__ = "attention_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("classroom_sessions.id"))
    student_session_id = Column(UUID(as_uuid=True), ForeignKey("student_sessions.id"))
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    attention_score = Column(Float)
    status = Column(String) # ATTENTIVE, PARTIALLY_ATTENTIVE, DISTRACTED
    head_pose = Column(String) # FORWARD, LEFT, RIGHT, UP, DOWN
    gaze = Column(String) # CENTER, LEFT, RIGHT, UP, DOWN
    eye_state = Column(String) # OPEN, CLOSED
    drowsiness = Column(Boolean, default=False)
    
    session = relationship("ClassroomSession", back_populates="attention_events")
    student_session = relationship("StudentSession", back_populates="attention_events")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("classroom_sessions.id"))
    student_session_id = Column(UUID(as_uuid=True), ForeignKey("student_sessions.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    type = Column(String) # SUSTAINED_LOW_ATTENTION, CLASS_DROP, CAMERA_WARNING
    message = Column(String)
    severity = Column(String) # LOW, MEDIUM, HIGH
    
    session = relationship("ClassroomSession", back_populates="alerts")
    student_session = relationship("StudentSession", back_populates="alerts")
