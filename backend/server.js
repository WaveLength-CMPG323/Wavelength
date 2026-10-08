require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const oceanState = require('./lib/oceanState');
const { getAllEquippedBorders } = require('./lib/equippedBorders');
const cookieParser = require('cookie-parser');

const authRouter = require('./routes/auth');
const spotifyRouter = require('./routes/spotify');
const chatRequestsRouter = require('./routes/chatRequests');
const groupsRouter = require('./routes/groups');
const challengesRouter = require('./routes/challenges');
const cosmeticsRouter = require('./routes/cosmetics');
const { useMemoryStore, getTokens } = require('./db/tokenStore');
const { startOceanPoller } = require('./lib/spotifyPoller');
const { startChallengeScheduler } = require('./lib/challengeRotation');
const { identifyRequest } = require('./lib/identity');
const groupStore = require('./lib/groupStore');
const { hasAcceptedPrivateChatRequest } = require('./lib/chatRequests');
const chatHistory = require('./db/chatHistory');

const app = express();
app.set('trust proxy', 1); // needed behind Render's (or any) reverse proxy for req.ip/req.protocol to reflect the real client, not the proxy hop
const httpServer = http.createServer(app);

// The React frontend (Vite dev server, or wherever it's deployed) runs on
// a different origin than this API. CORS needs an explicit origin (not a
// wildcard) so the browser will make the request at all.
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

// Used only for the short-lived OAuth 'spotify_auth_state' cookie (see
// routes/auth.js) - that cookie is only ever set and read back on requests
// to this backend's own domain (never sent cross-site), but a real HTTPS
// deployment still needs Secure set or some browsers will refuse to store
// it, while local http:// dev must NOT set it or the cookie won't be
// stored at all.
//
// This is derived directly from FRONTEND_ORIGIN being https:// rather
// than from NODE_ENV === 'production': NODE_ENV's default value varies by
// hosting platform and deployment method (e.g. a platform's native Node
// runtime vs. a Dockerfile), so relying on it silently breaks login on
// setups where it isn't actually set. Local dev always uses plain
// http://, so this only ever turns on for a real deployment.
const NEEDS_CROSS_SITE_COOKIES = FRONTEND_ORIGIN.startsWith('https://');
app.set('needsCrossSiteCookies', NEEDS_CROSS_SITE_COOKIES);

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_ORIGIN, credentials: true },
});
// Exposes the Socket.IO server to route handlers via req.app.get('io') -
// used by routes/cosmetics.js to broadcast 'user_cosmetic_changed' after
// an equip/unequip.
app.set('io', io);

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json()); // needed for POST /spotify/join's JSON body

// Identifies each browser by an Authorization: Bearer <token> header
// (issued once at /auth/callback, stored client-side in localStorage) -
// deliberately NOT a cookie. See lib/identity.js for why: the frontend and
// backend live on different *.onrender.com subdomains, which browsers
// treat as different *sites*, making any identity cookie a third-party
// cookie - something a growing share of browsers block by default no
// matter how carefully its flags are set. A bearer token sent as an
// explicit header sidesteps that entirely.
app.use(identifyRequest);

app.use('/auth', authRouter);
app.use('/spotify', spotifyRouter);
app.use('/chat-requests', chatRequestsRouter);
app.use('/groups', groupsRouter);
app.use('/challenges', challengesRouter);
app.use('/cosmetics', cosmeticsRouter);

// --- Real-time chat (private 1:1 + group) over Socket.IO ---
//
// TEMPORARY PRIVATE CHAT FLOW: this uses an accepted chat request as the
// access check for a live 1:1 room - if there's an accepted request, the
// two users may join the room; if not, they can't send or receive
// messages. Not the final chat architecture (no persistence yet), just a
// live-room permission layer for now. See lib/chatRequests.js's
// hasAcceptedPrivateChatRequest().

// A private chat room is shared by exactly two users. Sorting the two IDs
// keeps the room name the same no matter who started the chat first.
function getPrivateRoomId(userA, userB) {
  return [userA, userB].sort().join(':');
}

async function canOpenPrivateChat(me, otherUserId) {
  return hasAcceptedPrivateChatRequest(me, otherUserId);
}

function getGroupRoomId(groupId) {
  return `group:${groupId}`;
}

// Authenticates Socket.IO connections with this repo's bearer-token
// identity system - NOT a session cookie. The frontend connects with
// `io(URL, { auth: { token } })`, where `token` is the same bearer token
// sent as `Authorization: Bearer <token>` on REST calls (see
// lib/identity.js). socket.handshake.auth.token is that token; we look it
// up the same way identifyRequest does for REST, via getTokens(), and
// store the resulting real Spotify account id on socket.data for the
// handlers below.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.data.spotifyUserId = null; // anonymous/guest connections still get public oceanUpdate broadcasts
    return next();
  }
  try {
    const stored = await getTokens(token);
    socket.data.spotifyUserId = stored?.spotifyUserId ?? null;
    next();
  } catch {
    next(new Error('Could not authenticate socket'));
  }
});

