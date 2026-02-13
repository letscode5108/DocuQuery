# schemas.py
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    title: str

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    filename: str
    cloudinary_url: str
    file_size: int
    mime_type: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class QueryBase(BaseModel):
    question: str
    document_id: Optional[int] = None

class QueryCreate(QueryBase):
    pass

class QueryResponse(QueryBase):
    id: int
    answer: str
    created_at: datetime
    
    class Config:
        from_attributes = True