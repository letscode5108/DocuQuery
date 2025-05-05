# models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

# Base = declarative_base()
from database import Base
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    documents = relationship("Document", back_populates="owner")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    filename = Column(String)
    cloudinary_url = Column(String)
    public_id = Column(String)  # Cloudinary public_id
    file_size = Column(Integer)
    mime_type = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    #updated_at = Column(DateTime, default=datetime.utc, onupdate=datetime.utc)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="documents")
    queries = relationship("Query", back_populates="document")

class Query(Base):
    __tablename__ = "queries"
    
    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text)
    answer = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    document_id = Column(Integer, ForeignKey("documents.id"))
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    
    document = relationship("Document", back_populates="queries")
    session = relationship("Session", back_populates="queries")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    document = relationship("Document")
    queries = relationship("Query", back_populates="session")