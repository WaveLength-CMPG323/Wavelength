import { useEffect, useRef, useState } from 'react';
import type { Song } from '../../data/types';
import { useTheme } from '../../data/ThemeContext';
import { BORDER_ART_SCALE, borderLayerUrl, borderMotion, isBorderKey } from '../../lib/borders';

export interface OceanMarker {
  id: string; // song id
  song: Song;
  isMine: boolean;
  listenerCount: number;
  // Cosmetic reward css_class the host of this marker currently has
  // equipped (a key of BORDERS in lib/borders.ts; anything else/null
  // means no border), from OceanGroup.activeEffectCss - see oceanState.js.
  activeEffectCss?: string | null;
}

interface Options {
  markers: OceanMarker[];
  onSelect: (songId: string) => void;
  imageResolver: (song: Song) => string | null; // returns image URL, or null for a generated cover
}

const MARKER_SIZE = 62;   // square album art, px
const MARKER_RADIUS = MARKER_SIZE / 2;
const CORNER = 10;        // rounded-corner radius on the square
const WAVE_COUNT = 3;
// How long a bubble takes to sink out of view once its song stops
// appearing in `markers` (song ended, or everyone paused/left) - matches
// the 2200ms sinking animation in the backend's own test dashboard
// (server.js's sinkFloater()).
const SINK_DURATION_MS = 2200;
const SINK_DISTANCE = 70; // px, how far down it drifts while sinking

// Every canvas-drawn color that needs to change with the theme is a
// { night, day } RGBA pair, blended by `mix` (see blend() below) as it
// eases toward the current theme over THEME_FADE_SECONDS - matching
// --wl-theme-duration in index.css so the water fades in step with the
// sky behind it (SkyScene.tsx) instead of snapping. Night values are
// exactly what this file hardcoded before theming existed, so dark mode
// stays pixel-identical; day values are new, chosen for legibility
// against a bright sky.
type RGBA = [number, number, number, number];
const THEME_FADE_SECONDS = 1.2; // matches --wl-theme-duration in index.css

function blend(night: RGBA, day: RGBA, mix: number): string {
  // mix: 1 = night, 0 = day
  const c = night.map((n, i) => day[i] + (n - day[i]) * mix);
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
}

// Each wave band: how far down the canvas its resting line sits (0 = top, 1 = bottom),
// its own amplitude/wavelength/speed and a colour, back-to-front (drawn in this order).
const WAVE_BANDS: {
  baseline: number; amplitude: number; wavelength: number; speed: number; night: RGBA; day: RGBA;
}[] = [
  { baseline: 0.58, amplitude: 16, wavelength: 220, speed: 0.35, night: [34, 211, 238, 0.12], day: [8, 112, 200, 0.16] },
  { baseline: 0.72, amplitude: 20, wavelength: 260, speed: 0.5, night: [34, 211, 238, 0.22], day: [8, 112, 200, 0.26] },
  { baseline: 0.86, amplitude: 24, wavelength: 300, speed: 0.7, night: [34, 211, 238, 0.38], day: [8, 112, 200, 0.4] },
];
// The sea body under the waves (the sky above the horizon is DOM, not
// canvas - see <SkyScene /> in OceanPage.tsx).
const SEA_TOP: { night: RGBA; day: RGBA } = { night: [4, 56, 90, 1], day: [150, 214, 244, 1] };
const SEA_BOTTOM: { night: RGBA; day: RGBA } = { night: [10, 74, 110, 1], day: [58, 158, 214, 1] };

// Light-ray shafts (fraction of canvas width/height) - base geometry only;
// draw() applies a slow sway + width/opacity pulse on top of these each
// frame (see LIGHT_RAYS.forEach below). `seed` just staggers each ray's
// cycle so they don't all sway/pulse in lockstep. These represent
// sunlight shining down THROUGH the water (not the sky itself), so they
// stay anchored to the sea surface rather than fading with the theme.
const LIGHT_RAYS = [
  { topStart: 0.32, topEnd: 0.43, bottomStart: 0.48, bottomEnd: 0.59, bottomHeightFrac: 0.72, seed: 0 },
  { topStart: 0.57, topEnd: 0.64, bottomStart: 0.68, bottomEnd: 0.75, bottomHeightFrac: 0.58, seed: 2.1 },
];
const LIGHT_RAY_COLOR: { night: RGBA; day: RGBA } = { night: [125, 211, 252, 1], day: [255, 255, 255, 1] };

