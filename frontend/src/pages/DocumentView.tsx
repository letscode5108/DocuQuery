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
  upload_date: string;
  created_at: string; // Added actual creation date field
  user_id: number;
}

interface Query {
  id: number;
  question: string;
  answer: string;
  document_id: number;
  timestamp: string;
  created_at: string; // Added actual creation timestamp
  session_id?: number;
}

interface Session {
  session_id: string;
  document_id: number;
}

const DocumentView: React.FC = () => {
  // State variables
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentQueries, setDocumentQueries] = useState<Query[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // API base URL
  const API_BASE_URL = 'http://localhost:8000/api';

  // Fetch all documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Scroll to bottom of chat when queries change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [documentQueries]);

  // Fetch all documents
  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/`);
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    }
  };

  // Fetch a specific document's details and its queries
  const fetchDocumentDetails = async (documentId: number) => {
    try {
      const docResponse = await axios.get(`${API_BASE_URL}/documents/${documentId}`);
      setSelectedDocument(docResponse.data);
      
      const queriesResponse = await axios.get(`${API_BASE_URL}/queries/${documentId}`);
      setDocumentQueries(queriesResponse.data);
    } catch (err) {
      console.error('Error fetching document details:', err);
      setError('Failed to load document details');
    }
  };

  // Create a new session for document
  const createSession = async (documentId: number) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/sessions/?document_id=${documentId}`);
      setCurrentSession(response.data);
      return response.data.session_id;
    } catch (err) {
      console.error('Error creating session:', err);
      setError('Failed to create a new session');
      return null;
    }
  };

  // Handle document selection
  const handleDocumentSelect = async (documentId: number) => {
    await fetchDocumentDetails(documentId);
    await createSession(documentId);
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Handle document upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !documentTitle) {
      setError('Please provide both a title and a PDF file');
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
      formData.append('title', documentTitle);
      
      const response = await axios.post(`${API_BASE_URL}/documents/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Refresh document list
      fetchDocuments();
      
      // Clear form
      setFile(null);
      setDocumentTitle('');
      
      // Select the newly uploaded document
      handleDocumentSelect(response.data.id);
      
    } catch (err) {
      console.error('Error uploading document:', err);
      setError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };
  
  // Submit a question in session
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim() || !currentSession || !selectedDocument) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Add the question to UI immediately for better UX
      const tempQuery: Query = {
        id: -Date.now(), // Temporary negative ID
        question: question,
        answer: '...',
        document_id: selectedDocument.id,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      
      setDocumentQueries([...documentQueries, tempQuery]);
      
      const formData = new FormData();
      formData.append('question', question);
      
      const response = await axios.post(
        `${API_BASE_URL}/sessions/${currentSession.session_id}/query`, 
        formData
      );
      
      // Replace the temp query with the real one
      setDocumentQueries(queries => 
        queries.filter(q => q.id !== tempQuery.id).concat(response.data)
      );
      
      // Clear question input
      setQuestion('');
      
    } catch (err) {
      console.error('Error submitting question:', err);
      setError('Failed to process your question');
      
      // Remove the temporary query on error
      setDocumentQueries(queries => 
        queries.filter(q => q.id !== -Date.now())
      );
    } finally {
      setLoading(false);
    }
  };

  // Format date string
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Unknown date";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white p-5 shadow-lg">
        <h1 className="text-3xl font-bold">PDF Document Q&A System</h1>
        <p className="text-sm opacity-90 mt-1">Upload PDFs and ask questions about their content</p>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with document list */}
        <aside className="w-80 bg-white p-5 border-r shadow-md overflow-y-auto">
          <h2 className="text-xl font-semibold mb-5 text-indigo-800">My Documents</h2>
          
          {/* Upload form */}
          <form onSubmit={handleUpload} className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-3 text-purple-700">Upload New Document</h3>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Document Title"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="w-full p-2 border border-purple-200 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                required
              />
            </div>
            <div className="mb-3">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-500 file:text-white hover:file:bg-indigo-600 transition cursor-pointer"
                required
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
          
          {/* Document list */}
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-gray-500 italic text-center py-6">No documents uploaded yet</p>
            ) : (
              documents.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => handleDocumentSelect(doc.id)}
                  className={`p-3 cursor-pointer rounded-lg transition-all hover:shadow-md ${
                    selectedDocument?.id === doc.id 
                      ? 'bg-gradient-to-r from-indigo-100 to-purple-100 border-l-4 border-indigo-500' 
                      : 'bg-white hover:bg-indigo-50 shadow'
                  }`}
                >
                  <div className="font-medium text-indigo-800">{doc.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="block">Created: {formatDate(doc.created_at)}</span>
                    <span className="block">Size: {Math.round(doc.file_size / 1024)} KB</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
        
        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner">
          {selectedDocument ? (
            <>
              {/* Document details */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 border-b shadow-sm">
                <h2 className="text-2xl font-bold text-indigo-800">{selectedDocument.title}</h2>
                <div className="mt-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Filename:</span> {selectedDocument.filename}
                  </p>
                  <p>
                    <span className="font-medium">Created:</span> {formatDate(selectedDocument.created_at)}
                  </p>
                  <p>
                    <span className="font-medium">Size:</span> {Math.round(selectedDocument.file_size / 1024)} KB
                  </p>
                </div>
                <a 
                  href={selectedDocument.cloudinary_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition shadow-sm"
                >
                  View Original PDF
                </a>
              </div>
              
              {/* Chat interface */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50"
              >
                {documentQueries.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                      <div className="text-blue-500 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 text-lg">
                        Ask questions about this document to get started
                      </p>
                      <p className="text-gray-500 text-sm mt-2">
                        Your questions and answers will appear here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {documentQueries.map((query) => (
                      <div key={query.id} className="space-y-3">
                        {/* Question */}
                        <div className="flex justify-end">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-xl rounded-tr-none shadow-md max-w-lg">
                            <p>{query.question}</p>
                            <div className="text-xs opacity-75 text-right mt-1">
                              {query.created_at && formatDate(query.created_at)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Answer */}
                        <div className="flex justify-start">
                          <div className="bg-white p-4 rounded-xl rounded-tl-none shadow-md max-w-lg border-l-4 border-blue-500">
                            {query.answer === '...' ? (
                              <div className="flex space-x-2 p-2">
                                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
                                <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                                <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-gray-800">{query.answer}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Question input */}
              <div className="bg-white p-4 border-t shadow-inner">
                <form onSubmit={handleQuestionSubmit} className="flex">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about this document..."
                    className="flex-1 p-3 border border-indigo-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                    disabled={loading}
                    required
                  />
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-r-lg hover:opacity-90 transition-all disabled:opacity-70 shadow-md flex items-center justify-center"
                    disabled={loading || !question.trim()}
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Thinking...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Ask
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-blue-50">
              <div className="text-center p-10 bg-white rounded-xl shadow-lg max-w-md">
                <div className="text-indigo-500 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-indigo-800">No Document Selected</h3>
                <p className="text-gray-600">
                  Select a document from the sidebar or upload a new one to get started
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 rounded-lg shadow-lg flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 font-bold text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentView;
// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';

// // Type definitions
// interface Document {
//   id: number;
//   title: string;
//   filename: string;
//   cloudinary_url: string;
//   public_id: string;
//   file_size: number;
//   mime_type: string;
//   upload_date: string;
//   user_id: number;
// }

// interface Query {
//   id: number;
//   question: string;
//   answer: string;
//   document_id: number;
//   timestamp: string;
//   session_id?: number;
// }

// interface Session {
//   session_id: string;
//   document_id: number;
// }

// const DocumentView: React.FC = () => {
//   // State variables
//   const [documents, setDocuments] = useState<Document[]>([]);
//   const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
//   const [documentQueries, setDocumentQueries] = useState<Query[]>([]);
//   const [currentSession, setCurrentSession] = useState<Session | null>(null);
//   const [question, setQuestion] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [file, setFile] = useState<File | null>(null);
//   const [documentTitle, setDocumentTitle] = useState('');
//   const [uploading, setUploading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
  
//   const chatContainerRef = useRef<HTMLDivElement>(null);

//   // API base URL
//   const API_BASE_URL =  'http://localhost:8000/api';

//   // Fetch all documents on component mount
//   useEffect(() => {
//     fetchDocuments();
//   }, []);

//   // Scroll to bottom of chat when queries change
//   useEffect(() => {
//     if (chatContainerRef.current) {
//       chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
//     }
//   }, [documentQueries]);

//   // Fetch all documents
//   const fetchDocuments = async () => {
//     try {
//       const response = await axios.get(`${API_BASE_URL}/documents/`);
//       setDocuments(response.data);
//     } catch (err) {
//       console.error('Error fetching documents:', err);
//       setError('Failed to load documents');
//     }
//   };

//   // Fetch a specific document's details and its queries
//   const fetchDocumentDetails = async (documentId: number) => {
//     try {
//       const docResponse = await axios.get(`${API_BASE_URL}/documents/${documentId}`);
//       setSelectedDocument(docResponse.data);
      
//       const queriesResponse = await axios.get(`${API_BASE_URL}/queries/${documentId}`);
//       setDocumentQueries(queriesResponse.data);
//     } catch (err) {
//       console.error('Error fetching document details:', err);
//       setError('Failed to load document details');
//     }
//   };

//   // Create a new session for document
//   const createSession = async (documentId: number) => {
//     try {
//       const response = await axios.post(`${API_BASE_URL}/sessions/?document_id=${documentId}`);
//         //document_id: documentId});
//       setCurrentSession(response.data);
//       return response.data.session_id;
//     } catch (err) {
//       console.error('Error creating session:', err);
//       setError('Failed to create a new session');
//       return null;
//     }
//   };

//   // Handle document selection
//   const handleDocumentSelect = async (documentId: number) => {
//     await fetchDocumentDetails(documentId);
//     await createSession(documentId);
//   };

//   // Handle file input change
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setFile(e.target.files[0]);
//     }
//   };

//   // Handle document upload
//   const handleUpload = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     if (!file || !documentTitle) {
//       setError('Please provide both a title and a PDF file');
//       return;
//     }
    
//     if (!file.name.endsWith('.pdf')) {
//       setError('Only PDF files are allowed');
//       return;
//     }
    
//     setUploading(true);
//     setError(null);
    
//     try {
//       const formData = new FormData();
//       formData.append('file', file);
//       formData.append('title', documentTitle);
      
//       const response = await axios.post(`${API_BASE_URL}/documents/`, formData, {
//         headers: {
//           'Content-Type': 'multipart/form-data'
//         }
//       });
      
//       // Refresh document list
//       fetchDocuments();
      
//       // Clear form
//       setFile(null);
//       setDocumentTitle('');
      
//       // Select the newly uploaded document
//       handleDocumentSelect(response.data.id);
      
//     } catch (err) {
//       console.error('Error uploading document:', err);
//       setError('Failed to upload document');
//     } finally {
//       setUploading(false);
//     }
//   };
  
//   // Submit a question in session
//   const handleQuestionSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     if (!question.trim() || !currentSession || !selectedDocument) {
//       return;
//     }
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       // Add the question to UI immediately for better UX
//       const tempQuery: Query = {
//         id: -Date.now(), // Temporary negative ID
//         question: question,
//         answer: '...',
//         document_id: selectedDocument.id,
//         timestamp: new Date().toISOString(),
//       };
      
//       setDocumentQueries([...documentQueries, tempQuery]);
      
//       const formData = new FormData();
//       formData.append('question', question);
      
//       const response = await axios.post(
//         `${API_BASE_URL}/sessions/${currentSession.session_id}/query`, 
//         formData
//       );
      
//       // Replace the temp query with the real one
//       setDocumentQueries(queries => 
//         queries.filter(q => q.id !== tempQuery.id).concat(response.data)
//       );
      
//       // Clear question input
//       setQuestion('');
      
//     } catch (err) {
//       console.error('Error submitting question:', err);
//       setError('Failed to process your question');
      
//       // Remove the temporary query on error
//       setDocumentQueries(queries => 
//         queries.filter(q => q.id !== -Date.now())
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Format date string
//   const formatDate = (dateStr: string) => {
//     return new Date(dateStr).toLocaleString();
//   };

//   return (
//     <div className="flex flex-col min-h-screen bg-gray-100">
//       <header className="bg-blue-600 text-white p-4">
//         <h1 className="text-2xl font-bold">PDF Document Q&A System</h1>
//       </header>
      
//       <div className="flex flex-1 overflow-hidden">
//         {/* Sidebar with document list */}
//         <aside className="w-64 bg-white p-4 border-r overflow-y-auto">
//           <h2 className="text-lg font-semibold mb-4">My Documents</h2>
          
//           {/* Upload form */}
//           <form onSubmit={handleUpload} className="mb-6 p-3 bg-gray-50 rounded">
//             <h3 className="text-md font-medium mb-2">Upload New Document</h3>
//             <div className="mb-2">
//               <input
//                 type="text"
//                 placeholder="Document Title"
//                 value={documentTitle}
//                 onChange={(e) => setDocumentTitle(e.target.value)}
//                 className="w-full p-2 border rounded"
//                 required
//               />
//             </div>
//             <div className="mb-2">
//               <input
//                 type="file"
//                 accept=".pdf"
//                 onChange={handleFileChange}
//                 className="w-full text-sm"
//                 required
//               />
//             </div>
//             <button
//               type="submit"
//               disabled={uploading}
//               className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
//             >
//               {uploading ? 'Uploading...' : 'Upload'}
//             </button>
//           </form>
          
//           {/* Document list */}
//           <ul className="space-y-2">
//             {documents.length === 0 ? (
//               <p className="text-gray-500 italic">No documents uploaded yet</p>
//             ) : (
//               documents.map((doc) => (
//                 <li 
//                   key={doc.id}
//                   onClick={() => handleDocumentSelect(doc.id)}
//                   className={`p-2 cursor-pointer hover:bg-gray-100 rounded ${
//                     selectedDocument?.id === doc.id ? 'bg-blue-100' : ''
//                   }`}
//                 >
//                   <div className="font-medium">{doc.title}</div>
//                   <div className="text-xs text-gray-500">
//                     {formatDate(doc.upload_date)}
//                   </div>
//                 </li>
//               ))
//             )}
//           </ul>
//         </aside>
        
//         {/* Main content area */}
//         <main className="flex-1 flex flex-col overflow-hidden">
//           {selectedDocument ? (
//             <>
//               {/* Document details */}
//               <div className="bg-white p-4 border-b">
//                 <h2 className="text-xl font-bold">{selectedDocument.title}</h2>
//                 <p className="text-sm text-gray-500">
//                   Filename: {selectedDocument.filename} | 
//                   Size: {Math.round(selectedDocument.file_size / 1024)} KB
//                 </p>
//                 <a 
//                   href={selectedDocument.cloudinary_url} 
//                   target="_blank" 
//                   rel="noopener noreferrer"
//                   className="text-blue-500 hover:underline text-sm"
//                 >
//                   View Original PDF
//                 </a>
//               </div>
              
//               {/* Chat interface */}
//               <div 
//                 ref={chatContainerRef}
//                 className="flex-1 overflow-y-auto p-4 bg-gray-50"
//               >
//                 {documentQueries.length === 0 ? (
//                   <div className="flex items-center justify-center h-full">
//                     <p className="text-gray-500">
//                       Ask questions about this document to get started
//                     </p>
//                   </div>
//                 ) : (
//                   <div className="space-y-4">
//                     {documentQueries.map((query) => (
//                       <div key={query.id} className="space-y-2">
//                         {/* Question */}
//                         <div className="flex justify-end">
//                           <div className="bg-blue-500 text-white p-3 rounded-lg max-w-3/4">
//                             {query.question}
//                           </div>
//                         </div>
                        
//                         {/* Answer */}
//                         <div className="flex justify-start">
//                           <div className="bg-white p-3 rounded-lg shadow max-w-3/4">
//                             {query.answer === '...' ? (
//                               <div className="flex space-x-1">
//                                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
//                                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
//                                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
//                               </div>
//                             ) : (
//                               query.answer
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>
              
//               {/* Question input */}
//               <div className="bg-white p-4 border-t">
//                 <form onSubmit={handleQuestionSubmit} className="flex">
//                   <input
//                     type="text"
//                     value={question}
//                     onChange={(e) => setQuestion(e.target.value)}
//                     placeholder="Ask a question about this document..."
//                     className="flex-1 p-2 border rounded-l"
//                     disabled={loading}
//                     required
//                   />
//                   <button
//                     type="submit"
//                     className="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600 disabled:bg-blue-300"
//                     disabled={loading || !question.trim()}
//                   >
//                     {loading ? 'Thinking...' : 'Ask'}
//                   </button>
//                 </form>
//               </div>
//             </>
//           ) : (
//             <div className="flex items-center justify-center h-full">
//               <div className="text-center p-8">
//                 <h3 className="text-xl font-medium mb-2">No Document Selected</h3>
//                 <p className="text-gray-500">
//                   Select a document from the sidebar or upload a new one to get started
//                 </p>
//               </div>
//             </div>
//           )}
//         </main>
//       </div>
      
//       {/* Error message */}
//       {error && (
//         <div className="fixed bottom-4 right-4 bg-red-500 text-white p-3 rounded shadow">
//           {error}
//           <button 
//             onClick={() => setError(null)}
//             className="ml-2 font-bold"
//           >
//             ×
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default DocumentView;