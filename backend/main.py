# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import cloudinary
import os
from dotenv import load_dotenv

from database import engine, Base, SessionLocal
from models import User, Document, Query, Session as DbSession
from router import router
from auth_router import auth_router

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PDF Question Answering API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://docu-query-qv4p.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to the PDF Question Answering API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)