// Ambient background bubbles rising through the water, and the "isMine"
// particle trail - both reuse the same two-tone tint.
const BUBBLE_COLOR: { night: RGBA; day: RGBA } = { night: [165, 243, 252, 1], day: [255, 255, 255, 1] };

// Ring/particle colors for a marker that's the viewer's OWN currently-
// playing track ("isMine") vs. one they're just hovering - kept visually
// distinct so the two states never look identical.
const MINE_RING_COLOR: { night: RGBA; day: RGBA } = { night: [59, 130, 246, 1], day: [37, 99, 235, 1] }; // vivid azure/electric blue
const HOVER_RING_COLOR: { night: RGBA; day: RGBA } = { night: [34, 211, 238, 1], day: [10, 111, 159, 1] }; // cyan (night) / wl-link (day)

// Badge ring/text matches the page shell (wl-bg) so the listener-count
// badge's outline keeps reading as "cut into" the background in both themes.
const BADGE_RING_COLOR: { night: RGBA; day: RGBA } = { night: [2, 24, 43, 1], day: [232, 244, 253, 1] };

// A stable per-song hash so a track's wave lane (and starting speed/phase)
// depends on its own Spotify track ID, not on its position in the current
// list. Index-based assignment (i % 3) meant a song's lane was really just
// "how many other songs happened to be playing before it" - with only one
// song active, that's always index 0, always lane 0. Hashing the id gives
// every song its own pseudo-random-looking, but consistent, lane.
function hashString(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface MarkerRuntime {
  id: string;
  lane: number; // which of the 3 waves it rides, alternated by index
  x: number; // current x in px
  speed: number; // px/sec, left -> right
  phase: number; // small per-marker vertical offset so same-lane markers don't overlap in rhythm
  song: Song; // last-known song data, kept around while sinking (after it's gone from `markers`)
  isMine: boolean;
  listenerCount: number;
  activeEffectCss: string | null;
  sinkStartTime: number | null; // performance.now() timestamp when it started sinking, or null
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function useOceanCanvas({ markers, onSelect, imageResolver }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Day/night blend (1 = night, 0 = day). Starts at the current theme so
  // there's no fade on first load; the draw loop eases it toward the
  // target whenever isDark flips, in step with SkyScene/index.css.
  const { isDark } = useTheme();
  const themeTargetRef = useRef(isDark ? 1 : 0);
  themeTargetRef.current = isDark ? 1 : 0;
  const themeMixRef = useRef(isDark ? 1 : 0);

  const runtimeRef = useRef<Map<string, MarkerRuntime>>(new Map());
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const hoveredRef = useRef<string | null>(null);
  // Every marker's last-drawn hit box (in canvas-local px), refreshed each
  // frame in draw(). Clicks are hit-tested against THIS directly (see
  // onClick below) rather than reusing whatever hoveredRef happened to be
  // set to - hoveredRef only ever gets updated by pointermove, which touch
  // devices never fire before a tap (there's no "hover" on a touchscreen),
  // so a tap's own click event would find hoveredRef still at its initial
  // null and silently do nothing. That's almost certainly why the panel
  // wouldn't open for at least some people - it had nothing to do with any
  // particular song or account, just whichever input device/browser
  // happened to skip pointermove before click.
  const hitBoxesRef = useRef<Map<string, { left: number; top: number; size: number }>>(new Map());

  // The canvas/animation-loop effect below only runs once on mount (an
  // expensive setup we don't want to tear down and rebuild every render).
  // Its click handler closes over `onSelect` though, so without this ref it
  // would permanently use whatever `onSelect` (and whatever it captured,
  // like isLoggedIn) looked like at that first render - e.g. "logged out",
  // if login was still being checked - and never see it change again. This
  // keeps the click handler reading the latest `onSelect` every time.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Keep a stable lane/speed/x per marker id across re-renders (e.g. when the
  // search filter changes), only creating runtime state for markers that are
  // new. Markers that disappear from `markers` (song ended / everyone left)
  // aren't deleted immediately - they're flagged to sink (see draw()) and
  // only removed once that animation finishes.
  function syncRuntime(time: number) {
    const seen = new Set<string>();
    markersRef.current.forEach((m) => {
      seen.add(m.id);
      const existing = runtimeRef.current.get(m.id);
      if (!existing) {
        const h = hashString(m.id);
        runtimeRef.current.set(m.id, {
          id: m.id,
          lane: h % WAVE_COUNT, // per-song, not per-list-position - see hashString
          // Every new song always starts just off the left edge (same
          // starting point the wrap-around uses below), then drifts right
          // at its own speed. This used to be
          // `(i / markersRef.current.length) * width`, which placed a
          // brand-new marker based on its index among whatever songs
          // happened to already be playing - so depending on how many
          // other songs were live and where this one landed in that list,
          // it could spawn anywhere from the left edge to the middle of
          // the screen instead of consistently sliding in from the left.
          // A small per-song stagger (from the hash) keeps several songs
          // that spawn in the same tick from overlapping exactly.
          x: -MARKER_RADIUS - (h % 40),
          speed: 26 + (h % 20), // slightly different speeds so they don't all move in lockstep
          phase: (h % 100) / 100 * Math.PI * 2,
          song: m.song,
          isMine: m.isMine,
          listenerCount: m.listenerCount,
          activeEffectCss: m.activeEffectCss ?? null,
          sinkStartTime: null,
        });
      } else {
        // Still around - keep its song/isMine snapshot fresh, and cancel
        // sinking if it somehow reappeared mid-animation.
        existing.song = m.song;
        existing.isMine = m.isMine;
        existing.listenerCount = m.listenerCount;
        existing.activeEffectCss = m.activeEffectCss ?? null;
        existing.sinkStartTime = null;
      }
    });
    runtimeRef.current.forEach((rt, id) => {
      if (seen.has(id)) return;
      if (rt.sinkStartTime === null) {
        rt.sinkStartTime = time; // just disappeared this frame - start sinking
      } else if (time - rt.sinkStartTime >= SINK_DURATION_MS) {
        runtimeRef.current.delete(id); // animation finished - actually remove it
      }
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const ctx = ctx2d;

    function resize() {
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function getImage(url: string): HTMLImageElement {
      let img = imagesRef.current.get(url);
      if (!img) {
        img = new Image();
        img.src = url;
        imagesRef.current.set(url, img);
      }
      return img;
    }

    function waveY(bandIndex: number, x: number, t: number, w: number, h: number) {
      const band = WAVE_BANDS[bandIndex];
      return h * band.baseline + Math.sin(x / band.wavelength + t * band.speed) * band.amplitude
        + Math.sin(x / (band.wavelength * 0.4) + t * band.speed * 1.6) * (band.amplitude * 0.25)
        - w * 0; // (w unused directly, kept for signature symmetry)
    }

    let raf = 0;
    let lastTime = performance.now();

    function draw(time: number) {
      if (!canvas || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      const t = time / 1000;

      syncRuntime(time);

      // Ease the day/night blend toward the current theme.
      const target = themeTargetRef.current;
      const step = Math.min(0.25, dt) / THEME_FADE_SECONDS; // real time, so the fade stays in step with the CSS sky even at low fps
      const curMix = themeMixRef.current;
      themeMixRef.current = curMix < target ? Math.min(target, curMix + step) : Math.max(target, curMix - step);
      const mRaw = themeMixRef.current;
      const mix = mRaw * mRaw * (3 - 2 * mRaw); // smoothstep

      // Transparent canvas: the sky is rendered behind it by <SkyScene />.
      ctx.clearRect(0, 0, w, h);

      // Sea body: everything below the back wave's line (the sky above the
      // horizon is <SkyScene />, not canvas).
      const seaTop = h * WAVE_BANDS[0].baseline - WAVE_BANDS[0].amplitude * 1.3;
      const sea = ctx.createLinearGradient(0, seaTop, 0, h);
      sea.addColorStop(0, blend(SEA_TOP.night, SEA_TOP.day, mix));
      sea.addColorStop(1, blend(SEA_BOTTOM.night, SEA_BOTTOM.day, mix));
      ctx.beginPath();
      ctx.moveTo(0, waveY(0, 0, t, w, h));
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, waveY(0, x, t, w, h));
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = sea;
      ctx.fill();

      // Light rays entering from the surface + rising background bubbles
      // (ported from the redesigned mockup's ocean background layer) -
      // purely decorative, drawn after the base gradient and before the
      // wave bands so the bands still read clearly on top of it. These are
      // sunlight shining down THROUGH the water, so they're anchored to
      // the sea surface (seaTop) rather than the very top of the canvas,
      // which is now sky (SkyScene), not water.
      //
      // Each ray slowly sways side to side and pulses its width/opacity,
      // all on very long (~100s+) periods with small amplitudes, so it
      // reads as ambient underwater light shifting rather than anything
      // that draws the eye on its own.
      const [rr, rg, rb] = blend(LIGHT_RAY_COLOR.night, LIGHT_RAY_COLOR.day, mix)
        .slice(5, -1)
        .split(',')
        .map(Number);
      ctx.save();
      LIGHT_RAYS.forEach((ray) => {
        const sway = Math.sin(t * 0.06 + ray.seed) * 0.02; // +-2% of width, slow drift
        const widthScale = 1 + Math.sin(t * 0.045 + ray.seed * 1.6) * 0.18; // gentle width pulse
        const alphaScale = 0.7 + Math.sin(t * 0.05 + ray.seed * 2.3) * 0.3; // gentle brightness pulse

        const topCenter = (ray.topStart + ray.topEnd) / 2 + sway;
        const topHalfWidth = ((ray.topEnd - ray.topStart) / 2) * widthScale;
        const bottomCenter = (ray.bottomStart + ray.bottomEnd) / 2 + sway;
        const bottomHalfWidth = ((ray.bottomEnd - ray.bottomStart) / 2) * widthScale;
        const topY = seaTop;
        const bottomY = Math.max(topY + 1, h * ray.bottomHeightFrac);

        // Sunlight shafts read as a strange set of pale lines at night
        // (there's no sun lighting the water then) - rather than just
        // recoloring them for dark mode, fade them out entirely as `mix`
        // eases toward night (1 - mix), smoothly in step with the same
        // THEME_FADE_SECONDS transition everything else here already
        // uses, so they're fully gone by the time night mode settles and
        // fully back by day, with no hard on/off snap mid-transition.
        const nightFade = 1 - mix;
        const rayGradient = ctx.createLinearGradient(0, topY, 0, bottomY);
        rayGradient.addColorStop(0, `rgba(${rr},${rg},${rb},${(0.055 * alphaScale * nightFade).toFixed(4)})`);
        rayGradient.addColorStop(1, `rgba(${rr},${rg},${rb},0)`);
        ctx.fillStyle = rayGradient;
        ctx.beginPath();
        ctx.moveTo(w * (topCenter - topHalfWidth), topY);
        ctx.lineTo(w * (topCenter + topHalfWidth), topY);
        ctx.lineTo(w * (bottomCenter + bottomHalfWidth), bottomY);
        ctx.lineTo(w * (bottomCenter - bottomHalfWidth), bottomY);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();

      const bubbleWaterH = Math.max(1, h - seaTop);
      for (let i = 0; i < 24; i++) {
        const bubbleX = (i * 137 + 70) % Math.max(w, 1);
        const bubbleY = h - ((t * (9 + (i % 5) * 2) + i * 79) % bubbleWaterH);
        const bubbleSize = 1.3 + (i % 4) * 0.7;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
        ctx.fillStyle = blend([...BUBBLE_COLOR.night.slice(0, 3), 0.16] as RGBA, [...BUBBLE_COLOR.day.slice(0, 3), 0.3] as RGBA, mix);
        ctx.fill();
      }

      // Three wave bands, back to front.
      WAVE_BANDS.forEach((band, bandIndex) => {
        ctx.beginPath();
        ctx.moveTo(0, waveY(bandIndex, 0, t, w, h));
        for (let x = 0; x <= w; x += 8) {
          ctx.lineTo(x, waveY(bandIndex, x, t, w, h));
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = blend(band.night, band.day, mix);
        ctx.fill();
      });

      // Markers: drift left -> right along their assigned wave, wrapping around.
      // A marker whose song just ended keeps drawing from its frozen runtime
      // snapshot while it sinks (see syncRuntime) instead of vanishing.
      //
      // Position update happens here, BEFORE any drawing, in its own pass -
      // so the per-lane spacing pass right after it can see every marker's
      // post-drift x before anything is rendered. Without doing it as a
      // separate pass first, spacing could only ever compare a marker
      // against ones already drawn earlier in the same loop, missing half
      // the pairs and letting bubbles later in iteration order sail
      // straight through ones drawn before them.
      runtimeRef.current.forEach((rt) => {
        if (rt.sinkStartTime === null) {
          rt.x += rt.speed * dt;
          if (rt.x > w + MARKER_RADIUS) rt.x = -MARKER_RADIUS;
        }
      });

      // Enforce a minimum horizontal gap between bubbles sharing the same
      // wave lane, so a faster bubble catching up to a slower one ahead of
      // it queues up right behind instead of visibly overlapping it -
      // bubbles only ever move left-to-right, so this is the same trick as
      // cars queuing on a single lane: walk from the leader (largest x)
      // backward, and pull any follower that's gotten too close back to a
      // fixed distance behind. Sinking bubbles are frozen in place and
      // left out of this - they're on their way out, not worth spacing
      // against.
      const MIN_GAP = MARKER_SIZE * 1.15;
      const byLane: MarkerRuntime[][] = Array.from({ length: WAVE_COUNT }, () => []);
      runtimeRef.current.forEach((rt) => {
        if (rt.sinkStartTime === null) byLane[rt.lane].push(rt);
      });
      byLane.forEach((lane) => {
        lane.sort((a, b) => a.x - b.x);
        for (let i = lane.length - 2; i >= 0; i--) {
          if (lane[i + 1].x - lane[i].x < MIN_GAP) {
            lane[i].x = lane[i + 1].x - MIN_GAP;
          }
        }
      });

      let hovered: string | null = null;
      hitBoxesRef.current.clear();
      runtimeRef.current.forEach((rt) => {
        const sinking = rt.sinkStartTime !== null;
        const sinkP = sinking ? Math.min(1, (time - rt.sinkStartTime!) / SINK_DURATION_MS) : 0;

        const surfaceY = waveY(rt.lane, rt.x, t, w, h);
        const bob = sinking ? 0 : Math.sin(t * 1.4 + rt.phase) * 4;
        const x = rt.x;
        const y = surfaceY - MARKER_SIZE * 0.32 + bob + sinkP * SINK_DISTANCE;

        const scale = 1 - sinkP * 0.4;
        const size = MARKER_SIZE * scale;
        const half = size / 2;
        const left = x - half;
        const top = y - half;

        ctx.save();
        ctx.globalAlpha = 1 - sinkP;
        if (sinkP > 0) {
          ctx.filter = `grayscale(${sinkP}) brightness(${1 - sinkP * 0.3})`;
        }

        // Soft drop shadow so the art reads against the water.
        ctx.save();
        ctx.shadowColor = 'rgba(15,23,42,0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        roundedRect(ctx, left, top, size, size, CORNER * scale);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.restore();

        // Square album art, clipped to the rounded square.
        ctx.save();
        roundedRect(ctx, left, top, size, size, CORNER * scale);
        ctx.clip();
        const url = imageResolver(rt.song);
        if (url) {
          const img = getImage(url);
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, left, top, size, size);
          } else {
            ctx.fillStyle = '#2c7fb8';
            ctx.fillRect(left, top, size, size);
          }
        } else {
          ctx.fillStyle = '#2c7fb8';
          ctx.fillRect(left, top, size, size);
        }
        ctx.restore();

        // Equipped border (weekly-challenge reward): the two art layers drawn
        // around the marker, animated with the same formulas the DOM version
        // uses (borderMotion). Drawn before the mine/hover ring so that ring
        // still reads on top, and inside the sink fade (globalAlpha above) so
        // it fades with a sinking bubble.
        if (isBorderKey(rt.activeEffectCss)) {
          const artSize = size * BORDER_ART_SCALE;
          for (const layer of [2, 1] as const) {
            const art = getImage(borderLayerUrl(rt.activeEffectCss, 'square', layer));
            if (!art.complete || art.naturalWidth === 0) continue;
            const motion = borderMotion('square', layer, t);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((motion.rotateDeg * Math.PI) / 180);
            const drawn = artSize * motion.scale;
            ctx.drawImage(art, -drawn / 2, -drawn / 2, drawn, drawn);
            ctx.restore();
          }
        }

        if (!sinking && (rt.isMine || hoveredRef.current === rt.id)) {
          roundedRect(ctx, left - 2, top - 2, size + 4, size + 4, CORNER + 2);
          const ringColor = rt.isMine ? MINE_RING_COLOR : HOVER_RING_COLOR;
          ctx.strokeStyle = blend(ringColor.night, ringColor.day, mix);
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Bubble/particle effect - same visual family as OceanButton's
        // bubble animation, done procedurally (no particle state to manage)
        // since these markers are canvas-drawn, not DOM elements. Now tied
        // to "isMine" (this is the song the viewer is currently listening
        // to) rather than hover, so it acts as a continuous now-playing
        // indicator instead of a one-off hover flourish. Hover keeps its
        // own separate ring highlight above, just without the particles.
        if (!sinking && rt.isMine) {
          const [tr, tg, tb] = blend(BUBBLE_COLOR.night, BUBBLE_COLOR.day, mix)
            .slice(5, -1)
            .split(',')
            .map(Number);
          for (let i = 0; i < 5; i++) {
            const seed = hashString(rt.id + '-bubble-' + i);
            const cycle = (t * (0.6 + (seed % 5) * 0.15) + seed * 0.13) % 1;
            const bx = x + Math.sin(seed + t * 1.5) * (half * 0.6);
            const by = top - cycle * (size * 1.6);
            const bsize = 1 + (seed % 3) * 0.8;
            const alpha = (1 - cycle) * 0.55;
            ctx.beginPath();
            ctx.arc(bx, by, bsize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${tr},${tg},${tb},${alpha.toFixed(3)})`;
            ctx.fill();
          }
        }

        // Listener-count badge, bottom-right corner - a stronger,
        // always-visible signal that multiple people are on this song
        // than the panel's text count alone (which you only see after
        // clicking). Only shown once there's actually more than one.
        if (rt.listenerCount > 1) {
          const badgeR = 11 * scale;
          const bx = left + size - badgeR * 0.6;
          const by = top + size - badgeR * 0.6;
          ctx.beginPath();
          ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#1ED760';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = blend(BADGE_RING_COLOR.night, BADGE_RING_COLOR.day, mix);
          ctx.stroke();
          ctx.fillStyle = blend(BADGE_RING_COLOR.night, BADGE_RING_COLOR.day, mix);
          ctx.font = `bold ${Math.round(11 * scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(rt.listenerCount), bx, by + 0.5);
        }

        ctx.restore();

        // Square hit test - sinking bubbles are non-interactive, matching
        // the backend's "pointer-events: none" on .floater.sinking. Also
        // recorded into hitBoxesRef regardless of the mouse's last known
        // position, so a click can be tested directly against its own
        // coordinates (see onClick below) instead of only against whatever
        // hoveredRef happened to be set to by the last pointermove.
        if (!sinking) {
          hitBoxesRef.current.set(rt.id, { left, top, size });
          const px = pointerRef.current.x;
          const py = pointerRef.current.y;
          if (px >= left && px <= left + size && py >= top && py <= top + size) {
            hovered = rt.id;
          }
        }
      });

      if (hovered !== hoveredRef.current) {
        hoveredRef.current = hovered;
        setHoveredId(hovered);
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointerRef.current.x = e.clientX - rect.left;
      pointerRef.current.y = e.clientY - rect.top;
    }
    // Hit-tests the click's OWN coordinates against the latest hit boxes,
    // rather than trusting hoveredRef - hoveredRef is only ever updated by
    // pointermove, which touch devices never fire before a tap (there's no
    // concept of "hovering" without a mouse), so on touch this used to
    // always find hoveredRef still null and silently do nothing. This is
    // click-through-to-tap correct on every input type: mouse, pen, or
    // touch all report accurate clientX/clientY on their synthetic click
    // event either way.
    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      for (const [id, box] of hitBoxesRef.current) {
        if (x >= box.left && x <= box.left + box.size && y >= box.top && y <= box.top + box.size) {
          onSelectRef.current(id);
          return;
        }
      }
    }
    function onPointerLeave() {
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    }

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { canvasRef, containerRef, hoveredId };
}
