# # init_db.py
# # from models import Base  # your models.py file
# # from database import engine  # your engine from the DB setup
# # 
# # print("⏳ Creating tables in Neon...")
# # Base.metadata.create_all(bind=engine)
# # print("✅ Tables created.")
# # 

# import psycopg2
# import time
# from sqlalchemy import create_engine, text

# # Replace with your actual Neon connection string
# DATABASE_URL = "postgresql://neondb_owner:npg_ExGsXbOuT6N4@ep-cold-term-a42ab29p-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# def test_direct_connection():
#     """Test direct psycopg2 connection"""
#     print("Testing direct psycopg2 connection...")
#     try:
#         conn = psycopg2.connect(DATABASE_URL)
#         cur = conn.cursor()
#         cur.execute("SELECT 1")
#         result = cur.fetchone()
#         print(f"✅ Direct connection successful: {result}")
#         cur.close()
#         conn.close()
#     except Exception as e:
#         print(f"❌ Direct connection failed: {e}")

# def test_sqlalchemy_connection():
#     """Test SQLAlchemy connection with pooling"""
#     print("\nTesting SQLAlchemy connection...")
#     try:
#         # Create engine with connection pooling options
#         engine = create_engine(
#             DATABASE_URL,
#             pool_pre_ping=True,  # Verify connection before using
#             pool_recycle=300,    # Recycle connections older than 5 minutes
#             connect_args={
#                 "connect_timeout": 10,  # Connection timeout in seconds
#                 "application_name": "connection_test"  # Identify in Neon dashboard
#             }
#         )
        
#         with engine.connect() as connection:
#             result = connection.execute(text("SELECT 1")).fetchone()
#             print(f"✅ SQLAlchemy connection successful: {result}")
#     except Exception as e:
#         print(f"❌ SQLAlchemy connection failed: {e}")

# def test_repeated_connections(attempts=5, delay=2):
#     """Test multiple connections with delay"""
#     print(f"\nTesting {attempts} repeated connections with {delay}s delay...")
    
#     engine = create_engine(
#         DATABASE_URL,
#         pool_pre_ping=True,
#         pool_recycle=300
#     )
    
#     success = 0
#     failures = 0
    
#     for i in range(1, attempts + 1):
#         try:
#             print(f"Attempt {i}: ", end="")
#             with engine.connect() as connection:
#                 result = connection.execute(text("SELECT 1")).fetchone()
#                 print(f"✅ Success: {result}")
#                 success += 1
#         except Exception as e:
#             print(f"❌ Failed: {e}")
#             failures += 1
        
#         if i < attempts:
#             time.sleep(delay)
    
#     print(f"\nResults: {success} successful, {failures} failed connections")

# if __name__ == "__main__":
#     test_direct_connection()
#     test_sqlalchemy_connection()
#     test_repeated_connections()