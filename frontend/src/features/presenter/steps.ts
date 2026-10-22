// The presenter-mode script: one entry per "point of interest", in the order
// of the video script. Each step says how to FIND its element on the page
// (so the spotlight can follow it), where it lives (route), and optionally how
// to get the page into the right state (ensure) when auto-setup is on.
//
// Auto-setup only ever navigates and opens or closes panels. It never clicks
// anything that changes data (Join, Request Chat, Accept, Save, Log in).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Target = HTMLElement | Rect | null | undefined | Array<HTMLElement | null | undefined>;

export interface Ctx {
  navigate: (path: string) => void;
}

export type Section = 'Overview' | 'Walkthrough' | 'Conclusion';

export interface Step {
  id: string;
  /** Which part of the video this step belongs to. */
  section: Section;
  title: string;
  /** The line from the video script, shown only when the script pill (T) is on. */
  say: string;
  route?: string;
  /** Skipped silently when its element is not on the page (e.g. logged-out steps). */
  optional?: boolean;
  /** Shown as a small "waiting" pill when a required element is missing. */
  hint?: string;
  pad?: number;
  /** false = just a glowing outline, no dimming of the rest of the screen. */
  dim?: boolean;
  find: () => Target;
  ensure?: (ctx: Ctx) => Promise<void>;
}

/* ---------- small DOM helpers ---------- */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor<T>(fn: () => T | null | undefined | false, ms = 3000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v as T;
    await sleep(80);
  }
  return null;
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

function q<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  for (const el of root.querySelectorAll<T>(sel)) if (visible(el)) return el;
  return null;
}

function byText<T extends HTMLElement = HTMLElement>(sel: string, re: RegExp, root: ParentNode = document): T | null {
  for (const el of root.querySelectorAll<T>(sel)) {
    if (visible(el) && re.test((el.textContent || '').trim())) return el;
  }
  return null;
}

async function goTo(ctx: Ctx, path: string) {
  if (window.location.pathname === path) return;
  ctx.navigate(path);
  await waitFor(() => window.location.pathname === path, 2500);
  await sleep(450);
}

/* ---------- page state helpers (open and close panels) ---------- */

const listenBtn = () => byText('button', /Listen on Spotify|Already listening|Starting/);
const searchInput = () => q<HTMLInputElement>('input[aria-label="Search or filter"]');
const challengeDialog = () => q('[role="dialog"][aria-label="Weekly Challenge"]');
const pickerDialog = () => q('[role="dialog"][aria-label="Profile border"]');
const changeBorderBtn = () => byText('button', /Change border|^Borders$/);
const joinDialog = () => q('[role="dialog"][aria-label="Join challenge"]');
const previewDialog = () => q('[role="dialog"][aria-label="Reward preview"]');

/** Close any song panel, challenge panel or challenge sub-panel that is open. */
async function closeOverlays() {
  for (let i = 0; i < 4; i++) {
    const sub = q(
      '[role="dialog"]:not([aria-labelledby="guest-welcome-title"]):not([aria-label="Weekly Challenge"]) button[aria-label="Close"]'
    );
    const panel = q('button[aria-label="Close panel"]');
    const song = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="Close"]')).find(
      (b) => visible(b) && !b.closest('[role="dialog"]')
    );
    const closer = sub || panel || song;
    if (!closer) return;
    closer.click();
    await sleep(500);
  }
}

/** Close the small panels that sit on top of the challenge panel (join, reward preview, border picker). */
async function closeSubDialogs() {
  for (let i = 0; i < 3; i++) {
    const sub = q(
      '[role="dialog"]:not([aria-labelledby="guest-welcome-title"]):not([aria-label="Weekly Challenge"]) button[aria-label="Close"]'
    );
    if (!sub) return;
    sub.click();
    await sleep(500);
  }
}

/** Open a song panel by picking the first result in the search list (no-op if one is already open). */
async function openSong(ctx: Ctx): Promise<boolean> {
  if (listenBtn()) return true;
  await goTo(ctx, '/');
  await closeOverlays();
  const input = searchInput();
  if (!input) return false;
  input.focus();
  const wrapper = input.closest('div.relative');
  const row = await waitFor(() => {
    const rows = wrapper?.querySelectorAll<HTMLElement>(':scope > div.absolute button');
    return rows && rows.length ? rows[0] : null;
  }, 3500);
  if (!row) {
    input.blur();
    return false;
  }
  row.click();
  input.blur();
  return !!(await waitFor(listenBtn, 3000));
}

