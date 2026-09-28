import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Force an explicit IPv4 bind. Left as the hostname 'localhost',
    // some setups (notably Windows) resolve it to the IPv6 loopback only,
    // AND - separately - the backend's session cookie needs the frontend
    // on the exact same host string as the backend (127.0.0.1) for the
    // browser to treat them as the same "site" and actually send it.
    // Spotify's redirect_uri policy also requires 127.0.0.1 over
    // 'localhost' now, so this keeps everything on one consistent host.
    host: '127.0.0.1',
  },
})
