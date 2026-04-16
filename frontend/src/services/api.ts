import axios from 'axios';

const API_BASE =  `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;

const api = axios.create({ baseURL: API_BASE });



// ─── Attach JWT to every request ─────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth Types ───────────────────────────────────────────────────────────────
export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const fd = new FormData();
    fd.append('username', email); // OAuth2PasswordRequestForm expects 'username'
    fd.append('password', password);
    const { data } = await api.post('/auth/token', fd);
    return data;
  },

  register: async (email: string, password: string): Promise<RegisterResponse> => {
    const { data } = await api.post(`/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
    return data;
  },

  logout: () => localStorage.removeItem('token'),

  isLoggedIn: () => !!localStorage.getItem('token'),
};

// ... rest of your existing types and documentApi unchanged
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
  document_id: number | null;
  created_at: string;
}

export interface MediaQueryTimestamp {
  start: number;
  end: number;
  display: string;
}

export interface MediaQueryResponse {
  id: number;
  question: string;
  answer: string;
  document_id: number;
  timestamp: MediaQueryTimestamp;
  cloudinary_url: string;
  created_at: string;
}

export interface AllQuerySource {
  document_id: number;
  document_title: string;
  filename: string;
  relevance_score: number;
  mime_type: string;
  cloudinary_url: string;
  timestamp: MediaQueryTimestamp | null;
}

export interface AllQueryResponse {
  id: number;
  question: string;
  answer: string;
  document_id: null;
  created_at: string;
  sources: AllQuerySource[];
}

export interface MediaUploadResponse {
  id: number;
  title: string;
  filename: string;
  cloudinary_url: string;
  file_size: number;
  mime_type: string;
  media_type: 'audio' | 'video';
  segment_count: number;
  transcript_preview: string;
  created_at: string;
}

export interface SummaryResponse {
  document_id: number;
  title: string;
  mime_type: string;
  summary: string;
}

export interface TimestampEntry {
  start: number;
  end: number;
  display: string;
  text: string;
  relevance_score: number;
  cloudinary_url: string;
}

export interface TimestampResponse {
  topic: string;
  document_id: number;
  title: string;
  timestamps: TimestampEntry[];
}

export interface QueryCreate {
  question: string;
  document_id: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/webm'];
const VIDEO_MIMES = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm', 'video/quicktime'];

export const isMediaFile = (doc: Document): boolean =>
  AUDIO_MIMES.some(m => doc.mime_type?.includes(m.split('/')[1])) ||
  VIDEO_MIMES.some(m => doc.mime_type?.startsWith('video/')) ||
  doc.mime_type?.startsWith('audio/');

export const isVideoFile = (doc: Document): boolean =>
  doc.mime_type?.startsWith('video/');

// ─── API calls ────────────────────────────────────────────────────────────────

export const documentApi = {
  // Documents
  getDocuments: async (): Promise<Document[]> => {
    const { data } = await api.get('/documents/');
    return data;
  },

  getDocument: async (id: number): Promise<Document> => {
    const { data } = await api.get(`/documents/${id}`);
    return data;
  },

  uploadDocument: async (formData: FormData): Promise<Document> => {
    const { data } = await api.post('/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  uploadMedia: async (formData: FormData): Promise<MediaUploadResponse> => {
    const { data } = await api.post('/media/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Q&A
  askQuestion: async (query: QueryCreate): Promise<Query> => {
    const { data } = await api.post('/query/', query);
    return data;
  },

  askMediaQuestion: async (documentId: number, question: string): Promise<MediaQueryResponse> => {
    const fd = new FormData();
    fd.append('document_id', String(documentId));
    fd.append('question', question);
    const { data } = await api.post('/query-media/', fd);
    return data;
  },

  askAllDocuments: async (question: string): Promise<AllQueryResponse> => {
    const fd = new FormData();
    fd.append('question', question);
    const { data } = await api.post('/query-all/', fd);
    return data;
  },

  // Queries history
  getDocumentQueries: async (documentId: number): Promise<Query[]> => {
    const { data } = await api.get(`/queries/${documentId}`);
    return data;
  },

  getAllDocsQueries: async (): Promise<AllQueryResponse[]> => {
    const { data } = await api.get('/queries/all');
    return data;
  },

  // Summarize
  summarize: async (documentId: number): Promise<SummaryResponse> => {
    const fd = new FormData();
    fd.append('document_id', String(documentId));
    const { data } = await api.post('/summarize/', fd);
    return data;
  },

  // Timestamps
  getTimestamps: async (documentId: number, topic: string): Promise<TimestampResponse> => {
    const fd = new FormData();
    fd.append('document_id', String(documentId));
    fd.append('topic', topic);
    const { data } = await api.post('/timestamps/', fd);
    return data;
  },
};