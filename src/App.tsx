import { Routes, Route } from 'react-router-dom';
import OceanPage from './features/ocean/OceanPage';
import LoginPage from './features/auth/LoginPage';
import MyProfilePage from './features/profile/MyProfilePage';
import UserProfilePage from './features/profile/UserProfilePage';
import ChatPage from './features/chat/ChatPage';
import RequireAuth from './features/auth/RequireAuth';
import { WaveTransitionProvider } from './components/WaveTransitionProvider';

export default function App() {
  return (
    <WaveTransitionProvider>
      <Routes>
        <Route path="/" element={<OceanPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <MyProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/users/:id"
          element={
            <RequireAuth>
              <UserProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
      </Routes>
    </WaveTransitionProvider>
  );
}
