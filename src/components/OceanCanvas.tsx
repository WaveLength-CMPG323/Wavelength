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

  const nodePositions = useRef<Map<string, { x : number; y: number}>>(
    new Map());

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

      //Soft light coming through the surface of the water
      const lightGlow = ctx.createRadialGradient(
        width / 2,
        0,
        20,
        width / 2,
        0,
        width * 0.65
      );

      lightGlow.addColorStop(0, 'rgba(103, 232, 249, 0.12)');
      lightGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
      lightGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = lightGlow;
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

      // Layer several waves to create depth.
      // Smaller and lighter waves appear further away.
      drawWave(
        height * 0.42,
        10,
        0.004,
        0.5,
        'rgba(34, 211, 238, 0.10)'
      );

      drawWave(
        height * 0.48,
        16,
        0.005,
        0.7,
        'rgba(14, 165, 233, 0.16)'
      );

      drawWave(
        height * 0.55,
        22,
        0.006,
        0.9,
        'rgba(8, 145, 178, 0.22)'
      );

      drawWave(
        height * 0.63,
        28,
        0.007,
        1.1,
        'rgba(14, 116, 144, 0.30)'
      );

      //small bubbles moving slowly upwards through the ocean
      for (let i = 0; i < 16; i++) {
        const bubbleX = (i * 137 + 70) % width;

        const bubbleY =
          height -
          ((time * (10 + (i % 4) * 3) + i * 83) % height);

        const bubbleSize = 1.5 + (i % 3);

        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);

        ctx.fillStyle = 'rgba(165, 243, 252, 0.16)';
        ctx.fill();
      }

      // 3. Render Floating Listener Nodes (Max 50 for Viewport Performance)
      const visibleNodes = nodes.slice(0, 50);

      visibleNodes.forEach((node) => {
        const floatY = Math.sin(time * 1.5 + node.floatOffset) * 12;
        const driftX = Math.cos(time * 0.5 + node.floatOffset) * 20;

        const currentX = (node.x + driftX + width) % width;
        const currentY = node.y + floatY;

        nodePositions.current.set(node.userId, {
          x: currentX,
          y: currentY,
        });

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

        //Give every listener a soft while outline so the album art
        //stands out from the ocean background
        ctx.beginPath();
        ctx.roundRect(
          -size / 2 - 2,
          -size / 2 - 2,
          size + 4,
          size + 4,
          10
        );
        ctx.strokeStyle =
          node.userId === selectedNodeId
            ? 'rgba(103, 232, 249, 0.95)'
            : 'rgba(165, 243, 252, 0.45)';
        ctx.lineWidth = node.userId === selectedNodeId ? 2 : 1;
        ctx.shadowColor = 'rgba(34, 211, 238, 0.45)';
        ctx.shadowBlur = node.userId === selectedNodeId ? 14 : 6;
        ctx.stroke();

        // Reset the shadow before drawing the image.
        ctx.shadowBlur = 0;


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

      // Dark foreground water gives the scene more depth.
      drawWave(
        height * 0.74,
        38,
        0.004,
        1.3,
        'rgba(2, 24, 39, 0.72)'
      );

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
        const position = nodePositions.current.get(node.userId);

        if (!position) return false;

        const dist = Math.hypot(
          position.x - clickX,
          position.y - clickY
        );

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
