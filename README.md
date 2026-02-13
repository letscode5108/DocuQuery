# PDF Document Q&A System

A full-stack web application that allows users to upload PDF documents and ask questions about their content using AI-powered semantic search.

## 🌟 Features

- Upload multiple PDF documents
- Ask questions across all documents or specific documents
- AI-powered answers with source attribution
- View relevance scores for each source
- Beautiful, responsive UI

## 🛠️ Tech Stack

**Frontend:**
- React + TypeScript
- Vite
- Tailwind CSS
- Axios

**Backend:**
- FastAPI (Python)
- PostgreSQL (Neon)
- Pinecone (Vector Database)
- Google Gemini AI
- Cloudinary (File Storage)

## 🚀 Live Demo

- **Frontend:** https://docu-query-qv4p.vercel.app/
- **Backend:** https://docuquery-rcqs.onrender.com/

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL database (or Neon account)
- Google AI API key
- Pinecone API key
- Cloudinary account

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` file:
```env
GOOGLE_API_KEY=your_key
PINECONE_API_KEY=your_key
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
DATABASE_URL=postgresql://...
```

Run:
```bash
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
```

Create `.env`:
```env
VITE_API_URL=http://localhost:8000
```

Run:
```bash
npm run dev
```

## 📖 How It Works

1. **Upload:** Users upload PDF documents
2. **Process:** Backend extracts text and creates embeddings using Google Gemini
3. **Store:** Embeddings stored in Pinecone vector database
4. **Query:** User asks questions
5. **Search:** System searches across all documents using semantic similarity
6. **Answer:** Google Gemini generates answer with source attribution

## ✅ What's Done

- ✅ Full document upload system
- ✅ Multi-document search
- ✅ Source attribution with relevance scores
- ✅ Single document Q&A mode
- ✅ Responsive UI
- ✅ Production deployment

## ❌ What's Not Done

- ❌ User authentication
- ❌ Document deletion
- ❌ File type validation beyond .pdf
-
