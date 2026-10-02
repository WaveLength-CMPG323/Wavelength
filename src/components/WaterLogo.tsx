import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

interface SprayParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

export default function WaterLogo() {
  const [wavePhase, setWavePhase] = useState<'descending' | 'ascending' | 'done'>('descending');
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const brandLetters = "WaveLength".split("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || wavePhase === 'done') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dynamically set canvas to full screen viewport size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationFrameId: number;
    let waveProgress = -0.15; // Starts above the viewport
    let direction: 'down' | 'up' = 'down';
    const particles: SprayParticle[] = [];

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (direction === 'down') {
        waveProgress += 0.015;
        if (waveProgress >= 0.28) { // Deep plunge down past navigation bar
          direction = 'up';
          setWavePhase('ascending');
        }
      } else if (direction === 'up') {
        waveProgress -= 0.018;
        if (waveProgress <= -0.2) {
          setWavePhase('done');
          cancelAnimationFrame(animationFrameId);
          return;
        }
      }

      const currentY = waveProgress * canvas.height;
      const waveWidth = Math.min(canvas.width, 600); // Fluid sweep region

      // 1. DRAW UNCONSTRAINED ORGANIC LIQUID WAVE (PURE CURVES, NO RECTANGLES)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-50, -50);

      // Smooth Bezier Curve sweep across the screen
      ctx.bezierCurveTo(
        waveWidth * 0.25, currentY + Math.sin(Date.now() * 0.003) * 35,
        waveWidth * 0.75, currentY - Math.cos(Date.now() * 0.004) * 35,
        waveWidth + 100, -50
      );
      ctx.closePath();

      // Fluid Radial Gradient for Natural Edge Feathering (No Sharp Cutoffs)
      const waveGlow = ctx.createRadialGradient(
        waveWidth * 0.35, currentY * 0.5, 10,
        waveWidth * 0.35, currentY * 0.5, waveWidth * 0.7
      );
      waveGlow.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      waveGlow.addColorStop(0.5, 'rgba(14, 165, 233, 0.5)');
      waveGlow.addColorStop(0.85, 'rgba(2, 132, 199, 0.15)');
      waveGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = waveGlow;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.restore();

      // 2. UNCLIPPED SPLASH & FOAM PARTICLES
      if (Math.random() > 0.2) {
        particles.push({
          x: Math.random() * waveWidth,
          y: currentY + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 3,
          vy: direction === 'down' ? Math.random() * 3 + 1 : -Math.random() * 3 - 1,
          radius: Math.random() * 3 + 1,
          alpha: 0.9,
          color: Math.random() > 0.3 ? '#f0f9ff' : '#67e8f9',
        });
      }

      // UPDATE & RENDER PARTICLES
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = '#a5f3fc';
        ctx.shadowBlur = 10;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted, wavePhase]);

  // FULL-SCREEN PORTAL CANVAS
  const renderWavePortal = () => {
    if (!mounted || wavePhase === 'done') return null;
    return createPortal(
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[9999] h-full w-full overflow-visible"
      />,
      document.body
    );
  };

  return (
    <div className="relative flex items-center gap-3 select-none py-1 px-2">
      {/* REACT PORTAL OVERLAY */}
      {renderWavePortal()}

      {/* FLOATING LOGO ICON */}
      <motion.div 
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 border border-cyan-300/40 shadow-[0_0_15px_rgba(56,189,248,0.4)] z-10"
        animate={{ y: [-2, 3, -2], rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
            stroke="#67e8f9"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* BRAND NAME CONTAINER */}
      <div className="relative flex flex-col justify-center z-10">
        <div className="flex items-center space-x-[1.5px] h-9">
          {brandLetters.map((char, index) => (
            <motion.span
              key={index}
              className="font-black text-2xl md:text-3xl tracking-normal text-transparent bg-clip-text bg-gradient-to-b from-cyan-200 via-sky-300 to-indigo-300 inline-block drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]"
              style={{
                fontFamily: "'Comfortaa', 'Fredoka', 'Quicksand', sans-serif",
              }}
              initial={{ 
                opacity: 0, 
                y: -30, 
                scale: 0.6,
                filter: 'blur(8px)' 
              }}
              animate={{ 
                opacity: 1,
                scale: 1,
                filter: 'blur(0px)',
                y: [-3, 3, -3],
                rotate: [
                  index % 2 === 0 ? -2 : 2, 
                  index % 2 === 0 ? 2 : -2, 
                  index % 2 === 0 ? -2 : 2
                ]
              }}
              transition={{
                opacity: { duration: 0.4, delay: 0.2 + index * 0.08 },
                scale: { duration: 0.5, delay: 0.2 + index * 0.08, type: 'spring', stiffness: 140 },
                filter: { duration: 0.4, delay: 0.2 + index * 0.08 },
                y: {
                  duration: 3 + (index % 3) * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.8 + index * 0.12,
                },
                rotate: {
                  duration: 3.6 + (index % 2) * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.8 + index * 0.1,
                }
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.span 
          className="text-[10.5px] text-cyan-200/70 -mt-1 font-medium tracking-wider drop-shadow-[0_0_6px_rgba(56,189,248,0.3)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [-1, 2, -1] }}
          transition={{
            opacity: { delay: 1.2, duration: 0.6 },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }
          }}
        >
          Discover your sound
        </motion.span>
      </div>
    </div>
  );
}