// This runs every time a browser connects to the Socket.IO server.
io.on('connection', (socket) => {
  // Populated above by the io.use() bearer-token auth middleware.
  const currentUserId = socket.data.spotifyUserId;

  if (!currentUserId) {
    console.log('Socket connected without userId');
    return;
  }

  // NOTE: we check the accepted request each time before joining or
  // sending. In a database-backed version this may be replaced by a
  // lookup against a persisted conversation/permission record, but the
  // real-time socket flow itself should stay the same.

  // When a user opens a private chat, we put them into a room for that 1:1 chat.
  //
  // Acknowledged (like group:join below) so the client actually knows
  // whether the join landed, instead of firing this blind. Without an ack,
  // a join emitted while the socket is mid-reconnect (e.g. right after
  // AuthContext's reauthSocket() tears the connection down) can be silently
  // dropped by the client's own send buffer with no way for either side to
  // notice - the client would believe it had joined the room (it already
  // marked the friend as "joined" locally) while the server never actually
  // put this socket in it, so live messages for that thread would never
  // arrive until the next full socket reconnect. See ChatContext.tsx's
  // private:join emit for the client-side retry this enables.
  socket.on('private:join', async ({ otherUserId } = {}, acknowledge) => {
    if (!currentUserId || !otherUserId) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'otherUserId is required' });
      return;
    }
    try {
      if (!(await canOpenPrivateChat(currentUserId, otherUserId))) {
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'No accepted chat request with this person' });
        return;
      }

      const roomId = getPrivateRoomId(currentUserId, otherUserId);
      socket.join(roomId);
      if (typeof acknowledge === 'function') acknowledge({ ok: true });
    } catch (error) {
      console.error('Could not join private room:', error.message);
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Could not join private room' });
    }
  });

  // Called when the user sends a message in a private chat. Persists the
  // message (see db/chatHistory.js) and broadcasts the DB's own saved copy
  // (with its real generated id) rather than a locally-constructed one, so
  // the id a client sees here matches what a later GET .../messages
  // history fetch would return for the same message.
  socket.on('private:send', async ({ toUserId, text } = {}, acknowledge) => {
    if (!currentUserId || !toUserId || !text || !text.trim()) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'toUserId and text are required' });
      return;
    }
    try {
      if (!(await canOpenPrivateChat(currentUserId, toUserId))) {
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'No accepted chat request with this person' });
        return;
      }

      const roomId = getPrivateRoomId(currentUserId, toUserId);
      const message = await chatHistory.savePrivateMessage(currentUserId, toUserId, text.trim());

      io.to(roomId).emit('private:message', message);
      if (typeof acknowledge === 'function') acknowledge({ ok: true, messageId: message.id });
    } catch (error) {
      console.error('Could not save/send private message:', error.message);
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Could not send message' });
    }
  });

  // Group rooms use group IDs and current membership, not private-chat requests.
  socket.on('group:join', async ({ groupId } = {}, acknowledge) => {
    if (!groupId) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Group ID is required' });
      return;
    }
    try {
      if (!(await groupStore.isMember(groupId, currentUserId))) {
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'You are not a member of this group' });
        return;
      }

      socket.join(getGroupRoomId(groupId));
      if (typeof acknowledge === 'function') acknowledge({ ok: true });
    } catch (error) {
      console.error('Could not join group room:', error.message);
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Could not join group room' });
    }
  });

  socket.on('group:leave', ({ groupId } = {}, acknowledge) => {
    if (!groupId) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Group ID is required' });
      return;
    }

    socket.leave(getGroupRoomId(groupId));
    if (typeof acknowledge === 'function') acknowledge({ ok: true });
  });

  socket.on('group:send', async ({ groupId, text } = {}, acknowledge) => {
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!groupId || !trimmedText) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Group ID and message text are required' });
      return;
    }
    if (trimmedText.length > 4000) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Messages must be 4000 characters or fewer' });
      return;
    }
    if (!(await groupStore.isMember(groupId, currentUserId))) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'You are not a member of this group' });
      return;
    }

    const roomId = getGroupRoomId(groupId);
    if (!socket.rooms.has(roomId)) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Join the group before sending messages' });
      return;
    }

    // Recheck membership when broadcasting so a removed member with an old
    // room connection no longer receives new messages.
    try {
      const message = await chatHistory.saveGroupMessage(groupId, currentUserId, trimmedText);

      const roomSockets = await io.in(roomId).fetchSockets();
      for (const roomSocket of roomSockets) {
        if (await groupStore.isMember(groupId, roomSocket.data.spotifyUserId)) {
          roomSocket.emit('group:message', message);
        }
      }
      if (typeof acknowledge === 'function') acknowledge({ ok: true, messageId: message.id });
    } catch (error) {
      console.error('Could not save/broadcast group message:', error.message);
      if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Could not send group message' });
    }
  });
});

app.get('/', (req, res) => {
  res.send('WaveLength backend is running.');
});

