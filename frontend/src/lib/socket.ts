import { io, type Socket } from 'socket.io-client';
import { API_URL, getStoredToken } from './api';

// One shared Socket.IO connection for the whole app, reused across
// components/re-renders rather than opened per-mount. The backend
// broadcasts an 'oceanUpdate' event (an array of OceanGroup) to every
// connected socket once per poll cycle - see backend/lib/spotifyPoller.js.
// This is intentionally public: guests (not logged in) still see the
// ocean, same as the backend's own /ocean test page.
//
// Private/group chat events (see ChatContext.tsx) need this connection to
// carry the same bearer-token identity used for REST calls, so it's sent
// as Socket.IO connection auth (`auth: { token }`) rather than a cookie -
// same reasoning as api.ts: frontend/backend live on different
// *.onrender.com subdomains, so a cookie here would be a blocked
// third-party cookie.
let socket: Socket | null = null;
let reauthedToken: string | null | undefined; // token the socket last connected/reconnected with

export function getSocket(): Socket {
  if (!socket) {
    const token = getStoredToken();
    reauthedToken = token;
    socket = io(API_URL, { withCredentials: true, auth: { token } });
  }
  return socket;
}

// Call this after login completes or logout finishes, so the socket's
// authenticated identity actually updates instead of staying stale (a
// stale socket auth would keep the private/group chat channels working -
// or not working - as whichever account was logged in when the socket
// first connected, regardless of who's actually logged in now).
//
// No-ops when the token hasn't actually changed since the last reauth
// (e.g. AuthContext's refresh() calls this on every successful /auth/me
// check, not just ones where login status changed). Without this guard,
// a redundant disconnect()+connect() cycle can race with ChatContext's
// room-join effects: a private:join/group:join emitted right as this
// forces a fresh reconnect can land on the socket in the moment between
// "about to disconnect" and "reconnected", which is exactly the kind of
// timing that can cause a room join to silently not stick until some
// later, unrelated reconnect.
export function reauthSocket(): void {
  if (!socket) return;
  const token = getStoredToken();
  if (token === reauthedToken) return;
  reauthedToken = token;
  socket.auth = { token };
  socket.disconnect();
  socket.connect();
}
