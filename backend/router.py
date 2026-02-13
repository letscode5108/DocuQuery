import requests
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import fitz  # PyMuPDF
import cloudinary
import cloudinary.uploader
import uuid
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from pinecone import Pinecone, ServerlessSpec
import io

load_dotenv()

from database import get_db
import models
import schemas

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Google AI configuration
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Pinecone configuration
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_NAME = "pdf-documents"

# Delete old index if it exists with wrong dimension
if INDEX_NAME in pc.list_indexes().names():
    try:
        index_info = pc.describe_index(INDEX_NAME)
        if index_info.dimension != 3072:  
            print(f"Deleting old index with dimension {index_info.dimension}")
            pc.delete_index(INDEX_NAME)
            print("Old index deleted")
    except:
        pass

# Create index if it doesn't exist
if INDEX_NAME not in pc.list_indexes().names():
    pc.create_index(
        name=INDEX_NAME,
        dimension=3072,  
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")
    )
    print("New index created with dimension 3072")

index = pc.Index(INDEX_NAME)

router = APIRouter()


class SimpleTextSplitter:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def split_text(self, text):
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + self.chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += self.chunk_size - self.chunk_overlap
        
        return chunks


def extract_text_from_pdf(file_bytes):
    """Extract text from PDF bytes using PyMuPDF"""
    text = ""
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting text: {str(e)}")
    return text


def get_embeddings(texts: List[str]):
    """Get embeddings using Google's gemini-embedding-001 model"""
    try:
        embeddings = []
        for text in texts:
            result = client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text
            )
            # Access the values list
            embeddings.append(result.embeddings[0].values)
        return embeddings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")
def create_vectorstore(text, document_id):
    """Create vectors and upload to Pinecone"""
    try:
        text_splitter = SimpleTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_text(text)
        
        # Get embeddings for all chunks
        embeddings = get_embeddings(chunks)
        
        # Prepare vectors for Pinecone
        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vectors.append({
                "id": f"doc_{document_id}_chunk_{i}",
                "values": embedding,
                "metadata": {
                    "document_id": document_id,
                    "chunk_index": i,
                    "text": chunk
                }
            })
        
        # Upsert to Pinecone in batches
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            index.upsert(vectors=batch, namespace=f"doc_{document_id}")
        
        return len(vectors)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector store error: {str(e)}")

@router.post("/documents/", response_model=schemas.DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),  
    db: Session = Depends(get_db)
):
    """Upload PDF, process it, and store vectors in Pinecone"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files allowed"
        )
    
    try:
        # Read file into memory
        file_bytes = await file.read()
        file_size = len(file_bytes)
        
        # Use provided title or extract from filename
        if not title or title.strip() == '':
            # Remove .pdf extension and clean up filename
            title = file.filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ')
        
        # Upload to Cloudinary
        public_id = f"pdf_docs/{str(uuid.uuid4())}"
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            resource_type="raw",
            public_id=public_id,
            folder="pdf_documents",
            access_mode="public"
        )
        
        # Extract text
        text = extract_text_from_pdf(file_bytes)
        
        # Create DB entry
        db_document = models.Document(
            title=title,
            filename=file.filename,
            cloudinary_url=upload_result.get("secure_url"),
            public_id=upload_result.get("public_id"),
            file_size=file_size,
            mime_type="application/pdf",
            user_id=1
        )
        
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        # Process and upload to Pinecone
        chunk_count = create_vectorstore(text, db_document.id)
        
        return db_document
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")





@router.post("/query/", response_model=schemas.QueryResponse)
async def ask_question(
    query: schemas.QueryCreate,
    db: Session = Depends(get_db)
):
    """Ask question about a document using Gemini"""
    document = db.query(models.Document).filter(models.Document.id == query.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Get query embedding
        query_result = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=query.question
        )
        query_embedding = query_result.embeddings[0].values  
        
        # Search Pinecone
        results = index.query(
            vector=query_embedding,
            top_k=3,
            namespace=f"doc_{query.document_id}",
            include_metadata=True
        )
        
        # Extract context
        context = "\n\n".join([match['metadata']['text'] for match in results['matches']])
        
        # Generate answer with Gemini
        prompt = f"""Based on the following context, answer the question. If the answer isn't in the context, say "I cannot find the answer in the document."

Context:
{context}

Question: {query.question}

