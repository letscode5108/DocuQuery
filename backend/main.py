# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import cloudinary
import os
from dotenv import load_dotenv

from database import engine, Base, SessionLocal
from models import User, Document, Query, Session as models

from router import router

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Create tables in the database
Base.metadata.create_all(bind=engine)

# Create default user if not exists
db = SessionLocal()
try:
    default_user = db.query(User).filter(User.id == 1).first()
    if not default_user:
        default_user = User(
            id=1,
           
        )
        db.add(default_user)
        db.commit()
        print(" Default user created successfully")
    else:
        print(" Default user already exists")
except Exception as e:
    print(f" Error creating default user: {e}")
    db.rollback()
finally:
    db.close()

# Initialize FastAPI app
app = FastAPI(title="PDF Question Answering API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to the PDF Question Answering API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)