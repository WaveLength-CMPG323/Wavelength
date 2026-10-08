import { randomCover } from '../data/mockData';
import type { Song, CatalogEntry } from '../data/types';

// Renders a song's square album art. Anything without artwork falls back to a
// deterministic placeholder from public/covers/ (chosen by title+artist, so the
// same track always gets the same art) rather than a text letter.
export default function Cover({ song, className = '' }: { song: Song | CatalogEntry; className?: string }) {
  const explicit = 'cover' in song ? song.cover : null;
  const src = explicit || randomCover(song.title + song.artist);
  return <img src={src} alt={`${song.title} cover art`} className={`h-full w-full object-cover ${className}`} />;
}