// Test dashboard: polls /spotify/currently-playing and displays the
// album art, track name, artist, and a seek/progress bar. This exists
// purely so backend features can be tested before the real frontend
// is ready - it's not meant to be the final UI.
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WaveLength - Test Dashboard</title>
        <style>
          body {
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0a0a0a;
            color: #fff;
            gap: 16px;
          }
          h1 { font-size: 1.1rem; opacity: 0.6; font-weight: normal; }
          #albumArt {
            width: 240px;
            height: 240px;
            background: #222;
            border-radius: 8px;
            object-fit: cover;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #555;
            font-size: 0.9rem;
          }
          #track { font-size: 1.4rem; font-weight: bold; margin: 0; }
          #artist { font-size: 1rem; opacity: 0.7; margin: 0; }
          #progressWrap {
            width: 280px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.75rem;
            opacity: 0.7;
          }
          #progressBarBg {
            flex: 1;
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
          }
          #progressBarFill {
            height: 100%;
            width: 0%;
            background: #1db954;
            transition: width 0.5s linear;
          }
          #status { font-size: 0.8rem; opacity: 0.5; margin-top: 20px; }
          #controls {
            display: flex;
            gap: 12px;
            margin-top: 8px;
          }
          #controls button {
            background: #1db954;
            border: none;
            color: #fff;
            font-size: 1.2rem;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
          }
          #controls button:hover { background: #1ed760; }
          #controls button:disabled {
            background: #333;
            cursor: not-allowed;
          }
          #controlError {
            font-size: 0.8rem;
            color: #ff6b6b;
            min-height: 1em;
          }
        </style>
      </head>
      <body>
        <h1>WaveLength - Test Dashboard</h1>

        <img id="albumArt" src="" alt="Album art" />
        <p id="track">Loading...</p>
        <p id="artist"></p>

        <div id="progressWrap">
          <span id="currentTime">0:00</span>
          <div id="progressBarBg"><div id="progressBarFill"></div></div>
          <span id="totalTime">0:00</span>
        </div>

        <div id="controls">
          <button id="prevBtn" title="Previous">⏮</button>
          <button id="playPauseBtn" title="Play/Pause">⏯</button>
          <button id="nextBtn" title="Next">⏭</button>
        </div>
        <p id="controlError"></p>

        <p id="status">Waiting for data...</p>

        <script>
          function formatMs(ms) {
            if (!ms && ms !== 0) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return minutes + ':' + String(seconds).padStart(2, '0');
          }

          let isCurrentlyPlaying = false; // tracks state so the play/pause button knows which action to send

          async function refresh() {
            const statusEl = document.getElementById('status');
            try {
              const res = await fetch('/spotify/currently-playing');
              const data = await res.json();

              // Only treat it as "nothing to show" when there's no track
              // info at all (no active session) - a paused track still
              // has a track name/artist/art, it's just not playing.
              if (!data.track) {
                document.getElementById('track').textContent = 'Nothing playing';
                document.getElementById('artist').textContent = '';
                document.getElementById('albumArt').src = '';
                document.getElementById('progressBarFill').style.width = '0%';
                statusEl.textContent = 'No active playback detected';
                isCurrentlyPlaying = false;
                return;
              }

              isCurrentlyPlaying = data.playing;

              document.getElementById('track').textContent = data.track || 'Unknown track';
              document.getElementById('artist').textContent = data.artist || 'Unknown artist';
              document.getElementById('albumArt').src = data.albumArt || '';

              const pct = data.durationMs
                ? Math.min(100, (data.progressMs / data.durationMs) * 100)
                : 0;
              document.getElementById('progressBarFill').style.width = pct + '%';
              document.getElementById('currentTime').textContent = formatMs(data.progressMs);
              document.getElementById('totalTime').textContent = formatMs(data.durationMs);

              statusEl.textContent = (data.playing ? 'Playing' : 'Paused') + ' - Last updated: ' + new Date().toLocaleTimeString();
            } catch (err) {
              statusEl.textContent = 'Error fetching data - check console/server logs';
              console.error(err);
            }
          }

          // Sends a playback control request, shows any error, then
          // refreshes the display shortly after (Spotify takes a moment
          // to reflect the change).
          async function sendControl(method, path) {
            const errorEl = document.getElementById('controlError');
            errorEl.textContent = '';
            try {
              const res = await fetch(path, { method });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                errorEl.textContent = body.error || ('Request failed (' + res.status + ')');
                return;
              }
              setTimeout(refresh, 500); // give Spotify a moment before re-checking state
            } catch (err) {
              errorEl.textContent = 'Network error sending command';
              console.error(err);
            }
          }

          document.getElementById('playPauseBtn').addEventListener('click', () => {
            sendControl('PUT', isCurrentlyPlaying ? '/spotify/pause' : '/spotify/play');
          });
          document.getElementById('nextBtn').addEventListener('click', () => {
            sendControl('POST', '/spotify/next');
          });
          document.getElementById('prevBtn').addEventListener('click', () => {
            sendControl('POST', '/spotify/previous');
          });

          refresh();
          setInterval(refresh, 2000); // poll every 2 seconds
        </script>
      </body>
    </html>
  `);
});

// The Ocean page: WaveLength's only page. Shows one floating bubble per
// song currently being listened to across all logged-in Spotify accounts
// (grouped by track AND deduped by real account, not by browser tab).
// Real-time updates arrive over Socket.IO from the background poller in
// lib/spotifyPoller.js, once per second. Clicking a bubble pauses its own
// drifting animation (locally, in your own browser only) and opens a
// panel to join that song on your own Spotify, or Follow Along with
// whoever's hosting it (auto-following them through song changes, with
// host succession if they stop).
app.get('/ocean', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>WaveLength Ocean</title>
        <style>
          @import url(//fonts.googleapis.com/css?family=Lato:300,400);
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            height: 100%;
            overflow: hidden; /* no page scroll at all - keeps sinking bubbles from ever affecting layout */
            font-family: 'Lato', sans-serif;
          }
          h1 {
            font-weight: 300;
            letter-spacing: 2px;
            font-size: 40px;
            margin: 0;
          }
          .header {
            position: relative;
            height: 100vh;
            display: flex;
            flex-direction: column;
            text-align: center;
            background: linear-gradient(360deg, rgba(210,245,235,1) 0%, rgba(100,210,210,1) 50%, rgba(0,150,190,1) 100%);
            color: #fff;
          }
          .title-area {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6vh 0 4vh;
          }
          .title-row {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          /* Everything below the title - the wave graphic AND the
             floating bubbles both live in here, layered on top of each
             other, so bubbles can actually overlap the wave crest instead
             of being confined to a separate flat region below it. This
             fills all remaining space down to the true bottom of the page. */
          .ocean {
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
          }
          .waves {
            position: absolute;
            bottom: 0; /* anchored to the true bottom of the page, not floating with empty space beneath it */
            left: 0;
            width: 100%;
            height: 30vh;
            min-height: 140px;
            max-height: 220px;
            z-index: 2;
          }
          .parallax > use {
            animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite;
          }
          .parallax > use:nth-child(1) { animation-delay: -2s; animation-duration: 10s; }
          .parallax > use:nth-child(2) { animation-delay: -3s; animation-duration: 12s; }
          .parallax > use:nth-child(3) { animation-delay: -4s; animation-duration: 16s; }
          .parallax > use:nth-child(4) { animation-delay: -5s; animation-duration: 20s; }
          @keyframes move-forever {
            0% { transform: translate3d(-90px,0,0); }
            100% { transform: translate3d(85px,0,0); }
          }

          /* Floating song bubbles - absolutely fill the WHOLE .ocean
             region (same space as the wave graphic, layered above it via
             z-index), so bubbles can visibly float on top of the waves
             and the whole thing extends to the true bottom of the page. */
          .ocean-floaters {
            position: absolute;
            inset: 0;
            z-index: 3;
            overflow: visible;
          }
          /* ============================================================
             BUBBLE SIZE - change this one value to resize every bubble
             (the floating ones in the ocean AND the big one in the panel
             scale off the floater size below; the panel art is separate,
             see .song-panel-art if you want that bigger/smaller too).
             ============================================================ */
          :root {
            --bubble-size: 72px;
          }
          .floater {
            position: absolute;
            left: 0;
            /* NOTE: no "top" here on purpose - JS sets "bottom" inline
               per bubble (see LANE_BOTTOMS below) to control vertical
               position. Adding a "top" value back here will silently
               override "bottom" and pin every bubble to the top of the
               screen again (that was the "floating in the sky" bug). */
            width: var(--bubble-size);
            height: var(--bubble-size);
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            animation-name: float-ocean;
            animation-timing-function: linear; /* smooth continuous drift, not the stutter of ease-in-out across many keyframes */
            animation-iteration-count: infinite;
          }
          .floater img, .floater .generated-cover {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35);
            box-shadow: 0 0 18px rgba(80,180,255,0.4), 0 6px 16px rgba(0,0,0,0.35);
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          }
          .floater:hover img, .floater:hover .generated-cover {
            transform: scale(1.08);
            box-shadow: 0 0 24px rgba(80,180,255,0.55), 0 6px 18px rgba(0,0,0,0.4);
          }
          /* Clicking a bubble pauses ONLY its own animation, in your own
             browser - this never touches anyone else's screen or Spotify. */
          .floater.active { animation-play-state: paused; }
          .floater.active img, .floater.active .generated-cover {
            border-color: #00e5ff;
            box-shadow: 0 0 0 4px rgba(0,229,255,0.25), 0 0 22px rgba(0,229,255,0.55);
          }
          .floater.paused-state img, .floater.paused-state .generated-cover {
            filter: grayscale(45%) brightness(0.75);
          }
          .floater.sinking { pointer-events: none; animation-play-state: paused; }
          .floater.sinking img, .floater.sinking .generated-cover {
            transition: transform 2.2s ease-in, opacity 1.8s ease-in 0.4s, filter 2.2s ease-in;
            transform: translateY(70px) scale(0.6);
            opacity: 0;
            filter: grayscale(1) brightness(0.7);
          }
          .generated-cover {
            display: flex; align-items: center; justify-content: center;
            color: rgba(255,255,255,0.9);
            font-weight: 300;
            font-size: 26px;
            background: #123;
          }
          .listener-badge {
            position: absolute;
            bottom: -2px; right: -2px;
            background: #1db954;
            color: #fff;
            font-size: 11px;
            font-weight: bold;
            min-width: 20px; height: 20px;
            border-radius: 10px;
            display: none;
            align-items: center; justify-content: center;
            padding: 0 5px;
            border: 2px solid #543ab7;
          }

          /* Drifts left to right at a CONSTANT speed while bobbing
             smoothly (sine-wave motion) - evenly spaced keyframes +
             linear timing fixes the old "pulls itself, then stops" stutter */
          @keyframes float-ocean {
            0% { transform: translate(-15.0vw, 0.0px) rotate(0.8deg); }
            5% { transform: translate(-8.8vw, 12.5px) rotate(1.9deg); }
            10% { transform: translate(-2.6vw, 15.6px) rotate(1.6deg); }
            14% { transform: translate(3.6vw, 6.9px) rotate(0.1deg); }
            19% { transform: translate(9.8vw, -6.9px) rotate(-1.5deg); }
            24% { transform: translate(16.0vw, -15.6px) rotate(-2.0deg); }
            29% { transform: translate(22.1vw, -12.5px) rotate(-1.0deg); }
            33% { transform: translate(28.3vw, -0.0px) rotate(0.8deg); }
            38% { transform: translate(34.5vw, 12.5px) rotate(1.9deg); }
            43% { transform: translate(40.7vw, 15.6px) rotate(1.6deg); }
            48% { transform: translate(46.9vw, 6.9px) rotate(0.1deg); }
            52% { transform: translate(53.1vw, -6.9px) rotate(-1.5deg); }
            57% { transform: translate(59.3vw, -15.6px) rotate(-2.0deg); }
            62% { transform: translate(65.5vw, -12.5px) rotate(-1.0deg); }
            67% { transform: translate(71.7vw, -0.0px) rotate(0.8deg); }
            71% { transform: translate(77.9vw, 12.5px) rotate(1.9deg); }
            76% { transform: translate(84.0vw, 15.6px) rotate(1.6deg); }
            81% { transform: translate(90.2vw, 6.9px) rotate(0.1deg); }
            86% { transform: translate(96.4vw, -6.9px) rotate(-1.5deg); }
            90% { transform: translate(102.6vw, -15.6px) rotate(-2.0deg); }
            95% { transform: translate(108.8vw, -12.5px) rotate(-1.0deg); }
            100% { transform: translate(115.0vw, -0.0px) rotate(0.8deg); }
          }

          #emptyMessage {
            position: absolute;
            top: 30%; left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.75;
            font-size: 14px;
            text-align: center;
            z-index: 5;
          }

          /* Song panel - centered modal */
          .song-panel-backdrop {
            position: fixed; inset: 0;
            background: rgba(10,10,15,0.55);
            z-index: 240;
            display: none;
          }
          .song-panel-backdrop.open { display: block; }
          .song-panel {
            position: fixed;
            top: 50%; left: 50%;
            width: min(92vw, 380px);
            background: #14141a;
            border-radius: 20px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.5);
            z-index: 250;
            padding: 20px;
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0.95);
            transition: opacity 0.25s ease, transform 0.25s ease;
            color: #fff;
          }
          .song-panel.open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
          .song-panel-close {
            position: absolute; top: 14px; right: 14px;
            width: 28px; height: 28px; border-radius: 50%;
            border: none; background: rgba(255,255,255,0.1); color: #fff;
            font-size: 16px; cursor: pointer;
          }
          .song-panel-art { width: 100%; aspect-ratio: 1/1; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .song-panel-art img, .song-panel-art .generated-cover { width: 100%; height: 100%; }
          .song-panel-art .generated-cover { font-size: 72px; border-radius: 16px; }
          .song-panel-progress { margin-top: 16px; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.15); overflow: hidden; }
          .song-panel-progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, rgba(84,58,183,1) 0%, rgba(0,172,193,1) 100%); transition: width 0.6s linear; }
          .song-panel-times { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px; }
          .song-panel-transport { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 12px; }
          .song-panel-playpause {
            width: 52px; height: 52px; border-radius: 50%;
            border: none; background: #444; display: flex;
            align-items: center; justify-content: center;
            cursor: default; /* read-only status, not a control */
          }
          .song-panel-playpause svg { width: 22px; height: 22px; fill: #ccc; }
          .song-panel-status-label { font-size: 12px; color: rgba(255,255,255,0.55); }
          .song-panel-title { margin-top: 18px; font-weight: 400; font-size: 20px; letter-spacing: 0.5px; text-align: center; }
          .song-panel-artist { font-size: 13px; color: rgba(255,255,255,0.55); text-align: center; margin-top: 2px; }
          .song-panel-listeners { display: block; text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; }

          .song-panel-host-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 16px;
            padding-top: 14px;
            border-top: 1px solid rgba(255,255,255,0.1);
          }
          .song-panel-host-name {
            flex: 1;
            font-size: 12px;
            color: rgba(255,255,255,0.75);
            text-align: left;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .song-panel-host-name b { color: #fff; font-weight: 400; }
          #hostProfileLink {
            font-size: 11px;
            color: #fff;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 14px;
            padding: 5px 12px;
            text-decoration: none;
            white-space: nowrap;
          }
          #hostProfileLink:hover { background: rgba(255,255,255,0.2); }

          .song-panel-actions { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
          #joinBtn, #followBtn {
            font-size: 13px; letter-spacing: 0.3px; color: #fff;
            border: none; border-radius: 18px;
            padding: 10px 18px; cursor: pointer; font-weight: bold;
          }
          #joinBtn { background: #1db954; }
          #joinBtn:disabled { background: #333; color: #888; cursor: not-allowed; }
          #followBtn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); }
          #followBtn.following { background: #543ab7; border-color: #543ab7; }
          #followBtn:disabled { opacity: 0.4; cursor: not-allowed; }
          #joinError { color: #ff8080; font-size: 12px; text-align: center; min-height: 1em; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <div class="title-row">
              <h1>WaveLength</h1>
            </div>
          </div>

          <div class="ocean">
            <svg class="waves" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
              viewBox="0 24 150 28" preserveAspectRatio="none" shape-rendering="auto">
              <defs>
                <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
              </defs>
              <g class="parallax">
                <use xlink:href="#gentle-wave" x="48" y="0" fill="rgba(40,90,160,0.35)" />
                <use xlink:href="#gentle-wave" x="48" y="3" fill="rgba(70,140,200,0.45)" />
                <use xlink:href="#gentle-wave" x="48" y="5" fill="rgba(110,175,220,0.6)" />
                <use xlink:href="#gentle-wave" x="48" y="7" fill="rgba(170,215,235,0.9)" />
              </g>
            </svg>

            <div class="ocean-floaters" id="oceanFloaters">
              <p id="emptyMessage">No one's listening yet - play something on Spotify to start a wave.</p>
            </div>
          </div>
        </div>

        <div class="song-panel-backdrop" id="songBackdrop"></div>
        <div class="song-panel" id="songPanel" role="dialog" aria-modal="true" aria-hidden="true">
          <button class="song-panel-close" id="songPanelClose" type="button" aria-label="Close">&times;</button>
          <div class="song-panel-art" id="songPanelArtWrap"></div>
          <div class="song-panel-progress"><div class="song-panel-progress-fill" id="songPanelProgressFill"></div></div>
          <div class="song-panel-times"><span id="songPanelCurrentTime">0:00</span><span id="songPanelDuration">0:00</span></div>
          <div class="song-panel-transport">
            <button class="song-panel-playpause" id="songPanelPlayPause" type="button" aria-label="Playback status" disabled>
              <svg id="songIconPlay" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <svg id="songIconPause" viewBox="0 0 24 24" hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
            </button>
            <span class="song-panel-status-label" id="songPanelStatusLabel">Playing</span>
          </div>
          <div class="song-panel-title" id="songPanelTitle"></div>
          <div class="song-panel-artist" id="songPanelArtist"></div>
          <span class="song-panel-listeners" id="songPanelListeners"></span>

          <div class="song-panel-actions">
            <button id="joinBtn" type="button">Join on Spotify</button>
            <button id="followBtn" type="button">Follow Along</button>
          </div>
          <p id="joinError"></p>

          <div class="song-panel-host-row">
            <span class="song-panel-host-name">Started by <b id="hostNameText">-</b></span>
            <a id="hostProfileLink" href="#" target="_blank" rel="noopener">Spotify Profile</a>
          </div>
        </div>

        <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
        <script>
          (function () {
            var socket = io();
            var floatersEl = document.getElementById('oceanFloaters');
            var emptyMessage = document.getElementById('emptyMessage');

            var floaterEls = {};   // trackId -> element
            var groupData = {};    // trackId -> latest group data
            var laneUsage = [0, 0, 0, 0, 0, 0, 0, 0]; // how many bubbles have used each lane so far, for spacing
            var activeFloaterEl = null;
            var openTrackId = null;
            var myTrackId = null;   // whatever track I'm personally listening to right now (playing OR paused)
            var isFollowingSomeone = false;

            // More lanes + spacing-aware placement than before, to reduce
            // the odds of two different songs' bubbles overlapping when
            // several are floating at once.
            // BUBBLE HEIGHT (vertical position) - these are % from the
            // bottom of the ocean region. Lower numbers = closer to the
            // wave; higher numbers = higher up the screen. To raise or
            // lower the whole band, shift every value up or down together
            // (e.g. ['30%','34%',...,'58%'] moves bubbles higher).
            var LANE_BOTTOMS = ['20%', '24%', '28%', '32%', '36%', '40%', '44%', '48%'];
            var BASE_DURATION = 30; // seconds to cross the screen

            function coverHTML(group) {
              if (group.albumArt) return '<img src="' + group.albumArt + '" alt="' + group.trackName + ' cover art">';
              var initial = (group.trackName || '?').trim().charAt(0).toUpperCase() || '\u266a';
              return '<div class="generated-cover">' + initial + '</div>';
            }

            function formatMs(ms) {
              if (!ms && ms !== 0) return '0:00';
              var totalSeconds = Math.floor(ms / 1000);
              var m = Math.floor(totalSeconds / 60);
              var s = totalSeconds % 60;
              return m + ':' + (s < 10 ? '0' + s : s);
            }

            function pickLaneAndDelay() {
              // Choose whichever lane has been used the least so far, then
              // stagger its phase (delay) based on how many bubbles have
              // already used it, spreading them evenly along the path
              // instead of bunching at the same spot at the same time.
              var laneIndex = 0;
              for (var i = 1; i < LANE_BOTTOMS.length; i++) {
                if (laneUsage[i] < laneUsage[laneIndex]) laneIndex = i;
              }
              var usageCount = laneUsage[laneIndex]++;
              var phaseSlots = 3; // how many staggered starting points per lane
              var delay = -((usageCount % phaseSlots) / phaseSlots) * BASE_DURATION;
              return { bottom: LANE_BOTTOMS[laneIndex], delay: delay };
            }

            function renderFloater(group) {
              var el = floaterEls[group.trackId];

              if (!el) {
                el = document.createElement('button');
                el.type = 'button';
                el.className = 'floater';
                var placement = pickLaneAndDelay();
                el.style.animationDuration = BASE_DURATION + 's';
                el.style.animationDelay = placement.delay + 's';
                el.style.bottom = placement.bottom;
                el.setAttribute('aria-label', 'Open ' + group.trackName + ' by ' + group.artist);
                el.innerHTML = coverHTML(group) + '<span class="listener-badge"></span>';
                el.addEventListener('click', function () { openSongPanel(group.trackId); });
                floatersEl.appendChild(el);
                floaterEls[group.trackId] = el;
              }

              el.classList.toggle('paused-state', !group.isPlaying);
              var badge = el.querySelector('.listener-badge');
              badge.textContent = group.listenerCount;
              badge.style.display = group.listenerCount > 1 ? 'flex' : 'none';

              emptyMessage.style.display = 'none';
            }

            function sinkFloater(trackId) {
              var el = floaterEls[trackId];
              if (!el) return;
              el.classList.add('sinking');
              window.setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
                delete floaterEls[trackId];
              }, 2200);
              if (activeFloaterEl === el) activeFloaterEl = null;
              if (openTrackId === trackId) closeSongPanel();
            }

            function openSongPanel(trackId) {
              var group = groupData[trackId];
              if (!group) return;

              // Clicking a bubble pauses ONLY its own drifting animation,
              // in this browser only - it has no effect on anyone else's
              // screen and does not touch Spotify playback at all.
              if (activeFloaterEl) activeFloaterEl.classList.remove('active');
              var floaterEl = floaterEls[trackId];
              if (floaterEl) {
                floaterEl.classList.add('active');
                activeFloaterEl = floaterEl;
              }

              openTrackId = trackId;
              document.getElementById('songPanelArtWrap').innerHTML = coverHTML(group);
              document.getElementById('songPanelTitle').textContent = group.trackName;
              document.getElementById('songPanelArtist').textContent = group.artist;
              document.getElementById('songPanelListeners').textContent =
                group.listenerCount + (group.listenerCount === 1 ? ' listener' : ' listeners');
              document.getElementById('hostNameText').textContent = group.hostDisplayName || 'someone';
              var profileLink = document.getElementById('hostProfileLink');
              if (group.hostProfileUrl) {
                profileLink.href = group.hostProfileUrl;
                profileLink.style.display = 'inline-block';
              } else {
                profileLink.style.display = 'none';
              }

              updatePanelPlaybackState(group);
              document.getElementById('joinError').textContent = '';
              updateActionButtons();

              document.getElementById('songPanel').classList.add('open');
              document.getElementById('songPanel').setAttribute('aria-hidden', 'false');
              document.getElementById('songBackdrop').classList.add('open');
            }

            function updatePanelPlaybackState(group) {
              document.getElementById('songIconPlay').hidden = group.isPlaying;
              document.getElementById('songIconPause').hidden = !group.isPlaying;
              document.getElementById('songPanelStatusLabel').textContent = group.isPlaying ? 'Playing' : 'Paused';
              var pct = group.durationMs ? Math.min(100, (group.progressMs / group.durationMs) * 100) : 0;
              document.getElementById('songPanelProgressFill').style.width = pct + '%';
              document.getElementById('songPanelCurrentTime').textContent = formatMs(group.progressMs);
              document.getElementById('songPanelDuration').textContent = formatMs(group.durationMs);
            }

            function closeSongPanel() {
              document.getElementById('songPanel').classList.remove('open');
              document.getElementById('songPanel').setAttribute('aria-hidden', 'true');
              document.getElementById('songBackdrop').classList.remove('open');
              if (activeFloaterEl) {
                activeFloaterEl.classList.remove('active');
                activeFloaterEl = null;
              }
              openTrackId = null;
            }

            function updateActionButtons() {
              var joinBtn = document.getElementById('joinBtn');
              var followBtn = document.getElementById('followBtn');
              var group = groupData[openTrackId];
              var isMyOwnTrack = openTrackId && myTrackId === openTrackId;
              var isMyOwnHostedTrack = group && isMyOwnTrack; // I'm the one who started this exact bubble

              if (isMyOwnTrack) {
                joinBtn.textContent = 'Already listening';
                joinBtn.disabled = true;
              } else {
                joinBtn.textContent = 'Join on Spotify';
                joinBtn.disabled = false;
              }

              // Can't follow yourself, and the button reflects whether
              // you're currently following THIS specific song's host.
              followBtn.disabled = !!isMyOwnHostedTrack;
              followBtn.classList.toggle('following', isFollowingSomeone && !isMyOwnHostedTrack && followBtn.dataset.followingTrackId === openTrackId);
              followBtn.textContent = followBtn.classList.contains('following') ? 'Following' : 'Follow Along';
            }

            document.getElementById('songPanelClose').addEventListener('click', closeSongPanel);
            document.getElementById('songBackdrop').addEventListener('click', closeSongPanel);

            document.getElementById('joinBtn').addEventListener('click', function () {
              var group = groupData[openTrackId];
              if (!group) return;
              var errorEl = document.getElementById('joinError');
              errorEl.textContent = '';

              fetch('/spotify/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackUri: group.trackUri, trackId: group.trackId })
              })
                .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
                .then(function (result) {
                  if (!result.res.ok) {
                    errorEl.textContent = result.body.error || 'Could not join';
                    return;
                  }
                  myTrackId = group.trackId;
                  isFollowingSomeone = false; // manual join clears any follow, mirrors the server
                  updateActionButtons();
                })
                .catch(function (err) {
                  errorEl.textContent = 'Network error joining song - is Spotify open on this device?';
                  console.error(err);
                });
            });

            document.getElementById('followBtn').addEventListener('click', function () {
              var btn = document.getElementById('followBtn');
              var errorEl = document.getElementById('joinError');
              errorEl.textContent = '';
              var alreadyFollowingThis = btn.classList.contains('following');
              var request = alreadyFollowingThis
                ? fetch('/spotify/unfollow', { method: 'POST' })
                : fetch('/spotify/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trackId: openTrackId })
                  });

              request
                .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
                .then(function (result) {
                  if (!result.res.ok) {
                    errorEl.textContent = result.body.error || 'Could not update Follow Along';
                    return;
                  }
                  isFollowingSomeone = !alreadyFollowingThis;
                  btn.dataset.followingTrackId = isFollowingSomeone ? openTrackId : '';
                  updateActionButtons();
                })
                .catch(function (err) {
                  errorEl.textContent = 'Network error updating Follow Along';
                  console.error(err);
                });
            });

            // Real-time ocean updates (every ~1s from the server's poller)
            socket.on('oceanUpdate', function (groups) {
              var newTrackIds = {};
              groups.forEach(function (g) { newTrackIds[g.trackId] = true; });

              Object.keys(floaterEls).forEach(function (trackId) {
                if (!newTrackIds[trackId]) sinkFloater(trackId);
              });

              groupData = {};
              groups.forEach(function (g) {
                groupData[g.trackId] = g;
                renderFloater(g);
              });

              if (groups.length === 0) emptyMessage.style.display = 'block';

              if (openTrackId && groupData[openTrackId]) {
                updatePanelPlaybackState(groupData[openTrackId]);
                document.getElementById('songPanelListeners').textContent =
                  groupData[openTrackId].listenerCount + (groupData[openTrackId].listenerCount === 1 ? ' listener' : ' listeners');
              } else if (openTrackId && !groupData[openTrackId]) {
                closeSongPanel();
              }
            });

            // Poll MY OWN currently-playing separately, regardless of
            // playing/paused state, once per second (matches the
            // server's poll rate) - keeps "Join"/"Follow" button state
            // accurate even while I'm paused on my own track.
            function pollMyStatus() {
              fetch('/spotify/currently-playing')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                  myTrackId = data.trackId || null;
                  if (openTrackId) updateActionButtons();
                })
                .catch(function () { /* non-fatal */ });
            }
            pollMyStatus();
            setInterval(pollMyStatus, 1000);
          })();
        </script>
      </body>
    </html>
  `);
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (useMemoryStore) {
    console.warn(
      'DATABASE_URL not set - using in-memory token storage (fine for local testing, tokens reset on restart).'
    );
  }
  // Refill the ocean's in-memory "who has which border equipped" from the
  // database, so markers keep their borders across a server restart.
  getAllEquippedBorders().then((rows) => {
    for (const row of rows) oceanState.setUserActiveEffect(row.spotify_user_id, row.css_class);
  });
  startOceanPoller(io);
  startChallengeScheduler(io);
  console.log('Ocean poller started - checking all logged-in users every 1s.');
});
