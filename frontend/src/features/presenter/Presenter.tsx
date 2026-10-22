import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STEPS, sleep, type Ctx, type Rect, type Target } from './steps';
import { PRESENTER_EVENT, PRESENTER_FLAG, PRESENTER_STEP } from './flags';

// Presenter mode: a spotlight that walks through the app one point of
// interest at a time. Space = next, Left = back. Everything here is
// pointer-events:none, so you can still click the real app underneath.
//
// Keys: Space/Right next · Left back · T script · H hide · A auto-setup · Q quit
// (while typing in a text box use Ctrl+Right / Ctrl+Left instead; Space also works in an empty one).

const AUTO_KEY = 'wl-presenter-auto';
const SAY_KEY = 'wl-presenter-say';

function readBool(key: string, fallback: boolean) {
  try {
    const v = sessionStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function writeBool(key: string, v: boolean) {
  try {
    sessionStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}
function readStep(): number {
  try {
    const n = parseInt(sessionStorage.getItem(PRESENTER_STEP) ?? '-1', 10);
    return Number.isFinite(n) ? Math.max(-1, Math.min(STEPS.length, n)) : -1;
  } catch {
    return -1;
  }
}

interface Box extends Rect {
  r: number;
  a: number;
}

function normalise(target: Target): { rect: Rect; radius: number; el: HTMLElement | null } | null {
  if (!target) return null;
  const items = Array.isArray(target) ? target : [target];
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  let first: HTMLElement | null = null;
  for (const item of items) {
    if (!item) continue;
    let r: Rect;
    if (item instanceof HTMLElement) {
      const b = item.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      r = { x: b.left, y: b.top, w: b.width, h: b.height };
      if (!first) first = item;
    } else {
      r = item;
    }
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  if (!isFinite(x1)) return null;
  let radius = 14;
  if (first) {
    const cs = getComputedStyle(first);
    const parsed = parseFloat(cs.borderTopLeftRadius);
    if (Number.isFinite(parsed)) radius = parsed;
  }
  return { rect: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, radius, el: first };
}

export default function Presenter() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState<number>(readStep);
  const [showSay, setShowSay] = useState(() => readBool(SAY_KEY, false));
  const [auto, setAuto] = useState(() => readBool(AUTO_KEY, true));
  const [hidden, setHidden] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [pillTop, setPillTop] = useState(false);

  const idxRef = useRef(idx);
  const autoRef = useRef(auto);
  const hiddenRef = useRef(hidden);
  const busyRef = useRef(false);
  const needScrollRef = useRef(false);
  const spotRef = useRef<HTMLDivElement | null>(null);
  autoRef.current = auto;
  hiddenRef.current = hidden;

  const ctx: Ctx = { navigate: (p) => navigate(p) };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const setStep = useCallback((n: number) => {
    idxRef.current = n;
    setIdx(n);
    try {
      sessionStorage.setItem(PRESENTER_STEP, String(n));
    } catch {
      /* ignore */
    }
  }, []);

  const move = useCallback(
    async (dir: 1 | -1) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        let n = idxRef.current + dir;
        // Skip optional steps whose element is not on the page (e.g. the
        // logged-out welcome when you are already logged in).
        while (n >= 0 && n < STEPS.length && STEPS[n].optional && !normalise(STEPS[n].find())) n += dir;
        n = Math.max(-1, Math.min(STEPS.length, n));
        if (n === idxRef.current) return;
        setStep(n);
        needScrollRef.current = true;
        const step = STEPS[n];
        if (step && autoRef.current) {
          try {
            if (step.route && window.location.pathname !== step.route) {
              ctxRef.current.navigate(step.route);
              await sleep(700);
            }
            if (step.ensure) await step.ensure(ctxRef.current);
          } catch {
            /* auto-setup is best effort */
          }
          needScrollRef.current = true;
        }
      } finally {
        busyRef.current = false;
      }
    },
    [setStep]
  );

  const quit = useCallback(() => {
    try {
      sessionStorage.removeItem(PRESENTER_FLAG);
      sessionStorage.removeItem(PRESENTER_STEP);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(PRESENTER_EVENT));
  }, []);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const k = e.key;

      if (e.ctrlKey) {
        if (k === 'ArrowRight') {
          e.preventDefault();
          void move(1);
        } else if (k === 'ArrowLeft') {
          e.preventDefault();
          void move(-1);
        }
        return;
      }
      // Space still means "next" in a text box that is empty (e.g. the song search
      // right after you click Join), because there is nothing to type a space into yet.
      const emptyField =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && (t as HTMLInputElement).value === '';
      if (typing && !(k === ' ' && emptyField)) return;

      switch (k) {
        case ' ':
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          void move(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          void move(-1);
          break;
        case 't':
        case 'T':
          setShowSay((v) => {
            writeBool(SAY_KEY, !v);
            return !v;
          });
          break;
        case 'h':
        case 'H':
          setHidden((v) => !v);
          break;
        case 'a':
        case 'A':
          setAuto((v) => {
            writeBool(AUTO_KEY, !v);
            return !v;
          });
          break;
        case 'q':
        case 'Q':
          quit();
          break;
      }
    }
    // A focused button would otherwise "click" itself when Space is released.
    function onKeyUp(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const empty = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && (t as HTMLInputElement).value === '';
      if (e.key === ' ' && (!typing || empty)) e.preventDefault();
    }
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [move, quit]);

  /* ---------- spotlight follow loop ---------- */
  useEffect(() => {
    const cur: Box = { x: 0, y: 0, w: 0, h: 0, r: 14, a: 0 };
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    let found: ReturnType<typeof normalise> = null;
    let cache: Target = null;
    let lastIdx = -99;
    let missingSince = 0;
    let waitingNow = false;
    let pillTopNow = false;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame++;
      const step = idxRef.current >= 0 && idxRef.current < STEPS.length ? STEPS[idxRef.current] : null;

      if (lastIdx !== idxRef.current) {
        lastIdx = idxRef.current;
        found = null;
        cache = null;
        missingSince = performance.now();
      }

      // Re-find the element a few times a second (React may replace nodes),
      // but re-measure it every frame so the spotlight tracks animations.
      if (step) {
        const stale =
          frame % 4 === 0 ||
          !cache ||
          (Array.isArray(cache) ? cache.some((c) => c && !c.isConnected) : cache instanceof HTMLElement && !cache.isConnected);
        if (stale) cache = step.find();
        found = normalise(cache);
      } else {
        found = null;
      }

      // Bring the target into view once per step.
      if (found && needScrollRef.current) {
        needScrollRef.current = false;
        if (found.el) {
          const b = found.el.getBoundingClientRect();
          if (b.top < 70 || b.bottom > window.innerHeight - 24) {
            found.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      }

      const pad = step?.pad ?? 8;
      const k = 1 - Math.exp(-dt * 14);
      if (found && !hiddenRef.current) {
        const tx = found.rect.x - pad;
        const ty = found.rect.y - pad;
        const tw = found.rect.w + pad * 2;
        const th = found.rect.h + pad * 2;
        const tr = Math.min(found.radius + pad, Math.min(tw, th) / 2);
        if (cur.a < 0.05) {
          cur.x = tx;
          cur.y = ty;
          cur.w = tw;
          cur.h = th;
          cur.r = tr;
        } else {
          cur.x += (tx - cur.x) * k;
          cur.y += (ty - cur.y) * k;
          cur.w += (tw - cur.w) * k;
          cur.h += (th - cur.h) * k;
          cur.r += (tr - cur.r) * k;
        }
        cur.a += (1 - cur.a) * (1 - Math.exp(-dt * 10));
        missingSince = performance.now();
      } else {
        cur.a += (0 - cur.a) * (1 - Math.exp(-dt * 10));
      }

      const el = spotRef.current;
      if (el) {
        el.style.opacity = String(cur.a);
        el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
        el.style.width = `${cur.w}px`;
        el.style.height = `${cur.h}px`;
        el.style.borderRadius = `${cur.r}px`;
        el.classList.toggle('wl-nodim', step?.dim === false);
      }

      // Keep the script pill clear of whatever is lit up.
      const wantTop = !!found && found.rect.y + found.rect.h / 2 > window.innerHeight * 0.55;
      if (wantTop !== pillTopNow) {
        pillTopNow = wantTop;
        setPillTop(wantTop);
      }

      const shouldWait = !!step && !!step.hint && !found && !hiddenRef.current && performance.now() - missingSince > 1400;
      if (shouldWait !== waitingNow) {
        waitingNow = shouldWait;
        setWaiting(shouldWait);
      }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const step = idx >= 0 && idx < STEPS.length ? STEPS[idx] : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden="true">
      <style>{`
        @keyframes wl-present-pulse { 0% { transform: scale(1); opacity: .75 } 100% { transform: scale(1.06); opacity: 0 } }
        .wl-present-spot { position: absolute; left: 0; top: 0; opacity: 0; will-change: transform, width, height;
          box-shadow: 0 0 0 9999px rgba(2, 8, 24, .68), 0 0 0 3px rgba(34, 211, 238, .95), 0 0 30px 6px rgba(34, 211, 238, .4); }
        .wl-present-spot.wl-nodim { box-shadow: 0 0 0 3px rgba(34, 211, 238, .95), 0 0 30px 6px rgba(34, 211, 238, .4); }
        .wl-present-spot::after { content: ''; position: absolute; inset: -3px; border-radius: inherit;
          border: 2px solid rgba(34, 211, 238, .8); animation: wl-present-pulse 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .wl-present-spot::after { animation: none } }
      `}</style>

      <div ref={spotRef} className="wl-present-spot" />

      {/* Start card: shown before the first Space, so nothing is on screen once you begin. */}
      {idx === -1 && !hidden && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-md rounded-2xl border border-cyan-400/40 bg-slate-950/90 p-6 text-center text-slate-100 shadow-2xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Presenter mode</p>
            <h2 className="mt-2 text-xl font-bold">Press Space to begin</h2>
            <ul className="mt-4 space-y-1 text-left text-sm text-slate-300">
              <li><b className="text-white">Space</b> or <b className="text-white">→</b> next point, <b className="text-white">←</b> back</li>
              <li><b className="text-white">T</b> show or hide the script line</li>
              <li><b className="text-white">H</b> hide the spotlight</li>
              <li><b className="text-white">A</b> auto-open panels and pages: {auto ? 'on' : 'off'}</li>
              <li><b className="text-white">Q</b> quit</li>
              <li>In a text box use <b className="text-white">Ctrl + →</b> to go next</li>
            </ul>
            <p className="mt-4 text-xs text-slate-400">Log out first if you want to start on the welcome message.</p>
          </div>
        </div>
      )}

      {/* Script line (teleprompter), off by default so it is not in the recording. */}
      {showSay && step && !hidden && (
        <div className={`absolute inset-x-0 flex justify-center px-4 ${pillTop ? 'top-16' : 'bottom-6'}`}>
          <div className="max-w-3xl rounded-2xl bg-slate-950/85 px-5 py-3 text-center text-slate-100 shadow-xl backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              {step.section} · {idx + 1} / {STEPS.length} · {step.title}
            </p>
            <p className="mt-1 text-base leading-snug">{step.say}</p>
          </div>
        </div>
      )}

      {/* Shown only if a required element is missing for a moment. */}
      {waiting && step?.hint && (
        <div className="absolute inset-x-0 top-20 flex justify-center px-4">
          <div className="rounded-full border border-cyan-400/50 bg-slate-950/85 px-4 py-1.5 text-sm text-cyan-100 shadow-lg">
            {step.hint}, then the highlight appears
          </div>
        </div>
      )}
    </div>
  );
}
