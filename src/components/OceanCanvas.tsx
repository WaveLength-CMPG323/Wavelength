import React, { useRef, useEffect, useCallback } from 'react';
import { UserNode } from '../types/ocean.ts';

interface OceanCanvasProps {
  nodes: UserNode[];
  onSelectNode: (node: UserNode) => void;
  selectedNodeId?: string;
}

export const OceanCanvas: React.FC<OceanCanvasProps> = ({
  nodes,
  onSelectNode,
  selectedNodeId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Block 2A: Preload Images to keep rendering smooth at 60 FPS
  useEffect(() => {
    nodes.forEach((node) => {
      const src = node.currentTrack?.albumArt || node.avatarUrl;
      if (src && !imageCache.current.has(src)) {
        const img = new Image();
        img.src = src;
        img.onload = () => imageCache.current.set(src, img);
      }
    });
  }, [nodes]);

  // Block 2B: 60 FPS Wave Engine & Node Renderer Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.02;
      const width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
      const height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

      // 1. Draw Deep Ocean Background Gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#06142e');
      gradient.addColorStop(0.5, '#0b2545');
      gradient.addColorStop(1, '#134074');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Mathematical Wave Generator Function
      const drawWave = (
        yOffset: number,
        amplitude: number,
        frequency: number,
        speed: number,
        color: string
      ) => {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 10) {
          const y = Math.sin(x * frequency + time * speed) * amplitude + yOffset;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };

      // Draw Background & Midground Waves
      drawWave(height * 0.45, 15, 0.005, 0.8, 'rgba(14, 116, 144, 0.3)');
      drawWave(height * 0.55, 22, 0.008, 1.2, 'rgba(6, 182, 212, 0.4)');

      // 3. Render Floating Listener Nodes (Max 50 for Viewport Performance)
      const visibleNodes = nodes.slice(0, 50);

      visibleNodes.forEach((node) => {
        const floatY = Math.sin(time * 1.5 + node.floatOffset) * 12;
        const driftX = Math.cos(time * 0.5 + node.floatOffset) * 20;

        const currentX = (node.x + driftX + width) % width;
        const currentY = node.y + floatY;

        ctx.save();
        ctx.translate(currentX, currentY);

        // Active Glow / Selected Effect
        if (node.activeCosmeticEffect === 'glow' || node.userId === selectedNodeId) {
          ctx.beginPath();
          ctx.arc(0, 0, 32, 0, Math.PI * 2);
          ctx.fillStyle = node.userId === selectedNodeId ? 'rgba(29, 185, 84, 0.6)' : 'rgba(56, 189, 248, 0.5)';
          ctx.shadowColor = node.userId === selectedNodeId ? '#1DB954' : '#38bdf8';
          ctx.shadowBlur = 15;
          ctx.fill();
        }

        // Draw Rounded Spotify-style Album Art / Avatar
        const imgSrc = node.currentTrack?.albumArt || node.avatarUrl;
        const img = imageCache.current.get(imgSrc);
        const size = 48;

        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, 8);
        ctx.clip();

        if (img) {
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-size / 2, -size / 2, size, size);
        }

        ctx.restore();

        // Paused Overlay Effect
        if (!node.isPlaying) {
          ctx.save();
          ctx.translate(currentX, currentY);
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fill();
          ctx.restore();
        }
      });

      // Draw Foreground Wave Layer (Overlays background elements for pseudo-3D depth)
      drawWave(height * 0.7, 30, 0.004, 1.5, 'rgba(15, 23, 42, 0.7)');

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, selectedNodeId]);

  // Block 2C: Click Detection Handler for Interactive Nodes
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const found = nodes.find((node) => {
        const dist = Math.hypot(node.x - clickX, node.y - clickY);
        return dist < 30;
      });

      if (found) {
        onSelectNode(found);
      }
    },
    [nodes, onSelectNode]
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      className="w-full h-full cursor-pointer block"
    />
  );
};
