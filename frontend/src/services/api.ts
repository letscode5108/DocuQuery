import axios from 'axios';

// Configure axios base URL
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Document {
  id: number;
  title: string;
  filename: string;
  cloudinary_url: string;
  public_id: string;
  file_size: number;
  mime_type: string;
  user_id: number;
  created_at: string;
}

export interface Query {
  id: number;
  question: string;
  answer: string;
  document_id: number;
  session_id?: number;
  created_at: string;
}

export interface Session {
  session_id: string;
  document_id: number;
}

export interface QueryRequest {
  question: string;
  document_id: number;
}

// API functions
export const documentApi = {
  // Get all documents
  getDocuments: async (): Promise<Document[]> => {
    const response = await api.get('/documents/');
    return response.data;
  },
  
  // Get document by ID
  getDocument: async (id: number): Promise<Document> => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },
  
  // Upload document
  uploadDocument: async (formData: FormData): Promise<Document> => {
    const response = await api.post('/documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Get queries for a document
  getDocumentQueries: async (documentId: number): Promise<Query[]> => {
    const response = await api.get(`/queries/${documentId}`);
    return response.data;
  },
  
  // Ask a question directly (not in a session)
  askQuestion: async (query: QueryRequest): Promise<Query> => {
    const response = await api.post('/query/', query);
    return response.data;
  },
  
  // Create a session
  createSession: async (documentId: number): Promise<{ session_id: string; document_id: number }> => {
    const response = await api.post('/sessions/', { document_id: documentId });
    return response.data;
  },
  
  // Ask a question in a session
  askSessionQuestion: async (sessionId: string, question: string): Promise<Query> => {
    const formData = new FormData();
    formData.append('question', question);
    
    const response = await api.post(`/sessions/${sessionId}/query`, formData);
    return response.data;
  }
};

export default api;