async function openChallenge(ctx: Ctx): Promise<boolean> {
  if (challengeDialog()) {
    // Make sure a sub-panel from a later step is not covering it.
    if (pickerDialog()) await closeOverlays();
    return true;
  }
  await goTo(ctx, '/');
  await closeOverlays();
  const btn = q('button[aria-label="Weekly Challenge"]');
  if (!btn) return false;
  btn.click();
  return !!(await waitFor(challengeDialog, 4000));
}

/* ---------- targets ---------- */

function oceanRegion(): Rect {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return { x: 10, y: 64, w: W - 20, h: H - 76 };
}

const welcomeCard = () => q('[role="dialog"][aria-labelledby="guest-welcome-title"]');

function searchTarget(): Target {
  const input = searchInput();
  if (!input) return null;
  const pill = input.parentElement as HTMLElement | null;
  const dropdown = input.closest('div.relative')?.querySelector<HTMLElement>(':scope > div.absolute');
  return [pill, dropdown && visible(dropdown) ? dropdown : null];
}

/** The top-bar "Log in" link shown to guests. */
const navLogin = () => q<HTMLElement>('a[href="/login"]');
/** The Spotify button on the Wavelength login page. */
const loginPageBtn = () =>
  window.location.pathname === '/login' ? byText('button', /^(Log in with Spotify|Redirecting to Spotify…)$/) : null;

const section = (re: RegExp, tag: string) => byText(tag, re)?.closest<HTMLElement>('section') ?? null;
const heading = (re: RegExp) => byText('h3', re)?.parentElement ?? null;

/* ---------- the script ---------- */

