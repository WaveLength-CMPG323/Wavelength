import { useEffect, useState } from 'react';
import QuotaPopup from './QuotaPopup';
import { API_URL } from '../lib/api';
import { getSocket } from '../lib/socket';

interface QuotaStatus {
  reached: boolean;
  retryAfterSeconds: number;
}

function messageFor(status: QuotaStatus): string {
  const mins = Math.ceil(status.retryAfterSeconds / 60);
  const hours = Math.round(status.retryAfterSeconds / 3600);
  const when = mins <= 1 ? 'a minute' : mins < 90 ? `${mins} minutes` : `${hours} hours`;
  const wait = status.retryAfterSeconds > 0 ? ` It should clear in about ${when}.` : '';
  return `Spotify's request quota for Wavelength has been reached, so the ocean may be slow or paused.${wait} It resumes on its own.`;
}

// Listens for the backend's "Spotify quota reached" signal (live over the
// socket, plus one check on load) and shows a pop-up. Dismissing it hides it
// for this episode; it comes back if the quota is hit again later.
export default function QuotaWatcher() {
  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function apply(next: QuotaStatus) {
      setStatus(next);
      if (next.reached) setDismissed(false);
    }

    fetch(`${API_URL}/spotify/quota`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: QuotaStatus | null) => {
        if (body && !cancelled) apply(body);
      })
      .catch(() => {});

    const socket = getSocket();
    socket.on('spotify:quota', apply);
    return () => {
      cancelled = true;
      socket.off('spotify:quota', apply);
    };
  }, []);

  const open = !!status?.reached && !dismissed;
  return <QuotaPopup open={open} message={status ? messageFor(status) : ''} onClose={() => setDismissed(true)} />;
}
