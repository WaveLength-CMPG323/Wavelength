import { useEffect, useRef, useState } from 'react';
import type { Song } from '../../data/types';

export interface OceanMarker {
  id: string;
  song: Song;
  isMine: boolean;
}

interface Options {
  markers: OceanMarker[];
  onSelect: (songId: string) => void;
  imageResolver: (song: Song) => string | null;
}

const MARKER_SIZE = 62;
const MARKER_RADIUS = MARKER_SIZE / 2;
const CORNER = 12;
const WAVE_COUNT = 4;

const WAVE_BANDS = [
  {
    baseline: 0.43,
    amplitude: 10,
    wavelength: 250,
    speed: 0.25,
    color: 'rgba(91, 73, 210, 0.18)',
  },
  {
    baseline: 0.54,
    amplitude: 15,
    wavelength: 280,
    speed: 0.38,
    color: 'rgba(65, 105, 210, 0.22)',
  },
  {
    baseline: 0.67,
    amplitude: 21,
    wavelength: 310,
    speed: 0.52,
    color: 'rgba(39, 145, 210, 0.28)',
  },
  {
    baseline: 0.80,
    amplitude: 29,
    wavelength: 350,
    speed: 0.68,
    color: 'rgba(23, 182, 196, 0.32)',
  },
];

