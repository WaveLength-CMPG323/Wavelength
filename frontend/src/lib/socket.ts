import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

// One shared Socket.IO connection for the whole app, reused across
// components/re-renders rather than opened per-mount. The backend
// broadcasts an 'oceanUpdate' event (an array of OceanGroup) to every
// connected socket once per poll cycle - see backend/lib/spotifyPoller.js.
// This is intentionally public: guests (not logged in) still see the
// ocean, same as the backend's own /ocean test page.
let socket: Socket | null = null;

// Connect the browser to the Express/Socket.IO backend.
// The backend uses socket.handshake.auth.userId to know which user is sending
// private chat events. The backend then checks whether there is an accepted chat request before
// allowing access to the private room
// Once persistence is added, the socket will still be used for live
// message delivery, but message history may move to a database-backed store.
export function getSocket(userId?: string): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      auth: userId ? { userId } : undefined,
    });
  }

  if (userId && (socket as any).auth?.userId !== userId) {
    (socket as any).auth = { userId };
    socket.disconnect();
    socket.connect();
  }

  return socket;
}

