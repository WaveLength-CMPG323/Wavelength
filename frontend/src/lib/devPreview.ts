// DEV-ONLY preview mode: lets you work on the signed-in UI without the
// backend or Spotify OAuth. Auth, REST calls and the Socket.IO ocean feed
// are all faked (see previewData.ts).
//
// Turn it on (any one of these):
//   - open the app with  ?preview=1   (remembered in localStorage)
//   - set VITE_DEV_PREVIEW=true in frontend/.env
// Turn it off:  ?preview=0  (or remove the env var)
//
// Safety: `import.meta.env.DEV` is replaced with `false` by Vite in
// production builds, so this whole feature compiles down to nothing in
// `npm run build` - it can never bypass auth in a deployed app.
const STORAGE_KEY = 'wavelength.devPreview';

function detect(): boolean {
  if (!import.meta.env.DEV) return false;
  const fromEnv = import.meta.env.VITE_DEV_PREVIEW === 'true';
  try {
    const flag = new URLSearchParams(window.location.search).get('preview');
    if (flag === '1') localStorage.setItem(STORAGE_KEY, '1');
    if (flag === '0') {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return fromEnv || localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return fromEnv;
  }
}

export const PREVIEW_MODE: boolean = import.meta.env.DEV && detect();

export function exitPreviewMode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.location.href = window.location.pathname + '?preview=0';
}
