import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

// One shared Socket.IO connection for the whole app, reused across
// components/re-renders rather than opened per-mount. The backend
// broadcasts an 'oceanUpdate' event (an array of OceanGroup) to every
// connected socket once per poll cycle - see backend/lib/spotifyPoller.js.
// This is intentionally public: guests (not logged in) still see the
// ocean, same as the backend's own /ocean test page.
let socket: Socket | null = null;

// Reuse one credentialed connection. The backend identifies logged-in users
// from their session cookie, not a user ID supplied by the browser.
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
    });
  }

  return socket;
}

