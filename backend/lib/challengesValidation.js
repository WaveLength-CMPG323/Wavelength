
 //Returns: { isValid: boolean, message?: string }

// Spotify's album.release_date is "YYYY", "YYYY-MM" or "YYYY-MM-DD" depending
// on how precisely the release is dated.
function releaseYear(trackData) {
  const year = parseInt((trackData.album?.release_date || '').substring(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

// A Date for the (possibly partial) release date - missing month/day count
// as the END of that period, so a bare "2026" isn't wrongly treated as
// January 1st when checking "within the last 12 months".
function releaseDateEnd(trackData) {
  const raw = trackData.album?.release_date;
  if (!raw) return null;
  const [y, m, d] = raw.split('-').map((part) => parseInt(part, 10));
  if (Number.isNaN(y)) return null;
  if (!m) return new Date(Date.UTC(y, 11, 31));
  if (!d) return new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this one
  return new Date(Date.UTC(y, m - 1, d));
}

// Whole-word match against a title ("Blue" matches "Blue Moon" but not
// "Blueprint") so keyword challenges aren't satisfied by accident.
function titleHasAnyWord(trackData, words) {
  const titleWords = (trackData.name || '').toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
  return words.some((word) => titleWords.includes(word));
}

const COLOUR_WORDS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'grey', 'gray',
  'gold', 'golden', 'silver', 'brown', 'violet', 'indigo', 'crimson', 'scarlet', 'turquoise',
];
const NIGHT_WORDS = ['night', 'nights', 'midnight', 'moon', 'moonlight', 'star', 'stars', 'dark', 'darkness'];

const validators = {
  // Songs released before the year 2000
  'Throwback Anthems': (trackData) => {
    const year = releaseYear(trackData) ?? 2026;
    if (year >= 2000) {
      return {
        isValid: false,
        message: 'This track was released in or after 2000. "Throwback Anthems" requires tracks from before 2000.',
      };
    }
    return { isValid: true };
  },

  // Songs with "gold" in the title
  'Golden Tide': (trackData) => {
    const trackTitle = trackData.name || '';
    if (!trackTitle.toLowerCase().includes('gold')) {
      return {
        isValid: false,
        message: 'This track does not feature "gold" in its title as required by "Golden Tide".',
      };
    }
    return { isValid: true };
  },

  // Lesser-known tracks. Spotify's `popularity` (0-100) isn't guaranteed to
  // be returned to every app anymore - when it's missing this passes
  // rather than rejecting everything.
  'Hidden Gems': (trackData) => {
    if (typeof trackData.popularity === 'number' && trackData.popularity >= 45) {
      return {
        isValid: false,
        message: 'This track is too well known for "Hidden Gems" - pick something less mainstream.',
      };
    }
    return { isValid: true };
  },

  'Short & Sweet': (trackData) => {
    if (typeof trackData.duration_ms === 'number' && trackData.duration_ms >= 180000) {
      return { isValid: false, message: 'This track is 3 minutes or longer. "Short & Sweet" needs something under 3:00.' };
    }
    return { isValid: true };
  },

  'Epic Journey': (trackData) => {
    if (typeof trackData.duration_ms === 'number' && trackData.duration_ms < 360000) {
      return { isValid: false, message: 'This track is under 6 minutes. "Epic Journey" needs something 6:00 or longer.' };
    }
    return { isValid: true };
  },

  'Eighties Rewind': (trackData) => {
    const year = releaseYear(trackData);
    if (year === null || year < 1980 || year > 1989) {
      return { isValid: false, message: 'This track wasn\'t released in the 1980s. "Eighties Rewind" needs a 1980-1989 release.' };
    }
    return { isValid: true };
  },

  'Fresh Waves': (trackData) => {
    const released = releaseDateEnd(trackData);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    if (!released || released < cutoff) {
      return { isValid: false, message: 'This track is more than 12 months old. "Fresh Waves" needs a recent release.' };
    }
    return { isValid: true };
  },

  'Night Owl': (trackData) => {
    if (!titleHasAnyWord(trackData, NIGHT_WORDS)) {
      return { isValid: false, message: 'This track has no night-time word in its title (night, midnight, moon, star, dark) as required by "Night Owl".' };
    }
    return { isValid: true };
  },

  'Colour Wave': (trackData) => {
    if (!titleHasAnyWord(trackData, COLOUR_WORDS)) {
      return { isValid: false, message: 'This track has no colour in its title as required by "Colour Wave".' };
    }
    return { isValid: true };
  },

  'One-Word Wonder': (trackData) => {
    // Ignore a trailing "(feat. ...)" / " - Remastered" style suffix.
    const base = (trackData.name || '').split(/\s[-(\[]/)[0].trim();
    if (base.split(/\s+/).filter(Boolean).length !== 1) {
      return { isValid: false, message: 'This track\'s title is more than one word. "One-Word Wonder" needs a single-word title.' };
    }
    return { isValid: true };
  },
};

/**
 * Dynamically selects and runs the correct validator function based on the challenge theme.
 * @param {string} theme - The theme string fetched from the challenges table.
 * @param {object} trackData - The full track object returned by the Spotify API.
 * @returns {object} Validation result { isValid, message }
 */
function validateChallengeSubmission(theme, trackData) {
  const validator = validators[theme];

  if (!validator) {
    // Fallback if a theme doesn't have a strict validator function yet
    return { isValid: true };
  }

  return validator(trackData);
}

module.exports = { validateChallengeSubmission, validators };
