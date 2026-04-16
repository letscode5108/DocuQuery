import json 

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
from groq import Groq
from google import genai
from pinecone import Pinecone, ServerlessSpec
import io
import tempfile
import subprocess
from auth import get_current_user
load_dotenv()

from database import get_db
import models
import schemas


# Service configuration


cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Groq — for text generation 
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Gemini —   for embeddings 
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_NAME = "pdf-documents"


if INDEX_NAME in pc.list_indexes().names():
    try:
        index_info = pc.describe_index(INDEX_NAME)
        if index_info.dimension != 3072:
            print(f"Deleting old index with dimension {index_info.dimension}")
            pc.delete_index(INDEX_NAME)
            print("Old index deleted")
    except Exception:
        pass

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


ALLOWED_AUDIO_TYPES = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"}
ALLOWED_VIDEO_TYPES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
ALLOWED_MEDIA_TYPES = ALLOWED_AUDIO_TYPES | ALLOWED_VIDEO_TYPES


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
            chunks.append(text[start:end])
            start += self.chunk_size - self.chunk_overlap
        return chunks


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    text = ""
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting text: {str(e)}")
    return text


def get_embeddings(texts: List[str]) -> List[list]:
    """Embed texts using Gemini embedding-001 (3072-dim)."""
    try:
        embeddings = []
        for text in texts:
            result = gemini_client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text
            )
            embeddings.append(result.embeddings[0].values)
        return embeddings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")


def groq_generate(prompt: str, max_tokens: int = 1024) -> str:
    """Generate text using Groq LLaMA 3.3 70B."""
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens
    )
    return response.choices[0].message.content.strip()


def create_vectorstore(text: str, document_id: int) -> int:
    """Chunk text, embed, and upsert into Pinecone under doc namespace."""
    try:
        splitter = SimpleTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_text(text)
        embeddings = get_embeddings(chunks)

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

        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            index.upsert(vectors=vectors[i:i + batch_size], namespace=f"doc_{document_id}")

        return len(vectors)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector store error: {str(e)}")


def create_media_vectorstore(segments: List[dict], document_id: int) -> int:
    """
    Embed transcript segments and upsert into Pinecone.
    Each segment dict: {text, start, end}
    Timestamp metadata is stored alongside the text so Q&A can return seek positions.
    """
    try:
        texts = [seg["text"] for seg in segments]
        embeddings = get_embeddings(texts)

        vectors = []
        for i, (seg, embedding) in enumerate(zip(segments, embeddings)):
            vectors.append({
                "id": f"doc_{document_id}_seg_{i}",
                "values": embedding,
                "metadata": {
                    "document_id": document_id,
                    "segment_index": i,
                    "text": seg["text"],
                    "start": seg.get("start", 0.0),   # seconds (float)
                    "end": seg.get("end", 0.0),
                }
            })

        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            index.upsert(vectors=vectors[i:i + batch_size], namespace=f"doc_{document_id}")

        return len(vectors)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Media vector store error: {str(e)}")


def transcribe_with_groq(audio_bytes: bytes, filename: str) -> List[dict]:
    """Transcribe audio using Groq Whisper with timestamp segments."""
    try:
        audio_file = (filename, io.BytesIO(audio_bytes), "audio/mpeg")

        transcription = groq_client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3",
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )

        segments = []
        raw_segments = getattr(transcription, "segments", None)

        if raw_segments:
            for seg in raw_segments:
                if isinstance(seg, dict):
                    segments.append({
                        "text": seg["text"].strip(),
                        "start": float(seg["start"]),
                        "end": float(seg["end"])
                    })
                else:
                    segments.append({
                        "text": seg.text.strip(),
                        "start": float(seg.start),
                        "end": float(seg.end)
                    })
        else:
            full_text = transcription.text if hasattr(transcription, "text") else transcription["text"]
            segments = [{"text": full_text.strip(), "start": 0.0, "end": 0.0}]

        return segments

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")


