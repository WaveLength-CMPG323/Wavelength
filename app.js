/* ============================================================
   Simple CSS Waves — shared app data layer
   Everything here is mocked with localStorage so the multi-page
   prototype behaves consistently as you click between pages.
   ============================================================ */

var CSS_APP = (function () {
  var KEY = 'csswaves_db_v1';

  function seed() {
    return {
      me: {
        id: 'me',
        name: 'You',
        pic: 'profile4.png', // wavelength picture mirrors the Spotify picture by default
        genres: [],
        nickname: '',
        bio: '',
        spotifyUsername: 'you.on.spotify',
        spotifyPic: 'profile4.png'
      },
      users: {
        u1: { id: 'u1', name: 'Jake Doe', pic: 'profile1.png', followers: 1280, following: 54, listening: 's3', followedByMe: false, chatStatus: 'friend' },
        u2: { id: 'u2', name: 'Mia Chen', pic: 'profile2.png', followers: 542, following: 210, listening: 's1', followedByMe: false, chatStatus: 'none' },
        u3: { id: 'u3', name: 'Theo Park', pic: 'profile3.png', followers: 89, following: 130, listening: null, followedByMe: true, chatStatus: 'friend' }
      },
      songs: {
        s1: { id: 's1', title: 'Blooming of Me', artist: 'Artist Name', cover: 'cover1.png', ownerId: 'u1' },
        s2: { id: 's2', title: 'Flower', artist: 'Artist Name', cover: 'cover2.png', ownerId: 'u2' },
        s3: { id: 's3', title: 'Peace of Mind', artist: 'Jake Doe', cover: 'cover3.png', ownerId: 'u1' }
      },
      floaterOrder: ['s1', 's2', 's3'],
      chats: {
        u1: [
          { from: 'u1', text: 'hey! did you catch my new upload?', ts: Date.now() - 1000 * 60 * 60 },
          { from: 'me', text: 'listening now, it\'s great', ts: Date.now() - 1000 * 60 * 55 }
        ],
        u3: [
          { from: 'u3', text: 'joining the lo-fi group tonight?', ts: Date.now() - 1000 * 60 * 30 }
        ]
      },
      groups: {
        g1: { id: 'g1', name: 'Late Night Lo-fi', icon: 'profile3.png', members: ['me', 'u1', 'u3'] }
      },
      notifications: [
        { id: 'n1', userId: 'u2', status: 'pending' },
        { id: 'n2', userId: 'u3', status: 'pending' }
      ],
      hasNotifDot: true,
      hasChatDot: true,
      challenge: {
        theme: 'NOSTALGIA',
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
        mySubmission: null // { songId } — cleared automatically at the start of each new weekly challenge
      }
    };
  }

  var CHALLENGE_THEMES = ['NOSTALGIA', '80S', 'RAINY DAY', 'MIDNIGHT DRIVE', 'FIRST LOVE', 'SUMMER HEAT', 'HOMECOMING'];

  // A stand-in for a real Spotify catalog search — lets a person submit ANY
  // song to the weekly challenge, not just one already floating in the
  // ocean. Since there's no real Spotify connection here, covers are
  // generated placeholders rather than real artwork.
  var SPOTIFY_CATALOG = [
    { title: 'Take On Me', artist: 'a-ha' },
    { title: 'Yesterday Once More', artist: 'The Carpenters' },
    { title: 'Blinding Lights', artist: 'The Weeknd' },
    { title: 'Nights', artist: 'Frank Ocean' },
    { title: 'Landslide', artist: 'Fleetwood Mac' },
    { title: 'Electric Feel', artist: 'MGMT' },
    { title: 'Sunflower', artist: 'Rex Orange County' },
    { title: 'Redbone', artist: 'Childish Gambino' },
    { title: 'Dreams', artist: 'Fleetwood Mac' },
    { title: 'Midnight City', artist: 'M83' },
    { title: 'Circles', artist: 'Post Malone' },
    { title: 'Ribs', artist: 'Lorde' },
    { title: 'Home', artist: 'Edward Sharpe & The Magnetic Zeros' },
    { title: 'Two Slow Dancers', artist: 'Mitski' },
    { title: 'Blue', artist: 'Yung Kai' },
    { title: 'Missing You', artist: 'John Waite' },
    { title: 'Sweater Weather', artist: 'The Neighbourhood' },
    { title: 'Golden', artist: 'Harry Styles' }
  ];

  function searchSpotifyCatalog(query) {
    var q = query.trim().toLowerCase();
    if (q === '') return [];
    return SPOTIFY_CATALOG.filter(function (s) {
      return s.title.toLowerCase().indexOf(q) !== -1 || s.artist.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
  }

  function hashColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    var hue = Math.abs(hash) % 360;
    return 'hsl(' + hue + ', 55%, 45%)';
  }

  // If the current weekly challenge's 7-day window has closed, roll over to a
  // fresh theme + deadline and clear the submission flag so the person can
  // enter again — this is what enforces "once per week".
  function rolloverChallengeIfNeeded(db) {
    if (Date.now() >= db.challenge.deadline) {
      var nextTheme = CHALLENGE_THEMES[Math.floor(Math.random() * CHALLENGE_THEMES.length)];
      db.challenge = {
        theme: nextTheme,
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
        mySubmission: null
      };
      save(db);
    }
    return db;
  }

  function load() {
    var raw = localStorage.getItem(KEY);
    if (!raw) {
      var fresh = seed();
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
    var db;
    try {
      db = JSON.parse(raw);
    } catch (e) {
      db = seed();
      localStorage.setItem(KEY, JSON.stringify(db));
      return db;
    }
    return migrate(db);
  }

  // One-time fixes applied to data already saved in someone's browser from
  // an earlier version of the app, so they don't have to clear everything.
  function migrate(db) {
    if (!db._migrations) db._migrations = {};
    var changed = false;

    if (!db._migrations.resetSubmissionAndSyncSpotifyPic) {
      // Clear out a stuck weekly-challenge submission from testing.
      if (db.challenge && db.challenge.mySubmission) {
        var oldSongId = db.challenge.mySubmission.songId;
        if (db.songs && db.songs[oldSongId]) delete db.songs[oldSongId];
        var idx = db.floaterOrder ? db.floaterOrder.indexOf(oldSongId) : -1;
        if (idx !== -1) db.floaterOrder.splice(idx, 1);
        db.challenge.mySubmission = null;
      }
      // New rule: the in-app (wavelength) profile picture mirrors whatever
      // picture came from Spotify.
      if (!db.me.spotifyPic) db.me.spotifyPic = 'profile4.png';
      db.me.pic = db.me.spotifyPic;

      db._migrations.resetSubmissionAndSyncSpotifyPic = true;
      changed = true;
    }

    if (changed) save(db);
    return db;
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function reset() {
    localStorage.removeItem(KEY);
    return load();
  }

  return {
    load: load,
    save: save,
    reset: reset,
    rolloverChallengeIfNeeded: rolloverChallengeIfNeeded,
    searchSpotifyCatalog: searchSpotifyCatalog,
    hashColor: hashColor
  };
})();

/* Small shared helpers */
function cssFormatCountdown(msRemaining) {
  if (msRemaining < 0) msRemaining = 0;
  var totalSeconds = Math.floor(msRemaining / 1000);
  var d = Math.floor(totalSeconds / 86400);
  var h = Math.floor((totalSeconds % 86400) / 3600);
  var m = Math.floor((totalSeconds % 3600) / 60);
  var s = totalSeconds % 60;
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  return d + 'd ' + pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
}

function cssTimeAgo(ts) {
  var diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return diff + 'm ago';
  var hrs = Math.floor(diff / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function cssAvatarHTML(pic, alt) {
  if (pic) return '<img src="' + pic + '" alt="' + alt + '">';
  return '';
}

/* Renders a song's cover — a real image if one exists, otherwise a
   generated color block with the song's initial (used for songs added
   from the mock Spotify search, which have no real artwork). */
function cssCoverHTML(song) {
  if (song.cover) return '<img src="' + song.cover + '" alt="' + song.title + ' cover art">';
  var initial = song.title.trim().charAt(0).toUpperCase() || '♪';
  var color = CSS_APP.hashColor(song.title + song.artist);
  return '<div class="generated-cover" style="background:' + color + ';">' + initial + '</div>';
}
