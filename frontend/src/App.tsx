import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LandingPage from './pages/LandingPage';
import Document from './pages/DocumentView';
import AuthPage from './pages/AuthPage';
import React, { useState } from 'react';
import { authApi } from './services/api';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return authApi.isLoggedIn() ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(authApi.isLoggedIn());

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={
          loggedIn
            ? <Navigate to="/document" replace />
            : <AuthPage onLogin={() => setLoggedIn(true)} />
        } />
        <Route path="/document" element={
          <ProtectedRoute>
            <Document />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;