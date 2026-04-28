import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UmlScreen from './pages/UmlScreen'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ana sayfa olarak UmlScreen'i açar */}
        <Route path="/" element={<UmlScreen />} />
      </Routes>
    </BrowserRouter>
  );
}