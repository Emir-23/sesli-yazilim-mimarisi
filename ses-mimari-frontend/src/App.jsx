import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UmlScreen from './pages/UmlScreen';
import MeetingRoom from './pages/MeetingRoom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ana sayfa olarak UmlScreen'i açar */}
        <Route path="/" element={<UmlScreen />} />
        <Route path="/uml" element={<UmlScreen />} />
        <Route path="/meeting" element={<MeetingRoom />} />
      </Routes>
    </BrowserRouter>
  );
}