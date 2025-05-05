# PDF Document Q&A System

A full-stack application that allows users to upload PDF documents and ask questions about their content using AI-powered natural language processing.



## Features

- **PDF Upload**: Upload and store PDF documents
- **Document Management**: View, organize, and access your uploaded documents
- **AI-Powered Q&A**: Ask questions about your documents and receive accurate answers
- **Conversational Interface**: Follow-up questions and contextual understanding
- **Multi-Document Analysis**: Connect information across multiple documents
- **Semantic Search**: Find information based on meaning, not just keywords

## Technologies Used

### Backend
- **Framework**: FastAPI
- **NLP Processing**: LangChain
- **Database**: PostgreSQL
- **PDF Processing**: PyMuPDF
- **FileStorage**: Cloudinary

### Frontend
- **Framework**: React.js
- **Styling**: Tailwind CSS, shadcn


## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 14+ and npm
- Git
- Cloudinary
### Backend Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/pdf-qa-system.git
   cd pdf-qa-system/backend
   ```

2. Create and activate a virtual environment
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables
   ```bash
   # Create a .env file with the following variables
   DATABASE_URL=postgresql:///./app.db
   # Add any API keys for LLM services if needed
   ```

5. Initialize the database
   ```bash
   python init_db.py
   ```

6. Start the backend server
   ```bash
   uvicorn main:app --reload
   ```
   The backend will be running at http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory
   ```bash
   cd ../frontend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure the API endpoint
   ```bash
   # Create a .env file with the backend URL
   REACT_APP_API_URL=http://localhost:8000
   ```

4. Start the development server
   ```bash
   npm start
   ```
   The frontend will be running at http://localhost:3000









































