interface MarkerRuntime {
  id: string;
  lane: number;
  x: number;
  speed: number;
  phase: number;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function useOceanCanvas({
  markers,
  onSelect,
  imageResolver,
}: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const runtimeRef = useRef<Map<string, MarkerRuntime>>(new Map());
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const markersRef = useRef(markers);
  markersRef.current = markers;

  const pointerRef = useRef({
    x: -9999,
    y: -9999,
  });

  const hoveredRef = useRef<string | null>(null);

  function syncRuntime(width: number) {
    const seen = new Set<string>();

    markersRef.current.forEach((marker, index) => {
      seen.add(marker.id);

      if (!runtimeRef.current.has(marker.id)) {
        runtimeRef.current.set(marker.id, {
          id: marker.id,
          lane: index % WAVE_COUNT,
          x:
            ((index + 0.5) /
              Math.max(1, markersRef.current.length)) *
            width,
          speed: 18 + ((index * 11) % 18),
          phase: (index * 1.9) % (Math.PI * 2),
        });
      }
    });

    runtimeRef.current.forEach((_, id) => {
      if (!seen.has(id)) {
        runtimeRef.current.delete(id);
      }
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const context = canvas.getContext('2d');

    if (!context) return;

    const ctx = context;

    function resize() {
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;

      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;

      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    function getImage(url: string): HTMLImageElement {
      let image = imagesRef.current.get(url);

      if (!image) {
        image = new Image();
        image.src = url;
        imagesRef.current.set(url, image);
      }

      return image;
    }

    function waveY(
      bandIndex: number,
      x: number,
      time: number,
      height: number
    ) {
      const band = WAVE_BANDS[bandIndex];

      return (
        height * band.baseline +
        Math.sin(x / band.wavelength + time * band.speed) *
          band.amplitude +
        Math.sin(
          x / (band.wavelength * 0.42) +
            time * band.speed * 1.55
        ) *
          (band.amplitude * 0.22)
      );
    }

    let animationFrame = 0;
    let lastTime = performance.now();

    function draw(time: number) {
      if (!canvas || !container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      const deltaTime = Math.min(
        0.05,
        (time - lastTime) / 1000
      );

      lastTime = time;

      const seconds = time / 1000;

      syncRuntime(width);

      ctx.clearRect(0, 0, width, height);

      /*
       * DEEP OCEAN BACKGROUND
       */
      const background = ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

      background.addColorStop(0, '#30258f');
      background.addColorStop(0.28, '#343fae');
      background.addColorStop(0.58, '#245f9f');
      background.addColorStop(0.80, '#147f9e');
      background.addColorStop(1, '#07536f');

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      /*
       * LIGHT ENTERING FROM THE SURFACE
       */
      const surfaceGlow = ctx.createRadialGradient(
        width * 0.5,
        -height * 0.05,
        10,
        width * 0.5,
        0,
        Math.max(width * 0.7, height * 0.7)
      );

      surfaceGlow.addColorStop(
        0,
        'rgba(165, 243, 252, 0.16)'
      );

      surfaceGlow.addColorStop(
        0.35,
        'rgba(56, 189, 248, 0.08)'
      );

      surfaceGlow.addColorStop(
        1,
        'rgba(14, 116, 144, 0)'
      );

      ctx.fillStyle = surfaceGlow;
      ctx.fillRect(0, 0, width, height);

      /*
       * SUBTLE LIGHT RAYS
       */
      ctx.save();

      const rayGradient = ctx.createLinearGradient(
        0,
        0,
        0,
        height * 0.7
      );

      rayGradient.addColorStop(
        0,
        'rgba(125, 211, 252, 0.055)'
      );

      rayGradient.addColorStop(
        1,
        'rgba(125, 211, 252, 0)'
      );

      ctx.fillStyle = rayGradient;

      ctx.beginPath();
      ctx.moveTo(width * 0.32, 0);
      ctx.lineTo(width * 0.43, 0);
      ctx.lineTo(width * 0.59, height * 0.72);
      ctx.lineTo(width * 0.48, height * 0.72);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width * 0.57, 0);
      ctx.lineTo(width * 0.64, 0);
      ctx.lineTo(width * 0.75, height * 0.58);
      ctx.lineTo(width * 0.68, height * 0.58);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      /*
       * BACKGROUND BUBBLES
       */
      for (let i = 0; i < 24; i++) {
        const bubbleX =
          (i * 137 + 70) % Math.max(width, 1);

        const bubbleY =
          height -
          ((seconds * (9 + (i % 5) * 2) + i * 79) %
            Math.max(height, 1));

        const bubbleSize = 1.3 + (i % 4) * 0.7;

        ctx.beginPath();
        ctx.arc(
          bubbleX,
          bubbleY,
          bubbleSize,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          'rgba(165, 243, 252, 0.16)';

        ctx.fill();
      }

      /*
       * ANIMATED WAVE LAYERS
       */
      WAVE_BANDS.forEach((band, bandIndex) => {
        ctx.beginPath();

        ctx.moveTo(
          0,
          waveY(
            bandIndex,
            0,
            seconds,
            height
          )
        );

        for (let x = 0; x <= width; x += 8) {
          ctx.lineTo(
            x,
            waveY(
              bandIndex,
              x,
              seconds,
              height
            )
          );
        }

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        ctx.fillStyle = band.color;
        ctx.fill();
      });

      /*
       * FLOATING SONG MARKERS
       */
      let hovered: string | null = null;

      runtimeRef.current.forEach((runtime) => {
        const marker = markersRef.current.find(
          (item) => item.id === runtime.id
        );

        if (!marker) return;

        runtime.x += runtime.speed * deltaTime;

        if (runtime.x > width + MARKER_RADIUS) {
          runtime.x = -MARKER_RADIUS;
        }

        const surfaceY = waveY(
          runtime.lane,
          runtime.x,
          seconds,
          height
        );

        const bob =
          Math.sin(seconds * 1.35 + runtime.phase) * 6;

        const drift =
          Math.cos(seconds * 0.5 + runtime.phase) * 3;

        const x = runtime.x + drift;

        const y =
          surfaceY -
          MARKER_SIZE * 0.38 +
          bob;

        const half = MARKER_SIZE / 2;

        const left = x - half;
        const top = y - half;

        /*
         * OUTER GLOW
         */
        ctx.save();

        ctx.shadowColor = marker.isMine
          ? 'rgba(30, 215, 96, 0.75)'
          : hoveredRef.current === marker.id
            ? 'rgba(34, 211, 238, 0.85)'
            : 'rgba(34, 211, 238, 0.30)';

        ctx.shadowBlur =
          marker.isMine ||
          hoveredRef.current === marker.id
            ? 22
            : 10;

        roundedRect(
          ctx,
          left - 2,
          top - 2,
          MARKER_SIZE + 4,
          MARKER_SIZE + 4,
          CORNER + 2
        );

        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fill();

        ctx.restore();

        /*
         * ALBUM ART
         */
        ctx.save();

        roundedRect(
          ctx,
          left,
          top,
          MARKER_SIZE,
          MARKER_SIZE,
          CORNER
        );

        ctx.clip();

        const imageUrl = imageResolver(marker.song);

        if (imageUrl) {
          const image = getImage(imageUrl);

          if (
            image.complete &&
            image.naturalWidth > 0
          ) {
            ctx.drawImage(
              image,
              left,
              top,
              MARKER_SIZE,
              MARKER_SIZE
            );
          } else {
            ctx.fillStyle = '#155e75';
            ctx.fillRect(
              left,
              top,
              MARKER_SIZE,
              MARKER_SIZE
            );
          }
        } else {
          const fallback =
            ctx.createLinearGradient(
              left,
              top,
              left + MARKER_SIZE,
              top + MARKER_SIZE
            );

          fallback.addColorStop(0, '#0891b2');
          fallback.addColorStop(1, '#1e3a8a');

          ctx.fillStyle = fallback;

          ctx.fillRect(
            left,
            top,
            MARKER_SIZE,
            MARKER_SIZE
          );
        }

        ctx.restore();

        /*
         * ALBUM BORDER
         */
        roundedRect(
          ctx,
          left - 1,
          top - 1,
          MARKER_SIZE + 2,
          MARKER_SIZE + 2,
          CORNER + 1
        );

        ctx.strokeStyle = marker.isMine
          ? '#1ED760'
          : hoveredRef.current === marker.id
            ? 'rgba(103, 232, 249, 0.95)'
            : 'rgba(165, 243, 252, 0.48)';

        ctx.lineWidth =
          marker.isMine ||
          hoveredRef.current === marker.id
            ? 3
            : 1;

        ctx.stroke();

        /*
         * HIT DETECTION
         */
        const pointerX = pointerRef.current.x;
        const pointerY = pointerRef.current.y;

        if (
          pointerX >= left &&
          pointerX <= left + MARKER_SIZE &&
          pointerY >= top &&
          pointerY <= top + MARKER_SIZE
        ) {
          hovered = marker.id;
        }
      });

      /*
       * DARK FOREGROUND WATER
       *
       * This creates the impression that the user is
       * looking into a deeper ocean rather than at a
       * flat collection of wave shapes.
       */
      const foregroundBaseline = height * 0.91;

      ctx.beginPath();

      ctx.moveTo(
        0,
        foregroundBaseline +
          Math.sin(seconds * 0.4) * 8
      );

      for (let x = 0; x <= width; x += 10) {
        const y =
          foregroundBaseline +
          Math.sin(
            x / 390 + seconds * 0.42
          ) *
            24 +
          Math.sin(
            x / 160 + seconds * 0.7
          ) *
            6;

        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      ctx.fillStyle = 'rgba(5, 38, 67, 0.78)';      
      ctx.fill();

      if (hovered !== hoveredRef.current) {
        hoveredRef.current = hovered;
        setHoveredId(hovered);
      }

      animationFrame = requestAnimationFrame(draw);
    }

    animationFrame = requestAnimationFrame(draw);

    function onPointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();

      pointerRef.current.x =
        event.clientX - rect.left;

      pointerRef.current.y =
        event.clientY - rect.top;
    }

    function onClick() {
      if (hoveredRef.current) {
        onSelect(hoveredRef.current);
      }
    }

    function onPointerLeave() {
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    }

    canvas.addEventListener(
      'pointermove',
      onPointerMove
    );

    canvas.addEventListener(
      'pointerleave',
      onPointerLeave
    );

    canvas.addEventListener(
      'click',
      onClick
    );

    return () => {
      cancelAnimationFrame(animationFrame);

      resizeObserver.disconnect();

      canvas.removeEventListener(
        'pointermove',
        onPointerMove
      );

      canvas.removeEventListener(
        'pointerleave',
        onPointerLeave
      );

      canvas.removeEventListener(
        'click',
        onClick
      );
    };

    // Canvas lifecycle intentionally initialises once.
    // Current markers are read through markersRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    canvasRef,
    containerRef,
    hoveredId,
  };
}