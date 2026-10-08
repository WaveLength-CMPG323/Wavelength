// A small in-memory cache mapping a Spotify artist id -> their genre
// list, so the ocean poller (every 2s, for every listener) doesn't call
// Spotify's Get Artist endpoint over and over for the same artist - an
// artist's genres essentially never change, so this is safe to cache for
// the lifetime of the process. Deliberately NOT persisted to Postgres:
// it's a pure performance cache, fine to lose and rebuild on restart,
// same spirit as oceanState.js's in-memory sessions map.
//
// `pending` dedupes concurrent lookups for the same artist - with many
// listeners polling in parallel (see spotifyPoller.js's Promise.all),
// several sessions can hit an uncached artist in the same poll tick;
// without this they'd all fire their own Spotify request instead of
// sharing the one in flight.
const cache = new Map(); // artistId -> string[]
const pending = new Map(); // artistId -> Promise<string[]>

async function getGenresForArtist(artistId, accessToken, fetchGenres) {
  if (!artistId) return [];
  if (cache.has(artistId)) return cache.get(artistId);
  if (pending.has(artistId)) return pending.get(artistId);

  const promise = fetchGenres(accessToken, artistId)
    .then((genres) => {
      cache.set(artistId, genres);
      pending.delete(artistId);
      return genres;
    })
    .catch((err) => {
      // Best-effort - a failed genre lookup shouldn't break the poll for
      // this session. Cache an empty result so a persistently-failing
      // artist (e.g. a bad id) doesn't get retried every single poll
      // cycle forever.
      console.error(`Could not fetch genres for artist ${artistId}:`, err.response?.data || err.message);
      cache.set(artistId, []);
      pending.delete(artistId);
      return [];
    });

  pending.set(artistId, promise);
  return promise;
}

module.exports = { getGenresForArtist };
