import { Routes, Route } from 'react-router-dom';
import OceanPage from './features/ocean/OceanPage';
import LoginPage from './features/auth/LoginPage';
import MyProfilePage from './features/profile/MyProfilePage';
import UserProfilePage from './features/profile/UserProfilePage';
import ChatPage from './features/chat/ChatPage';
import RequireAuth from './features/auth/RequireAuth';

export default function App() {
  return (
    <Routes>
      {/* The ocean is the landing page: visible to guests and logged-in users alike. */}
      <Route path="/" element={<OceanPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below needs an account. */}
      <Route path="/profile" element={<RequireAuth><MyProfilePage /></RequireAuth>} />
      <Route path="/users/:id" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
    </Routes>
  );
}
