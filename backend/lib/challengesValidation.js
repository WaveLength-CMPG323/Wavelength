
 //Returns: { isValid: boolean, message?: string }

const validators = {
  // Challenge 1: Songs released before the year 2000
  'Throwback Anthems': (trackData) => {
    const releaseDate = trackData.album?.release_date; // e.g., "1995-05-12" or "1984"
    const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : 2026;
    
    if (releaseYear >= 2000) {
      return {
        isValid: false,
        message: 'This track was released in or after 2000. "Throwback Anthems" requires tracks from before 2000.'
      };
    }
    return { isValid: true };
  },

  // Challenge 2: Songs with "gold" in the title
  'Golden Tide': (trackData) => {
    const trackTitle = trackData.name || '';
    const keyword = 'gold';
    
    if (!trackTitle.toLowerCase().includes(keyword)) {
      return {
        isValid: false,
        message: 'This track does not feature "gold" in its title as required by "Golden Tide".'
      };
    }
    return { isValid: true };
  }
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

module.exports = { validateChallengeSubmission };