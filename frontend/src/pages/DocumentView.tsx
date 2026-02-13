import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Type definitions
interface Document {
  id: number;
  title: string;
  filename: string;
  cloudinary_url: string;
  public_id: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface Source {
  document_id: number;
  document_title: string;
  filename: string;
  relevance_score: number;
}

interface Query {
  id: number;
  question: string;
  answer: string;
  document_id: number | null;
  created_at: string;
  sources?: Source[];
}

const DocumentView: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentQueries, setDocumentQueries] = useState<Query[]>([]);
  const [allDocsQueries, setAllDocsQueries] = useState<Query[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'single' | 'all'>('all');
  const [viewMode, setViewMode] = useState<'chat' | 'allDocs'>('allDocs');
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchDocuments();
    fetchAllDocsQueries();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [documentQueries, allDocsQueries]);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/documents/`);
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    }
  };

  const fetchAllDocsQueries = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/queries/all`);
      setAllDocsQueries(response.data);
    } catch (err) {
      console.error('Error fetching all-docs queries:', err);
    }
  };

  const fetchDocumentDetails = async (documentId: number) => {
    try {
      const docResponse = await axios.get(`${API_BASE_URL}/api/documents/${documentId}`);
      setSelectedDocument(docResponse.data);
      
      const queriesResponse = await axios.get(`${API_BASE_URL}/api/queries/${documentId}`);
      setDocumentQueries(queriesResponse.data);
    } catch (err) {
      console.error('Error fetching document details:', err);
      setError('Failed to load document details');
    }
  };

  const handleDocumentSelect = async (documentId: number) => {
    await fetchDocumentDetails(documentId);
    setSearchMode('single');
    setViewMode('chat');
  };

  const handleAllDocsView = () => {
    setViewMode('allDocs');
    setSearchMode('all');
    setSelectedDocument(null);
    fetchAllDocsQueries();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      if (!documentTitle) {
        const autoTitle = selectedFile.name
          .replace('.pdf', '')
          .replace(/_/g, ' ')
          .replace(/-/g, ' ');
        setDocumentTitle(autoTitle);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a PDF file');
      return;
    }
    
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are allowed');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (documentTitle.trim()) {
        formData.append('title', documentTitle);
      }
      
      const response = await axios.post(`${API_BASE_URL}/api/documents/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      fetchDocuments();
      setFile(null);
      setDocumentTitle('');
      handleDocumentSelect(response.data.id);
      
    } catch (err) {
      console.error('Error uploading document:', err);
      setError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };
  
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const tempQuery: Query = {
        id: -Date.now(),
        question: question,
        answer: '...',
        document_id: (searchMode === 'single' && selectedDocument) ? selectedDocument.id : null,
        created_at: new Date().toISOString(),
      };
      
      // If in allDocs view or searchMode is 'all', always use allDocsQueries
      if (viewMode === 'allDocs' || searchMode === 'all') {
        setAllDocsQueries([...allDocsQueries, tempQuery]);
      } else {
        setDocumentQueries([...documentQueries, tempQuery]);
      }
      
      const formData = new FormData();
      formData.append('question', question);
      
      let response;
      
      // If in allDocs view or searchMode is 'all', use query-all endpoint
      if (viewMode === 'allDocs' || searchMode === 'all') {
        response = await axios.post(`${API_BASE_URL}/api/query-all/`, formData);
        setAllDocsQueries(queries => 
          queries.filter(q => q.id !== tempQuery.id).concat(response!.data)
        );
      } else if (selectedDocument) {
        const jsonData = {
          question: question,
          document_id: selectedDocument.id
        };
        response = await axios.post(`${API_BASE_URL}/api/query/`, jsonData, {
          headers: { 'Content-Type': 'application/json' }
        });
        setDocumentQueries(queries => 
          queries.filter(q => q.id !== tempQuery.id).concat(response!.data)
        );
      }
      
      setQuestion('');
      
    } catch (err) {
      console.error('Error submitting question:', err);
      setError('Failed to process your question');
      if (viewMode === 'allDocs' || searchMode === 'all') {
        setAllDocsQueries(queries => queries.filter(q => q.id < 0));
      } else {
        setDocumentQueries(queries => queries.filter(q => q.id < 0));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Unknown date";
    return new Date(dateStr).toLocaleString();
  };

  const renderQueryList = (queries: Query[]) => {
    if (queries.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
            <p className="text-gray-600 text-lg">
              {viewMode === 'allDocs' 
                ? 'No questions asked across all documents yet. Start asking below!'
                : searchMode === 'all' 
                  ? 'Ask questions across all your documents'
                  : 'Ask questions about this document'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {queries.map((query) => (
          <div key={query.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-xl rounded-tr-none shadow-md max-w-2xl">
                <p>{query.question}</p>
                <div className="text-xs opacity-75 text-right mt-1">
                  {formatDate(query.created_at)}
                </div>
              </div>
            </div>
            
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-xl rounded-tl-none shadow-md max-w-2xl border-l-4 border-blue-500">
                {query.answer === '...' ? (
                  <div className="flex space-x-2 p-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-800 whitespace-pre-line">{query.answer}</p>
                    
                    {/* {query.sources && query.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Sources:</p>
                        <div className="space-y-2">
                          {query.sources.map((source, idx) => (
                            <div key={idx} className="flex items-center text-sm">
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                              <span className="text-indigo-700 font-medium">{source.document_title}</span>
                              <span className="ml-2 text-gray-500">
                                (relevance: {(source.relevance_score * 100).toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Helper function to determine if input should be shown
  const shouldShowInput = () => {
    if (viewMode === 'allDocs') {
      return true; // Always show in allDocs view
    }
    if (viewMode === 'chat') {
      return true; // Always show in chat view
    }
    return false;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white p-5 shadow-lg">
        <h1 className="text-3xl font-bold">PDF Document Q&A System</h1>
        <p className="text-sm opacity-90 mt-1">Upload PDFs and ask questions about their content</p>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white p-5 border-r shadow-md overflow-y-auto">
          <h2 className="text-xl font-semibold mb-5 text-indigo-800">My Documents</h2>
          
          <form onSubmit={handleUpload} className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-3 text-purple-700">Upload New Document</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select PDF</label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-500 file:text-white hover:file:bg-indigo-600 transition cursor-pointer"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Title (optional)
              </label>
              <input
                type="text"
                placeholder="Auto-filled from filename"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="w-full p-2 border border-purple-200 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-2 rounded-md hover:opacity-90 transition-all disabled:opacity-70 shadow-md"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>
          
          <div 
            onClick={handleAllDocsView}
            className={`p-4 mb-4 cursor-pointer rounded-lg transition-all hover:shadow-md ${
              viewMode === 'allDocs'
                ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-l-4 border-purple-500'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 shadow'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-purple-800">📚 All Documents Q&A</div>
                <div className="text-xs text-gray-600 mt-1">
                  {allDocsQueries.length} multi-doc {allDocsQueries.length === 1 ? 'query' : 'queries'}
                </div>
              </div>
              <div className="text-2xl">
                {viewMode === 'allDocs' ? '▶' : '▷'}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-gray-500 italic text-center py-6">No documents uploaded yet</p>
            ) : (
              documents.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => handleDocumentSelect(doc.id)}
                  className={`p-3 cursor-pointer rounded-lg transition-all hover:shadow-md ${
                    selectedDocument?.id === doc.id && viewMode === 'chat'
                      ? 'bg-gradient-to-r from-indigo-100 to-purple-100 border-l-4 border-indigo-500' 
                      : 'bg-white hover:bg-indigo-50 shadow'
                  }`}
      >
        <div className="font-medium text-indigo-800">{doc.title}</div>
        <div className="text-xs text-gray-500 mt-1">
          <span className="block">Created: {formatDate(doc.created_at)}</span>
          <span className="block">Size: {Math.round(doc.file_size / 1024)} KB</span>
        </div>
        {/* <a
          href={doc.cloudinary_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-block w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1.5 px-3 rounded transition-colors"
        >
          📄 See Original PDF
        </a> */}
      </div>
              ))
            )}
          </div>
          
        </aside>
        
        <main className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-indigo-800">
                {viewMode === 'allDocs' 
                  ? '📚 All Documents Q&A' 
                  : searchMode === 'all' 
                    ? 'Search All Documents' 
                    : selectedDocument?.title || 'No Document Selected'}
              </h2>
              {selectedDocument && searchMode === 'single' && viewMode === 'chat' && (
                <div className="text-sm text-gray-600 mt-1">
                  <span>{Math.round(selectedDocument.file_size / 1024)} KB</span>
                </div>
              )}
              {viewMode === 'allDocs' && (
                <div className="text-sm text-gray-600 mt-1">
                  Ask questions across all documents & view history
                </div>
              )}
            </div>
            
            {viewMode === 'chat' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSearchMode('all')}
                  className={`px-4 py-2 rounded-md transition ${
                    searchMode === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  All Docs
                </button>
                <button
                  onClick={() => setSearchMode('single')}
                  disabled={!selectedDocument}
                  className={`px-4 py-2 rounded-md transition ${
                    searchMode === 'single'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50 disabled:opacity-50'
                  }`}
                >
                  This Doc
                </button>
              </div>
            )}
          </div>
          
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50"
          >
            {viewMode === 'allDocs' 
              ? renderQueryList(allDocsQueries)
              : searchMode === 'all'
                ? renderQueryList(allDocsQueries)
                : renderQueryList(documentQueries)
            }
          </div>
          
          {/* Always show input - simplified condition */}
          {shouldShowInput() && (
            <div className="bg-white p-4 border-t shadow-inner">
              <form onSubmit={handleQuestionSubmit} className="flex">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    viewMode === 'allDocs' 
                      ? "Ask about all documents..." 
                      : searchMode === 'all' 
                        ? "Ask about any document..." 
                        : "Ask about this document..."
                  }
                  className="flex-1 p-3 border border-indigo-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                  disabled={loading}
                  required
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-r-lg hover:opacity-90 transition-all disabled:opacity-70 shadow-md"
                  disabled={loading || !question.trim()}
                >
                  {loading ? 'Thinking...' : 'Ask'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
      
      {error && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 rounded-lg shadow-lg flex items-center">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 font-bold text-xl"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentView;