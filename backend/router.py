import requests
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import tempfile
import fitz  # PyMuPDF
import cloudinary
import cloudinary.uploader
from cloudinary import api as cloudinary_api 
import uuid
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
# Import necessary packages for the new pipeline approach
from langchain_community.llms import HuggingFacePipeline
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline

from database import get_db
import models
import schemas

router = APIRouter()

# Initialize HuggingFace embeddings
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")

# Initialize HuggingFace pipeline for language model
# This replaces the previous HuggingFaceHub initialization
try:
    model_id = "google/flan-t5-base"
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
    
    pipe = pipeline(
        "text2text-generation",
        model=model, 
        tokenizer=tokenizer,
        max_length=512,
        temperature=0.2,
    )
    
    llm = HuggingFacePipeline(pipeline=pipe)
    
except Exception as e:
    print(f"Error initializing language model: {str(e)}")
    # Provide a fallback or raise an exception based on your application's needs
    # For now, we'll set llm to None and check for it before use
    llm = None

# Document processing and vector store cache
document_vectorstores = {}

def extract_text_from_pdf(file_path):
    """Extract text from a PDF file using PyMuPDF"""
    text = ""
    try:
        with fitz.open(file_path) as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting text from PDF: {str(e)}")
    return text

def create_vectorstore(text, document_id):
    """Create a vector store from document text"""
    try:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(text)
        
        # Create vector store
        vectorstore = FAISS.from_texts(chunks, embeddings)
        
        # Cache the vector store with the document ID
        document_vectorstores[document_id] = vectorstore
        
        return vectorstore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating vector store: {str(e)}")

@router.post("/documents/", response_model=schemas.DocumentResponse)
async def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a PDF document, process it, and store in the database"""
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )
    
    try:
        # Save the uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(await file.read())
            temp_path = temp_file.name
        
        # Upload to Cloudinary
        public_id = f"pdf_docs/{str(uuid.uuid4())}"
        upload_result = cloudinary.uploader.upload(
            temp_path,
            resource_type="raw",
            public_id=public_id,
            type="upload",  
            folder="pdf_documents",
            access_mode="public"
        )
        
        # Get file size
        file_size = os.path.getsize(temp_path)
        
        # Extract text from PDF
        text = extract_text_from_pdf(temp_path)
        
        # Create database entry
        db_document = models.Document(
            title=title,
            filename=file.filename,
            cloudinary_url=upload_result.get("secure_url"),
            public_id=upload_result.get("public_id"),
            file_size=file_size,
            mime_type="application/pdf",
            user_id=1  # Default user for now, replace with authenticated user later
        )
        
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        # Process document and create vector store
        create_vectorstore(text, db_document.id)
        
        # Clean up the temporary file
        os.unlink(temp_path)
        
        return db_document
    
    except Exception as e:
        # Clean up temporary file if it exists
        if 'temp_path' in locals():
            os.unlink(temp_path)
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

@router.post("/query/", response_model=schemas.QueryResponse)
async def ask_question(
    query: schemas.QueryCreate,
    db: Session = Depends(get_db)
):
    """Process a question about a document and return the answer"""
    # Check if language model is available
    if llm is None:
        raise HTTPException(
            status_code=500, 
            detail="Language model is not initialized. Please check the server logs."
        )
    
    # Check if document exists
    document = db.query(models.Document).filter(models.Document.id == query.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Get vectorstore for document
        vectorstore = document_vectorstores.get(query.document_id)
        
        # If vectorstore doesn't exist in cache, recreate it
        if not vectorstore:
            # Create temporary file for downloading
            temp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                    temp_path = temp_file.name
                
                # Use requests to download the file from the Cloudinary URL
                response = requests.get(document.cloudinary_url)
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Error downloading file from Cloudinary: HTTP {response.status_code}"
                    )
                
                # Write content to temporary file
                with open(temp_path, 'wb') as f:
                    f.write(response.content)
                
                # Extract text
                text = extract_text_from_pdf(temp_path)
                
                # Create vector store
                vectorstore = create_vectorstore(text, document.id)
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
            finally:
                # Clean up temporary file
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
        
        # Create retrieval QA chain
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=False
        )
        
        # Get answer
        result = qa_chain({"query": query.question})
        answer = result.get("result", "Sorry, I couldn't find an answer based on the document.")
        
        # Save query to database
        db_query = models.Query(
            question=query.question,
            answer=answer,
            document_id=query.document_id
        )
        
        db.add(db_query)
        db.commit()
        db.refresh(db_query)
        
        return db_query
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

@router.get("/documents/", response_model=List[schemas.DocumentResponse])
async def list_documents(db: Session = Depends(get_db)):
    """List all uploaded documents"""
    documents = db.query(models.Document).all()
    return documents

@router.get("/documents/{document_id}", response_model=schemas.DocumentResponse)
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get a specific document by ID"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.get("/queries/{document_id}", response_model=List[schemas.QueryResponse])
async def get_document_queries(document_id: int, db: Session = Depends(get_db)):
    """Get all queries for a specific document"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    queries = db.query(models.Query).filter(models.Query.document_id == document_id).all()
    return queries

@router.post("/sessions/", response_model=dict)
async def create_session(document_id: int, db: Session = Depends(get_db)):
    """Create a new question-answering session for a document"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create session ID
    session_id = str(uuid.uuid4())
    
    # Create session in database
    db_session = models.Session(
        session_id=session_id,
        document_id=document_id
    )
    
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return {"session_id": session_id, "document_id": document_id}

@router.post("/sessions/{session_id}/query", response_model=schemas.QueryResponse)
async def session_query(
    session_id: str, 
    question: str = Form(...),
    db: Session = Depends(get_db)
):
    """Process a question within a session"""
    # Check if language model is available
    if llm is None:
        raise HTTPException(
            status_code=500, 
            detail="Language model is not initialized. Please check the server logs."
        )
    
    # Find session
    session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update last accessed time
    session.last_accessed = datetime.now()
    db.commit()
    
    # Create query object
    query = schemas.QueryCreate(
        question=question,
        document_id=session.document_id
    )
    
    # Process question and get answer
    response = await ask_question(query, db)
    
    # Update the query with session_id
    db_query = db.query(models.Query).filter(models.Query.id == response.id).first()
    db_query.session_id = session.id
    db.commit()
    
    return response





















































































































































































































