def extract_audio_from_video(video_bytes: bytes, original_filename: str) -> tuple[bytes, str]:
    """
    Extract audio track from video using ffmpeg (must be installed on server).
    Returns (audio_bytes, audio_filename).
    """
    ext = os.path.splitext(original_filename)[1].lower()
    tmp_video_path = None
    tmp_audio_path = None
    
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_video:
            tmp_video.write(video_bytes)
            tmp_video_path = tmp_video.name

        tmp_audio_path = tmp_video_path.replace(ext, ".mp3")

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", tmp_video_path,
                "-vn",                   
                "-acodec", "libmp3lame",
                "-ar", "16000",          
                "-ac", "1",              
                tmp_audio_path
            ],
            check=True,
            capture_output=True
        )

        with open(tmp_audio_path, "rb") as f:
            audio_bytes = f.read()

        return audio_bytes, os.path.basename(tmp_audio_path)

    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"ffmpeg error extracting audio: {e.stderr.decode()}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video processing error: {str(e)}")
    finally:
        for path in [tmp_video_path, tmp_audio_path]:
            if path:
                try:
                    os.unlink(path)
                except Exception:
                    pass


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS display string."""
    minutes = int(seconds) // 60
    secs = int(seconds) % 60
    return f"{minutes:02d}:{secs:02d}"



@router.post("/documents/", response_model=schemas.DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload PDF, process it, and store vectors in Pinecone."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files allowed on this endpoint. Use /media/ for audio/video."
        )

    try:
        file_bytes = await file.read()
        file_size = len(file_bytes)

        if not title or title.strip() == "":
            title = file.filename.replace(".pdf", "").replace("_", " ").replace("-", " ")

        public_id = f"pdf_docs/{str(uuid.uuid4())}"
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            resource_type="auto",
            public_id=public_id,
            folder="pdf_documents",
            access_mode="public"
        )

        text = extract_text_from_pdf(file_bytes)

        db_document = models.Document(
            title=title,
            filename=file.filename,
            cloudinary_url=upload_result.get("secure_url"),
            public_id=upload_result.get("public_id"),
            file_size=file_size,
            mime_type="application/pdf",
            user_id=current_user.id
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)

        create_vectorstore(text, db_document.id)

        return db_document

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")



@router.post("/media/")
async def upload_media(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Upload an audio or video file.
    - Audio: transcribed directly with Groq Whisper
    - Video: audio extracted with ffmpeg, then transcribed
    Transcript segments (with timestamps) are embedded and stored in Pinecone.
    """
    filename_lower = file.filename.lower()
    ext = os.path.splitext(filename_lower)[1]

    if ext not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_MEDIA_TYPES))}"
        )

    is_video = ext in ALLOWED_VIDEO_TYPES

    try:
        file_bytes = await file.read()
        file_size = len(file_bytes)

        if not title or title.strip() == "":
            title = os.path.splitext(file.filename)[0].replace("_", " ").replace("-", " ")

        # Upload original file to Cloudinary
        resource_type = "video"
        public_id = f"media_docs/{str(uuid.uuid4())}"
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            resource_type=resource_type,
            public_id=public_id,
            folder="media_documents",
            access_mode="public"
        )
        cloudinary_url = upload_result.get("secure_url")

        # Extract audio from video if needed
        if is_video:
            audio_bytes, audio_filename = extract_audio_from_video(file_bytes, file.filename)
        else:
            audio_bytes = file_bytes
            audio_filename = file.filename

        # Transcribe with Groq Whisper
        segments = transcribe_with_groq(audio_bytes, audio_filename)

        # Build full transcript text for DB storage
        full_transcript = " ".join([seg["text"] for seg in segments])

        # Save to DB
        mime_type = f"{'video' if is_video else 'audio'}/{ext.lstrip('.')}"
        db_document = models.Document(
            title=title,
            filename=file.filename,
            cloudinary_url=cloudinary_url,
            public_id=upload_result.get("public_id"),
            file_size=file_size,
            mime_type=mime_type,
            user_id=current_user.id
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)

        # Embed segments with timestamps into Pinecone
        segment_count = create_media_vectorstore(segments, db_document.id)

        return {
            "id": db_document.id,
            "title": db_document.title,
            "filename": db_document.filename,
            "cloudinary_url": cloudinary_url,
            "file_size": file_size,
            "mime_type": mime_type,
            "media_type": "video" if is_video else "audio",
            "segment_count": segment_count,
            "transcript_preview": full_transcript[:300] + "..." if len(full_transcript) > 300 else full_transcript,
            "created_at": db_document.created_at
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Media upload error: {str(e)}")



@router.post("/query/", response_model=schemas.QueryResponse)
async def ask_question(
    query: schemas.QueryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Ask question about a single PDF document using Groq."""
    document = db.query(models.Document).filter(
        models.Document.id == query.document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        query_result = gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=query.question
        )
        query_embedding = query_result.embeddings[0].values

        results = index.query(
            vector=query_embedding,
            top_k=3,
            namespace=f"doc_{query.document_id}",
            include_metadata=True
        )

        context = "\n\n".join([match["metadata"]["text"] for match in results["matches"]])

        prompt = f"""Based on the following context, answer the question.
If the answer isn't in the context, say "I cannot find the answer in the document."

Context:
{context}

Question: {query.question}

Answer:"""

        answer = groq_generate(prompt)

        db_query = models.Query(
            question=query.question,
            answer=answer,
            document_id=query.document_id,
            user_id=current_user.id
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Ask a question across ALL user's documents (PDFs, audio, video).
    Returns answer with sources including timestamps for media files.
    """
    all_documents = db.query(models.Document).filter(
        models.Document.user_id == current_user.id
    ).all()
    
    if not all_documents:
        raise HTTPException(status_code=404, detail="No documents found")

    
    doc_map = {doc.id: doc for doc in all_documents}

    try:
        # Embed the question
        query_result = gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=question
        )
        query_embedding = query_result.embeddings[0].values

       
        all_results = []
        for doc in all_documents:
            try:
                results = index.query(
                    vector=query_embedding,
                    top_k=3,
                    namespace=f"doc_{doc.id}",
                    include_metadata=True
                )
                for match in results.get("matches", []):
                    match["document_title"] = doc.title
                    match["document_id"] = doc.id
                    match["document_filename"] = doc.filename
                    match["mime_type"] = doc.mime_type
                    all_results.append(match)
            except Exception:
                continue

        if not all_results:
            raise HTTPException(status_code=404, detail="No relevant content found")

        # Sort by relevance
        all_results.sort(key=lambda x: x["score"], reverse=True)
        
        # Filter by relevance threshold
        all_results = [r for r in all_results if r["score"] >= 0.4]

        # Deduplicate by document (keep highest score per document)
        seen_docs = {}
        deduped_results = []
        for r in all_results:
            doc_id = r["document_id"]
            if doc_id not in seen_docs:
                seen_docs[doc_id] = True
                deduped_results.append(r)

        top_results = deduped_results[:6]

        # Build context with timestamps for media files
        context_parts = []
        for i, match in enumerate(top_results, 1):
            meta = match["metadata"]
            is_media = match["mime_type"] and not match["mime_type"].startswith("application/pdf")
            
            if is_media and "start" in meta:
                ts = f"[{format_timestamp(meta['start'])} → {format_timestamp(meta['end'])}]"
                context_parts.append(
                    f"[Source {i}: {match['document_title']}] {ts}\n{meta['text']}"
                )
            else:
                context_parts.append(
                    f"[Source {i}: {match['document_title']}]\n{meta['text']}"
                )
        
        context = "\n\n".join(context_parts)

        # Generate answer with Groq
        prompt = f"""Based on the following context from multiple documents (PDFs, audio, and video),
answer the question. When answering, refer to sources by their document name.
For media sources, mention the timestamp where the answer is discussed.

Context:
{context}

Question: {question}

Answer:"""

        answer = groq_generate(prompt)

        # Build sources list with media timestamps
        unique_sources = {}
        for match in top_results:
            doc_id = match["document_id"]
            meta = match["metadata"]
            doc = doc_map[doc_id]
            is_media = match["mime_type"] and not match["mime_type"].startswith("application/pdf")

            source_entry = {
                "document_id": doc_id,
                "document_title": match["document_title"],
                "filename": match["document_filename"],
                "relevance_score": float(match["score"]),
                "mime_type": match["mime_type"],
                "cloudinary_url": doc.cloudinary_url,
            }

            # Add timestamp for media files
            if is_media and "start" in meta:
                source_entry["timestamp"] = {
                    "start": meta.get("start", 0.0),
                    "end": meta.get("end", 0.0),
                    "display": format_timestamp(meta.get("start", 0.0))
                }
            else:
                source_entry["timestamp"] = None

            if doc_id not in unique_sources or match["score"] > unique_sources[doc_id]["relevance_score"]:
                unique_sources[doc_id] = source_entry

        sources = sorted(unique_sources.values(), key=lambda x: x["relevance_score"], reverse=True)

        # Save query to database
        db_query = models.Query(
            question=question,
            answer=answer,
            document_id=None,  # Cross-document query
            user_id=current_user.id,
            sources=json.dumps(sources)
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



@router.post("/query-media/")
async def ask_question_media(
    document_id: int = Form(...),
    question: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Ask a question about an audio/video file.
    Returns answer + timestamp (start_time in seconds) so the frontend
    can seek the media player to the exact moment.
    """
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # Embed the question
        query_result = gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=question
        )
        query_embedding = query_result.embeddings[0].values

        # Search Pinecone for the most relevant segments
        results = index.query(
            vector=query_embedding,
            top_k=4,
            namespace=f"doc_{document_id}",
            include_metadata=True
        )

        if not results["matches"]:
            raise HTTPException(status_code=404, detail="No relevant content found in this media file.")

        # Sort matches by timestamp so context flows chronologically
        matches = sorted(results["matches"], key=lambda m: m["metadata"].get("start", 0))

        # Build context with timestamps
        context_parts = []
        for match in matches:
            meta = match["metadata"]
            start = meta.get("start", 0.0)
            end = meta.get("end", 0.0)
            ts = f"[{format_timestamp(start)} → {format_timestamp(end)}]"
            context_parts.append(f"{ts} {meta['text']}")

        context = "\n".join(context_parts)

        prompt = f"""You are answering questions about a transcript from an audio/video file.
Each section of the transcript is prefixed with a timestamp in [MM:SS → MM:SS] format.

Based on the transcript below, answer the question.
If the answer isn't in the transcript, say "I cannot find the answer in this media file."
Be concise and mention the approximate timestamp where the answer is discussed.

Transcript:
{context}

Question: {question}

Answer:"""

        answer = groq_generate(prompt)

        # The best timestamp = start of the top-scoring segment
        top_match = max(results["matches"], key=lambda m: m["score"])
        best_start = top_match["metadata"].get("start", 0.0)
        best_end = top_match["metadata"].get("end", 0.0)

        # Save to DB
        db_query = models.Query(
            question=question,
            answer=answer,
            document_id=document_id,
            user_id=current_user.id
        )
        db.add(db_query)
        db.commit()
        db.refresh(db_query)

        return {
            "id": db_query.id,
            "question": question,
            "answer": answer,
            "document_id": document_id,
            "timestamp": {
                "start": best_start,
                "end": best_end,
                "display": format_timestamp(best_start)
            },
            "cloudinary_url": document.cloudinary_url,
            "created_at": db_query.created_at
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Media query error: {str(e)}")



@router.post("/summarize/")
async def summarize_document(
    document_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Summarize any uploaded document — PDF, audio, or video.
    Fetches top chunks from Pinecone and generates a summary with Groq.
    """
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # Use a generic "summary" embedding query
        query_result = gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents="main topics summary overview key points"
        )
        query_embedding = query_result.embeddings[0].values

        results = index.query(
            vector=query_embedding,
            top_k=8,
            namespace=f"doc_{document_id}",
            include_metadata=True
        )

        if not results["matches"]:
            raise HTTPException(status_code=404, detail="No content found for this document.")

        is_media = document.mime_type and not document.mime_type.startswith("application/pdf")

        if is_media:
            # Sort by timestamp for coherent narrative
            matches = sorted(results["matches"], key=lambda m: m["metadata"].get("start", 0))
            context_parts = []
            for match in matches:
                meta = match["metadata"]
                start = meta.get("start", 0.0)
                ts = f"[{format_timestamp(start)}]"
                context_parts.append(f"{ts} {meta['text']}")
            context = "\n".join(context_parts)

            prompt = f"""Summarize the following audio/video transcript. 
Highlight the main topics discussed and the key points made.
Keep it concise (3-5 sentences or bullet points).

Transcript:
{context}

Summary:"""
        else:
            context = "\n\n".join([m["metadata"]["text"] for m in results["matches"]])
            prompt = f"""Summarize the following document content.
Highlight the main topics and key points.
Keep it concise (3-5 sentences or bullet points).

Content:
{context}

Summary:"""

        summary = groq_generate(prompt, max_tokens=512)

        return {
            "document_id": document_id,
            "title": document.title,
            "mime_type": document.mime_type,
            "summary": summary
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarize error: {str(e)}")



@router.post("/timestamps/")
async def get_timestamps(
    document_id: int = Form(...),
    topic: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Find all timestamps in an audio/video file where a topic is discussed.
    Returns a list of {start, end, display, text} objects — 
    the frontend can render each as a clickable seek button.
    """
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        query_result = gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=topic
        )
        query_embedding = query_result.embeddings[0].values

        results = index.query(
            vector=query_embedding,
            top_k=8,
            namespace=f"doc_{document_id}",
            include_metadata=True
        )

        if not results["matches"]:
            return {"topic": topic, "timestamps": [], "document_id": document_id}

        # Filter by relevance threshold and sort chronologically
        relevant = [m for m in results["matches"] if m["score"] >= 0.4]
        relevant.sort(key=lambda m: m["metadata"].get("start", 0))

        timestamps = []
        for match in relevant:
            meta = match["metadata"]
            start = meta.get("start", 0.0)
            end = meta.get("end", 0.0)
            timestamps.append({
                "start": start,
                "end": end,
                "display": format_timestamp(start),
                "text": meta["text"],
                "relevance_score": round(float(match["score"]), 3),
                "cloudinary_url": document.cloudinary_url
            })

        return {
            "topic": topic,
            "document_id": document_id,
            "title": document.title,
            "timestamps": timestamps
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timestamp error: {str(e)}")



@router.get("/documents/", response_model=List[schemas.DocumentResponse])
async def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all documents for the current user."""
    return db.query(models.Document).filter(
        models.Document.user_id == current_user.id
    ).all()




@router.get("/documents/{document_id}", response_model=schemas.DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific document by ID."""
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document


@router.get("/queries/all")
async def get_all_docs_queries(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all cross-document queries for the current user."""
    queries = db.query(models.Query).filter(
        models.Query.document_id == None,  # Cross-document queries only
        models.Query.user_id == current_user.id
    ).order_by(models.Query.created_at.desc()).all()

    return [
        {
            "id": q.id,
            "question": q.question,
            "answer": q.answer,
            "document_id": q.document_id,
            "created_at": q.created_at,
            "sources": json.loads(q.sources) if q.sources else []
        }
        for q in queries
    ]




@router.get("/queries/{document_id}", response_model=List[schemas.QueryResponse])
async def get_document_queries(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all queries for a specific document."""
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return db.query(models.Query).filter(
        models.Query.document_id == document_id,
        models.Query.user_id == current_user.id
    ).all()



@router.post("/sessions/", response_model=dict)
async def create_session(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a chat session for a specific document."""
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    session_id = str(uuid.uuid4())
    db_session = models.Session(session_id=session_id, document_id=document_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    return {"session_id": session_id, "document_id": document_id}


@router.post("/sessions/{session_id}/query", response_model=schemas.QueryResponse)
async def session_query(
    session_id: str,
    question: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Ask a question within a session context."""
    session = db.query(models.Session).filter(
        models.Session.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.last_accessed = datetime.now()
    db.commit()

    query = schemas.QueryCreate(question=question, document_id=session.document_id)
    response = await ask_question(query, db)

    db_query = db.query(models.Query).filter(models.Query.id == response.id).first()
    db_query.session_id = session.id
    db.commit()

    return response




@router.get("/test-embedding")
async def test_embedding():
    """Test Gemini embedding connection."""
    try:
        result = gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents="test text"
        )
        return {"type": str(type(result)), "dir": dir(result), "result": str(result)}
    except Exception as e:
        return {"error": str(e)}


@router.get("/test-groq")
async def test_groq():
    """Verify Groq connection is working."""
    try:
        answer = groq_generate("Say hello in one sentence.")
        return {"status": "ok", "response": answer}
    except Exception as e:
        return {"error": str(e)}