Answer:"""
        
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=prompt
        )
        answer = response.text.strip()
        
        # Save to DB
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
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")

@router.post("/query-all/")
async def ask_question_all_documents(
    question: str = Form(...),
    db: Session = Depends(get_db)
):
    """Ask question across ALL documents"""
    
    all_documents = db.query(models.Document).all()
    
    if not all_documents:
        raise HTTPException(status_code=404, detail="No documents found")
    
    try:
        query_result = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=question
        )
        query_embedding = query_result.embeddings[0].values
        
        all_results = []
        for doc in all_documents:
            try:
                results = index.query(
                    vector=query_embedding,
                    top_k=3,  # Get top 3 chunks per document
                    namespace=f"doc_{doc.id}",
                    include_metadata=True
                )
                
                for match in results.get('matches', []):
                    match['document_title'] = doc.title
                    match['document_id'] = doc.id
                    match['document_filename'] = doc.filename
                    all_results.append(match)
            except:
                continue
        
        if not all_results:
            raise HTTPException(status_code=404, detail="No relevant content found")
        
        all_results.sort(key=lambda x: x['score'], reverse=True)
        top_results = all_results[:6]  # Use top 6 chunks for context
        
        # Build context
        context_parts = []
        for i, match in enumerate(top_results, 1):
            context_parts.append(
                f"[Source {i}: {match['document_title']}]\n{match['metadata']['text']}"
            )
        
        context = "\n\n".join(context_parts)
        
        # Generate answer
        prompt = f"""Based on the following context from multiple documents, answer the question. 
When answering, refer to sources by their document name.

Context:
{context}

Question: {question}

Answer:"""
        
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=prompt
        )
        answer = response.text.strip()
        
        #  Group by unique documents with highest relevance score
        unique_sources = {}
        for match in top_results:
            doc_id = match['document_id']
            if doc_id not in unique_sources or match['score'] > unique_sources[doc_id]['relevance_score']:
                unique_sources[doc_id] = {
                    "document_id": doc_id,
                    "document_title": match['document_title'],
                    "filename": match['document_filename'],
                    "relevance_score": float(match['score'])
                }
        
        # Convert to list and sort by relevance
        sources = sorted(unique_sources.values(), key=lambda x: x['relevance_score'], reverse=True)
        
        # Save to DB
        db_query = models.Query(
            question=question,
            answer=answer,
            document_id=None
        )
        
        db.add(db_query)
        db.commit()
        db.refresh(db_query)
        
        return {
            "id": db_query.id,
            "question": db_query.question,
            "answer": db_query.answer,
            "document_id": None,
            "created_at": db_query.created_at,
            "sources": sources  
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")



@router.get("/test-embedding")
async def test_embedding():
    """Test embedding to see response structure"""
    try:
        result = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents="test text"
        )
        return {
            "type": str(type(result)),
            "dir": dir(result),
            "result": str(result)
        }
    except Exception as e:
        return {"error": str(e)}
     

@router.get("/test-models")
async def test_models():
    """Test to see available models"""
    try:
        models_list = []
        for model in client.models.list():
            models_list.append(model.name)
        return {"available_models": models_list}
    except Exception as e:
        return {"error": str(e)}



@router.get("/queries/all")
async def get_all_docs_queries(db: Session = Depends(get_db)):
    """Get all queries where document_id is null (multi-doc queries)"""
    return db.query(models.Query).filter(
        models.Query.document_id == None
    ).order_by(models.Query.created_at.desc()).all()

@router.get("/documents/", response_model=List[schemas.DocumentResponse])
async def list_documents(db: Session = Depends(get_db)):
    """List all documents"""
    return db.query(models.Document).all()


@router.get("/documents/{document_id}", response_model=schemas.DocumentResponse)
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get specific document"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/queries/{document_id}", response_model=List[schemas.QueryResponse])
async def get_document_queries(document_id: int, db: Session = Depends(get_db)):
    """Get all queries for a document"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return db.query(models.Query).filter(models.Query.document_id == document_id).all()


@router.post("/sessions/", response_model=dict)
async def create_session(document_id: int, db: Session = Depends(get_db)):
    """Create new session"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    session_id = str(uuid.uuid4())
    
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
    """Query within a session"""
    session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.last_accessed = datetime.now()
    db.commit()
    
    query = schemas.QueryCreate(
        question=question,
        document_id=session.document_id
    )
    
    response = await ask_question(query, db)
    
    db_query = db.query(models.Query).filter(models.Query.id == response.id).first()
    db_query.session_id = session.id
    db.commit()
    
    return response