export const STEPS: Step[] = [
  // ---------- OVERVIEW (about 1 minute) ----------
  {
    id: 'overview-welcome',
    section: 'Overview',
    title: 'Background and rationale',
    say: 'Hi, and welcome to Wavelength. Most of us listen to music on our own. We find new songs through algorithms and playlists, but we rarely get to see the people behind the music. Wavelength was built to change that. It is an ocean-themed social music app that connects to your Spotify account and turns what everyone is listening to into one shared ocean.',
    route: '/',
    // The welcome card when logged out, otherwise the whole ocean.
    find: () => welcomeCard() ?? oceanRegion(),
  },
  {
    id: 'overview-purpose',
    section: 'Overview',
    title: 'Purpose',
    say: 'Every square you see is a song someone is listening to on Spotify right now. You can open a song, listen along with the person playing it, chat with them once they accept your request, and join a challenge that changes every week. The purpose is simple: to help people discover music through other people and make listening feel social. While logged out, you can look around and watch as the songs float by,',
    route: '/',
    pad: 0,
    dim: false,
    find: oceanRegion,
  },
  // The next two are skipped automatically when you are already logged in.
  {
    id: 'login',
    section: 'Overview',
    title: 'Log in button',
    say: "but to open songs, chat and join challenges, you'll have to log in with Spotify.",
    optional: true,
    find: navLogin,
  },

  // ---------- SYSTEM WALKTHROUGH (4 to 7 minutes) ----------
  {
    id: 'login-demo',
    section: 'Walkthrough',
    title: 'Logging in',
    say: "Let me show you how it works. I will log in with Spotify. Wavelength uses Spotify's official login, so we never see my password, only a token that lets the app see what I am playing.",
    route: '/login',
    optional: true,
    // On the login page: its Spotify button. Before you get there: the top-bar
    // Log in link (so this step is not skipped while you are still on the ocean).
    find: () => loginPageBtn() ?? navLogin(),
  },

  // The ocean
  {
    id: 'ocean',
    section: 'Walkthrough',
    title: 'The ocean',
    say: 'After logging in, you are greeted with the main wave page. Hover over a square to see the song and artist. The green number on the square shows how many people are listening to it together. The glowing ring around this square is my own song, playing right now. The ocean updates live, so squares appear and sink as people start and stop listening.',
    route: '/',
    pad: 0,
    dim: false,
    ensure: closeOverlays,
    find: oceanRegion,
  },
  // Dark mode
  {
    id: 'theme',
    section: 'Walkthrough',
    title: 'Light and dark mode',
    say: 'If you prefer it dark, there is a dark mode. This switch in the top bar flips between day and night, and Wavelength remembers your choice.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: () => q('[role="switch"]'),
  },
  // Search
  {
    id: 'search',
    section: 'Walkthrough',
    title: 'Search',
    say: 'Here I can search for a song, an artist or a genre, and the squares that do not match fade away. Clicking a song in the search bar or on a square floating by opens that song.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: searchTarget,
  },

  // Song panel
  {
    id: 'listen',
    section: 'Walkthrough',
    title: 'Listen on Spotify',
    say: 'Listen on Spotify plays the song on your device where the host is at that moment. Wavelength controls your Spotify app instead of playing the audio itself, so Spotify needs to be open on a device.',
    route: '/',
    hint: 'Open a song',
    ensure: async (ctx) => {
      await openSong(ctx);
    },
    find: () => listenBtn(),
  },
  {
    id: 'follow',
    section: 'Walkthrough',
    title: 'Follow Along',
    say: 'Follow Along keeps you with the host, even when they skip. Listening and following need Spotify Premium.',
    hint: 'Open a song',
    find: () => byText('button', /Follow Along/),
  },

  // Weekly challenge
  {
    id: 'challenge-button',
    section: 'Walkthrough',
    title: 'Ride the Wave',
    say: 'Every week there is a new weekly challenge with a theme.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: () => q('button[aria-label="Weekly Challenge"]'),
  },
  {
    id: 'challenge-theme',
    section: 'Walkthrough',
    title: 'Theme and countdown',
    say: 'You join with a song that fits,',
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () => section(/^Weekly Theme$/, 'p') ?? byText('p', /^Weekly Theme$/)?.parentElement ?? null,
  },
  {
    id: 'challenge-entries',
    section: 'Walkthrough',
    title: 'Entries',
    say: "and everyone's entries show up here.",
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () => section(/^Challenge entries$/, 'h3'),
  },
  {
    id: 'challenge-join',
    section: 'Walkthrough',
    title: 'Join',
    say: 'To join, I press Join,',
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () =>
      byText('button', /Join this challenge/) ??
      byText<HTMLElement>('span', /Joined/)?.closest<HTMLElement>('div.inline-flex') ??
      null,
  },
  // You click Join yourself, then search and pick a song. Nothing here clicks it for you.
  {
    id: 'challenge-search',
    section: 'Walkthrough',
    title: 'Choose a song',
    say: 'search for a song that fits the theme and pick it,',
    hint: 'Click Join this challenge',
    find: joinDialog,
  },
  {
    id: 'challenge-confirm',
    section: 'Walkthrough',
    title: 'Confirm and submit',
    say: 'and confirm. After that, your submitted song will start playing in the ocean.',
    hint: 'Pick a song first',
    find: () => byText('button', /^(Confirm & submit entry|Submitting…)$/),
  },
  {
    id: 'reward',
    section: 'Walkthrough',
    title: 'Limited-time border',
    say: "Joining a challenge wins you that week's limited-time border,",
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () => q('button[title="Preview this border"]'),
  },
  // You click Preview yourself.
  {
    id: 'reward-preview',
    section: 'Walkthrough',
    title: 'Reward preview',
    say: 'and the preview shows how it looks.',
    hint: 'Click Preview',
    find: previewDialog,
  },
  {
    id: 'change-border',
    section: 'Walkthrough',
    title: 'Change border',
    say: 'Now I can choose which border to wear. Change border opens my collection,',
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await closeSubDialogs();
      await openChallenge(ctx);
    },
    find: changeBorderBtn,
  },
  {
    id: 'border-picker',
    section: 'Walkthrough',
    title: 'Pick a border',
    say: 'and whichever I pick shows around my picture and my song, even in chats.',
    hint: 'Click Change border',
    ensure: async (ctx) => {
      if (pickerDialog()) return; // you already opened it yourself
      await openChallenge(ctx);
      if (!pickerDialog()) {
        await closeSubDialogs();
        changeBorderBtn()?.click();
        await waitFor(pickerDialog, 2500);
      }
    },
    find: pickerDialog,
  },

  // Profile
  {
    id: 'profile-icon',
    section: 'Walkthrough',
    title: 'Your picture',
    say: 'Your picture opens your profile.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in to see your profile',
    find: () => q('a[aria-label="Your profile"]'),
  },
  {
    id: 'profile-fields',
    section: 'Walkthrough',
    title: 'Nickname and bio',
    say: 'Here you can set a nickname and a bio.',
    route: '/profile',
    hint: 'Log in to see your profile',
    find: () => byText('label', /^Nickname$/)?.closest<HTMLElement>('div.space-y-4') ?? null,
  },
  {
    id: 'profile-genres',
    section: 'Walkthrough',
    title: 'Top genres',
    say: 'Below that you can see your top genres',
    hint: 'Open your profile',
    find: () => heading(/^Top genres$/),
  },
  {
    id: 'profile-recent',
    section: 'Walkthrough',
    title: 'Recently played',
    say: 'and what you played recently,',
    hint: 'Open your profile',
    find: () => heading(/^Recently played$/),
  },
  {
    id: 'profile-playlists',
    section: 'Walkthrough',
    title: 'Public playlists',
    say: 'as well as your public playlists, pulled straight from Spotify.',
    hint: 'Open your profile',
    find: () => heading(/^Public playlists$/),
  },
  {
    id: 'profile-save',
    section: 'Walkthrough',
    title: 'Save changes',
    say: 'Just remember to click Save changes.',
    hint: 'Open your profile',
    find: () => byText('button', /^(Save changes|Saving…)$/),
  },

  // Meeting people and chat
  {
    id: 'host-card',
    section: 'Walkthrough',
    title: 'The host',
    say: 'To start chatting with someone, open their song, press on their profile',
    route: '/',
    hint: 'Open a song',
    ensure: async (ctx) => {
      await openSong(ctx);
    },
    find: () => q('a[href^="/hosts/"]'),
  },
  {
    id: 'request-chat',
    section: 'Walkthrough',
    title: 'Request Chat',
    say: 'and press Request Chat. You cannot message strangers, because the other person has to accept first.',
    hint: "Open a host's profile",
    ensure: async (ctx) => {
      if (window.location.pathname.startsWith('/hosts/')) return;
      if (await openSong(ctx)) {
        q('a[href^="/hosts/"]')?.click();
        await waitFor(() => window.location.pathname.startsWith('/hosts/'), 2500);
        await sleep(600);
      }
    },
    find: () => byText('button', /^(Request Chat|Already friends|Request sent|Sending…)$/),
  },
  {
    id: 'bell',
    section: 'Walkthrough',
    title: 'Notifications',
    say: "They'll get a notification under the bell icon,",
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: () => q('button[aria-label="Notifications"]'),
  },
  {
    id: 'chat-icon',
    section: 'Walkthrough',
    title: 'Chat',
    say: 'and when they accept you become friends and can message each other.',
    route: '/',
    hint: 'Log in or open the ocean page',
    find: () => q('button[aria-label="Chat"]'),
  },
  {
    id: 'chat-friends',
    section: 'Walkthrough',
    title: 'Friends',
    say: 'Your friends live on the chat page, in one to one conversations. Messages are saved, so the history is still here after I log out and back in.',
    route: '/chat',
    hint: 'Open the Chat page',
    ensure: async () => {
      byText('nav button', /friends/i)?.click();
      await sleep(250);
    },
    find: () => q('aside'),
  },
  {
    id: 'chat-groups',
    section: 'Walkthrough',
    title: 'Groups',
    say: 'You can also start a group with your friends. Whoever creates a group is its admin, who can add people and make moderators, and moderators can remove members.',
    route: '/chat',
    hint: 'Open the Chat page',
    ensure: async () => {
      byText('nav button', /groups/i)?.click();
      await sleep(350);
    },
    find: () => byText('button', /New group/) ?? byText('nav button', /groups/i),
  },

  // ---------- CONCLUSION (under 1 minute) ----------
  {
    id: 'wrap-up',
    section: 'Conclusion',
    title: 'Wrap-up and limits',
    say: "That is Wavelength: one shared ocean where every square is a real person listening right now. Two limits to know about. Because we use Spotify's Web API, songs play in your own Spotify app and not inside the website. And Spotify's rules mean we cannot save songs to Liked Songs or show other people's followers, recently played songs or public playlists.",
    route: '/',
    pad: 0,
    dim: false,
    ensure: closeOverlays,
    find: oceanRegion,
  },
  {
    id: 'outro',
    section: 'Conclusion',
    title: 'Thank you',
    say: 'Thank you for watching. Log in with Spotify and make some waves.',
    route: '/',
    ensure: closeOverlays,
    find: () => null,
  },
];
