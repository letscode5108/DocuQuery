import { BrowserRouter, Routes, Route,  } from 'react-router-dom';
import './App.css'
import LandingPage from './pages/LandingPage';
import Document from './pages/DocumentView';
import React from 'react';


const App: React.FC = () => {
  return (
   
    <BrowserRouter>
    <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/document" element={<Document />} />
        
      </Routes>
    </BrowserRouter>
    
  )
}

export default App
