import { useEffect, useRef, useState } from 'react';
import type { Song } from '../../data/types';

export interface OceanMarker {
  id: string; // song id
  song: Song;
  isMine: boolean;
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
// Each wave band: how far down the canvas its resting line sits (0 = top, 1 = bottom),
// its own amplitude/wavelength/speed and a colour, back-to-front (drawn in this order).
const WAVE_BANDS = [
  { baseline: 0.58, amplitude: 16, wavelength: 220, speed: 0.35, color: 'rgba(34,211,238,0.12)' },
  { baseline: 0.72, amplitude: 20, wavelength: 260, speed: 0.5, color: 'rgba(34,211,238,0.22)' },
  { baseline: 0.86, amplitude: 24, wavelength: 300, speed: 0.7, color: 'rgba(34,211,238,0.38)' },
];

interface MarkerRuntime {
  id: string;
  lane: number; // which of the 3 waves it rides, alternated by index
  x: number; // current x in px
  speed: number; // px/sec, left -> right
  phase: number; // small per-marker vertical offset so same-lane markers don't overlap in rhythm
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

  // Keep a stable lane/speed/x per marker id across re-renders (e.g. when the
  // search filter changes), only creating runtime state for markers that are
  // new, and dropping ones that disappeared.
  function syncRuntime(width: number) {
    const seen = new Set<string>();
    markersRef.current.forEach((m, i) => {
      seen.add(m.id);
      if (!runtimeRef.current.has(m.id)) {
        runtimeRef.current.set(m.id, {
          id: m.id,
          lane: i % WAVE_COUNT, // alternate across the 3 waves in order
          x: (i / Math.max(1, markersRef.current.length)) * width,
          speed: 26 + ((i * 13) % 20), // slightly different speeds so they don't all move in lockstep
          phase: (i * 1.9) % Math.PI,
        });
      }
    });
    runtimeRef.current.forEach((_, id) => {
      if (!seen.has(id)) runtimeRef.current.delete(id);
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

      syncRuntime(w);

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
      let hovered: string | null = null;
      runtimeRef.current.forEach((rt) => {
        const marker = markersRef.current.find((m) => m.id === rt.id);
        if (!marker) return;

        rt.x += rt.speed * dt;
        if (rt.x > w + MARKER_RADIUS) rt.x = -MARKER_RADIUS;

        const surfaceY = waveY(rt.lane, rt.x, t, w, h);
        const bob = Math.sin(t * 1.4 + rt.phase) * 4;
        const x = rt.x;
        const y = surfaceY - MARKER_SIZE * 0.32 + bob;

        const half = MARKER_SIZE / 2;
        const left = x - half;
        const top = y - half;

        // Soft drop shadow so the art reads against the water.
        ctx.save();
        ctx.shadowColor = 'rgba(15,23,42,0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        roundedRect(ctx, left, top, MARKER_SIZE, MARKER_SIZE, CORNER);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.restore();

        // Square album art, clipped to the rounded square.
        ctx.save();
        roundedRect(ctx, left, top, MARKER_SIZE, MARKER_SIZE, CORNER);
        ctx.clip();
        const url = imageResolver(marker.song);
        if (url) {
          const img = getImage(url);
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, left, top, MARKER_SIZE, MARKER_SIZE);
          } else {
            ctx.fillStyle = '#2c7fb8';
            ctx.fillRect(left, top, MARKER_SIZE, MARKER_SIZE);
          }
        } else {
          ctx.fillStyle = '#2c7fb8';
          ctx.fillRect(left, top, MARKER_SIZE, MARKER_SIZE);
        }
        ctx.restore();

        if (marker.isMine || hoveredRef.current === marker.id) {
          roundedRect(ctx, left - 2, top - 2, MARKER_SIZE + 4, MARKER_SIZE + 4, CORNER + 2);
          ctx.strokeStyle = marker.isMine ? '#1ED760' : '#22d3ee';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Square hit test.
        const px = pointerRef.current.x;
        const py = pointerRef.current.y;
        if (px >= left && px <= left + MARKER_SIZE && py >= top && py <= top + MARKER_SIZE) {
          hovered = marker.id;
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
      if (hoveredRef.current) onSelect(hoveredRef.current);
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
