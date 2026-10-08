import { Routes, Route } from 'react-router-dom';
import OceanPage from './features/ocean/OceanPage';
import HostProfilePage from './features/ocean/HostProfilePage';
import LoginPage from './features/auth/LoginPage';
import MyProfilePage from './features/profile/MyProfilePage';
import UserProfilePage from './features/profile/UserProfilePage';
import ChatPage from './features/chat/ChatPage';
import RequireAuth from './features/auth/RequireAuth';
import { useChat } from './data/ChatContext';
import QuotaWatcher from './components/QuotaWatcher';

export default function App() {
  // "You were added to <group>" toast - global because it needs to be
  // visible from any page, not just while already on /chat. Same pill
  // style as MyProfilePage's "Profile saved" toast.
  const { newGroupNotice, dismissGroupNotice } = useChat();

  return (
    <>
      <Routes>
        {/* The ocean is the landing page: visible to guests and logged-in users alike. */}
        <Route path="/" element={<OceanPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Everything below needs an account. */}
        <Route path="/profile" element={<RequireAuth><MyProfilePage /></RequireAuth>} />
        <Route path="/users/:id" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
        <Route path="/hosts/:spotifyUserId" element={<RequireAuth><HostProfilePage /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
      </Routes>

      <QuotaWatcher />

      <button
        type="button"
        onClick={dismissGroupNotice}
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition-opacity ${
          newGroupNotice ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {newGroupNotice || ''}
      </button>
    </>
  );
}
