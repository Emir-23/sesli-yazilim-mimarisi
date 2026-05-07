import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MeetingRoom from './pages/MeetingRoom';
import Workspace from './pages/Workspace';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/meeting/:id" element={<MeetingRoom />} />
        <Route path="/workspace/:id" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}