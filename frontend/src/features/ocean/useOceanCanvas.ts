import { useEffect, useRef, useState } from 'react';
import type { Song } from '../../data/types';

export interface OceanMarker {
  id: string; // song id
  song: Song;
  isMine: boolean;
  listenerCount: number;
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
// Each wave band: how far down the canvas its resting line sits (0 = top, 1 = bottom),
// its own amplitude/wavelength/speed and a colour, back-to-front (drawn in this order).
const WAVE_BANDS = [
  { baseline: 0.58, amplitude: 16, wavelength: 220, speed: 0.35, color: 'rgba(34,211,238,0.12)' },
  { baseline: 0.72, amplitude: 20, wavelength: 260, speed: 0.5, color: 'rgba(34,211,238,0.22)' },
  { baseline: 0.86, amplitude: 24, wavelength: 300, speed: 0.7, color: 'rgba(34,211,238,0.38)' },
];

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

  const runtimeRef = useRef<Map<string, MarkerRuntime>>(new Map());
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const hoveredRef = useRef<string | null>(null);

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
  function syncRuntime(width: number, time: number) {
    const seen = new Set<string>();
    markersRef.current.forEach((m, i) => {
      seen.add(m.id);
      const existing = runtimeRef.current.get(m.id);
      if (!existing) {
        const h = hashString(m.id);
        runtimeRef.current.set(m.id, {
          id: m.id,
          lane: h % WAVE_COUNT, // per-song, not per-list-position - see hashString
          x: (i / Math.max(1, markersRef.current.length)) * width,
          speed: 26 + (h % 20), // slightly different speeds so they don't all move in lockstep
          phase: (h % 100) / 100 * Math.PI * 2,
          song: m.song,
          isMine: m.isMine,
          listenerCount: m.listenerCount,
          sinkStartTime: null,
        });
      } else {
        // Still around - keep its song/isMine snapshot fresh, and cancel
        // sinking if it somehow reappeared mid-animation.
        existing.song = m.song;
        existing.isMine = m.isMine;
        existing.listenerCount = m.listenerCount;
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

      syncRuntime(w, time);

      ctx.clearRect(0, 0, w, h);

      // Sky-to-sea background gradient.
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#02182b');
      grad.addColorStop(0.55, '#04385a');
      grad.addColorStop(1, '#0a4a6e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

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
        ctx.fillStyle = band.color;
        ctx.fill();
      });

      // Markers: drift left -> right along their assigned wave, wrapping around.
      // A marker whose song just ended keeps drawing from its frozen runtime
      // snapshot while it sinks (see syncRuntime) instead of vanishing.
      let hovered: string | null = null;
      runtimeRef.current.forEach((rt) => {
        const sinking = rt.sinkStartTime !== null;
        const sinkP = sinking ? Math.min(1, (time - rt.sinkStartTime!) / SINK_DURATION_MS) : 0;

        // Sinking bubbles stop drifting and bobbing - they just settle in
        // place and go under, mirroring the backend's
        // "animation-play-state: paused" on .floater.sinking.
        if (!sinking) {
          rt.x += rt.speed * dt;
          if (rt.x > w + MARKER_RADIUS) rt.x = -MARKER_RADIUS;
        }

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

        if (!sinking && (rt.isMine || hoveredRef.current === rt.id)) {
          roundedRect(ctx, left - 2, top - 2, size + 4, size + 4, CORNER + 2);
          ctx.strokeStyle = rt.isMine ? '#1ED760' : '#22d3ee';
          ctx.lineWidth = 3;
          ctx.stroke();
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
          ctx.strokeStyle = '#02182b';
          ctx.stroke();
          ctx.fillStyle = '#02182b';
          ctx.font = `bold ${Math.round(11 * scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(rt.listenerCount), bx, by + 0.5);
        }

        ctx.restore();

        // Square hit test - sinking bubbles are non-interactive, matching
        // the backend's "pointer-events: none" on .floater.sinking.
        if (!sinking) {
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
    function onClick() {
      if (hoveredRef.current) onSelectRef.current(hoveredRef.current);
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
