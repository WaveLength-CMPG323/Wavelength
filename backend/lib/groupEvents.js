// Live push for group changes, so people see a kick / promotion / "you were
// added" straight away instead of waiting for the frontend's 8-second poll.
//
//   group:changed { groupId }  -> members: re-fetch your groups (roster or roles changed)
//   group:removed { groupId, reason: 'kicked' } -> the person who was removed
//
// Sockets are matched on the real Spotify account id the socket
// authenticated with (see io.use() in server.js).

function groupRoomId(groupId) {
  return `group:${groupId}`; // must match getGroupRoomId() in server.js
}

async function socketsFor(io, spotifyUserIds) {
  const wanted = new Set(spotifyUserIds.filter(Boolean));
  if (!io || wanted.size === 0) return [];
  const sockets = await io.fetchSockets();
  return sockets.filter((socket) => wanted.has(socket.data.spotifyUserId));
}

async function notifyUsers(io, spotifyUserIds, event, payload) {
  try {
    for (const socket of await socketsFor(io, spotifyUserIds)) socket.emit(event, payload);
  } catch (error) {
    console.error(`Could not send ${event}:`, error.message);
  }
}

// Takes a removed person's live connections out of the group's room so they
// stop receiving its messages immediately.
async function removeFromGroupRoom(io, spotifyUserId, groupId) {
  try {
    for (const socket of await socketsFor(io, [spotifyUserId])) socket.leave(groupRoomId(groupId));
  } catch (error) {
    console.error('Could not remove user from group room:', error.message);
  }
}

module.exports = { notifyUsers, removeFromGroupRoom };
