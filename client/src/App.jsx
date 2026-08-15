import { Routes, Route, Navigate } from 'react-router-dom';
import LobbyPage from './pages/LobbyPage';
import RoomPage  from './pages/RoomPage';

// Добавить новую страницу:
// 1. Создай файл в pages/
// 2. Добавь <Route> сюда

export default function App() {
  return (
    <Routes>
      <Route path="/"                  element={<LobbyPage />} />
      <Route path="/join/:code"        element={<LobbyPage />} />
      <Route path="/invite/:sessionId" element={<LobbyPage />} />
      <Route path="/room/:id"          element={<RoomPage />} />
      <Route path="*"           element={<Navigate to="/" />} />
    </Routes>
  );
}
