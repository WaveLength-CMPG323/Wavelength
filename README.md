# WaveLength — Frontend

A living ocean of music: floating album art shows what people are listening
to right now, with profiles, chat, groups, and weekly challenges built on
top.

## Tech stack

- **React 19** + **TypeScript**
- **Tailwind CSS v4** — styling
- **Framer Motion** — panel/modal animations
- **React Router** — client-side routing
- **lucide-react** — icon set
- **HTML5 Canvas API** — the ocean itself (waves + drifting album-art markers)

All app data currently comes from a mock layer backed by `localStorage` —
there is no backend yet.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL.

Other commands:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm run lint        # oxlint
```

## Routes

| Route | Page | Auth required |
|---|---|---|
| `/` | Ocean — landing page, visible logged out | No |
| `/login` | Mock "Connect with Spotify" login | No |
| `/profile` | Your profile | Yes |
| `/users/:id` | Another user's profile | Yes |
| `/chat` | Chat — Friends & Groups tabs | Yes |

Logged-out visitors can browse the ocean and open the player, but anything
that would persist (saving, liking, following, chat, profile) redirects to
`/login`.

## File structure

```
src/
  data/
    types.ts          # shared data model (Song, AppUser, Group, etc.)
    mockData.ts        # seed data + localStorage read/write, swap for a real API later
    DataContext.tsx     # React context exposing db + mutation helpers
    AuthContext.tsx     # mock logged-in/guest state
  components/
    NavPanel.tsx         # shared centered-modal shell (Notifications, Challenge, Create Group)
    PageHeader.tsx        # back-to-home header used on non-Ocean pages
    Cover.tsx              # album art with a deterministic placeholder fallback
    icons/
      OceanWaveIcon.tsx      # custom wave glyph
  features/
    ocean/
      OceanPage.tsx           # main landing page
      OceanNav.tsx              # top nav bar
      useOceanCanvas.ts          # canvas renderer: waves, drifting markers, hit-testing
    song-details/
      SongDetailsPanel.tsx        # slide-up panel opened from a marker
    player/
      PlayerBar.tsx                 # bottom playback bar (mock playback)
    auth/
      LoginPage.tsx                   # mock Spotify login
      RequireAuth.tsx                  # route guard
    profile/
      MyProfilePage.tsx                 # your own editable profile
      UserProfilePage.tsx                # another user's profile
    chat/
      ChatPage.tsx                         # Friends/Groups inbox
      Conversation.tsx                      # shared message thread view
      CreateGroupPanel.tsx                   # create-group form
    notifications/
      NotificationsPanel.tsx                   # pending chat requests
    challenges/
      WeeklyChallengePanel.tsx                   # current challenge + submission
  App.tsx        # route definitions
  main.tsx        # entry point, wraps app in providers
  index.css        # Tailwind import + base theme

public/
  avatars/    # placeholder user/group icons
  covers/     # placeholder album art
```

## Known gaps

- **No backend.** `src/data/mockData.ts` is a drop-in stand-in for a real
  REST/Socket.IO API — swap its functions for real calls and keep the same
  signatures so `features/` components don't need to change.
- **No real Spotify OAuth.** `LoginPage.tsx`'s button is a fake delay, not a
  PKCE redirect.
- **No real playback.** `PlayerBar.tsx` simulates a progress bar; no audio
  plays.
- **Real-time sync is polling, not sockets.** `DataContext.tsx` re-reads
  localStorage every few seconds as a stand-in for a shared Socket.IO
  connection.
