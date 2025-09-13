# import os
# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
# from dotenv import load_dotenv

# # Load environment variables
# load_dotenv()

# # Get database URL from environment variable
# DATABASE_URL = os.getenv("DATABASE_URL")
# print(f"Database URL: {DATABASE_URL}")


# # Create SQLAlchemy engine
# engine = create_engine(DATABASE_URL)

# # Create session factory
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# # Create base class for models
# Base = declarative_base()

# # Dependency to get DB session
# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv()
# Your Neon database connection string - ensure this is correctly set
DATABASE_URL = os.getenv("DATABASE_URL")


# Create engine with improved connection settings
engine = create_engine(
    DATABASE_URL,
    pool_size=5,               
    max_overflow=10,           
    pool_timeout=30,           
    pool_recycle=60,           
    pool_pre_ping=True,        
    connect_args={
        "application_name": "ai_planet_app",
        "connect_timeout": 10,                
        "keepalives": 1,                      
        "keepalives_idle": 30,                
        "keepalives_interval": 10,            
        "keepalives_count": 5                
    }
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Function to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Only run this if directly executing this file
if __name__ == "__main__":
    # Test connection
    try:
        with engine.connect() as connection:
            from sqlalchemy import text
            result = connection.execute(text("SELECT 1")).fetchone()
            print(f"Database connection successful: {result}")
    except Exception as e:
        print(f" Database connection failed: {e}")