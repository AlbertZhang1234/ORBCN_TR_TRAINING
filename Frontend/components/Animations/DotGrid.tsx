'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  shockRadius?: number;
  shockStrength?: number;
  friction?: number;
  tension?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface Dot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}

function hexToRgb(hex: string) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16)
  };
}

const DotGrid = ({
  dotSize = 2,
  gap = 20,
  baseColor = '#334155', // Slate-700
  activeColor = '#818cf8', // Indigo-400
  proximity = 100,
  shockRadius = 200,
  shockStrength = 10,
  friction = 0.92,
  tension = 0.05,
  className = '',
  style
}: DotGridProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000, lastX: -1000, lastY: -1000, vx: 0, vy: 0 });
  const rafRef = useRef<number>(0);

  const initDots = useCallback(() => {
    if (!wrapperRef.current || !canvasRef.current) return;
    
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const { width, height } = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const cols = Math.floor(width / gap) + 1;
    const rows = Math.floor(height / gap) + 1;
    
    // Center the grid
    const totalW = (cols - 1) * gap;
    const totalH = (rows - 1) * gap;
    const offsetX = (width - totalW) / 2;
    const offsetY = (height - totalH) / 2;

    const newDots: Dot[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        newDots.push({
          x: offsetX + i * gap,
          y: offsetY + j * gap,
          dx: 0,
          dy: 0,
          vx: 0,
          vy: 0
        });
      }
    }
    dotsRef.current = newDots;
  }, [gap]);

  const updateAndDraw = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    // Clear canvas (using logic coords)
    ctx.clearRect(0, 0, width / dpr, height / dpr);

    const mouse = mouseRef.current;
    
    // Parse colors
    const base = hexToRgb(baseColor);
    const active = hexToRgb(activeColor);

    dotsRef.current.forEach(dot => {
      // 1. Calculate forces
      // Spring force (return to origin)
      const springFx = -dot.dx * tension;
      const springFy = -dot.dy * tension;

      // Mouse interaction
      // Calculate distance to mouse
      const distX = (dot.x + dot.dx) - mouse.x;
      const distY = (dot.y + dot.dy) - mouse.y;
      const dist = Math.sqrt(distX * distX + distY * distY);
      
      let mouseFx = 0;
      let mouseFy = 0;

      if (dist < proximity) {
        // Push away
        const force = (1 - dist / proximity) * 2; // Strength factor
        const angle = Math.atan2(distY, distX);
        mouseFx = Math.cos(angle) * force + mouse.vx * 0.1; // Add mouse velocity influence
        mouseFy = Math.sin(angle) * force + mouse.vy * 0.1;
      }

      // 2. Update velocity
      dot.vx += springFx + mouseFx;
      dot.vy += springFy + mouseFy;

      // 3. Apply friction
      dot.vx *= friction;
      dot.vy *= friction;

      // 4. Update position
      dot.dx += dot.vx;
      dot.dy += dot.vy;

      // 5. Draw
      const finalX = dot.x + dot.dx;
      const finalY = dot.y + dot.dy;
      
      // Color interpolation based on displacement/velocity or distance
      let r = base.r, g = base.g, b = base.b;
      
      // Highlight if moving fast or displaced significantly
      const speed = Math.sqrt(dot.vx * dot.vx + dot.vy * dot.vy);
      const displacement = Math.sqrt(dot.dx * dot.dx + dot.dy * dot.dy);
      
      const t = Math.min(1, Math.max(0, (speed + displacement * 0.1) / 5)); // Tune threshold
      
      if (t > 0) {
        r = Math.round(base.r + (active.r - base.r) * t);
        g = Math.round(base.g + (active.g - base.g) * t);
        b = Math.round(base.b + (active.b - base.b) * t);
      }

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(finalX, finalY, dotSize, 0, Math.PI * 2);
      ctx.fill();
    });

    rafRef.current = requestAnimationFrame(updateAndDraw);
  }, [baseColor, activeColor, dotSize, friction, tension, proximity]);

  useEffect(() => {
    initDots();
    
    // Use ResizeObserver for more robust resizing support
    const wrapper = wrapperRef.current;
    let resizeObserver: ResizeObserver | null = null;

    if (wrapper) {
      resizeObserver = new ResizeObserver(() => {
        initDots();
      });
      resizeObserver.observe(wrapper);
    }
    
    // Start loop
    rafRef.current = requestAnimationFrame(updateAndDraw);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, [initDots, updateAndDraw]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const mouse = mouseRef.current;
      mouse.vx = (x - mouse.lastX) * 0.5; // Simple velocity
      mouse.vy = (y - mouse.lastY) * 0.5;
      mouse.lastX = x;
      mouse.lastY = y;
      mouse.x = x;
      mouse.y = y;
    };

    const handleMouseLeave = () => {
        mouseRef.current.x = -1000;
        mouseRef.current.y = -1000;
    }

    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Apply shockwave
      dotsRef.current.forEach(dot => {
        const dx = dot.x - clickX;
        const dy = dot.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < shockRadius) {
          const force = (1 - dist / shockRadius) * shockStrength;
          const angle = Math.atan2(dy, dx);
          dot.vx += Math.cos(angle) * force * 10;
          dot.vy += Math.sin(angle) * force * 10;
        }
      });
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
        wrapper.addEventListener('mousemove', handleMouseMove);
        wrapper.addEventListener('mouseleave', handleMouseLeave);
        wrapper.addEventListener('click', handleClick);
    }

    return () => {
        if (wrapper) {
            wrapper.removeEventListener('mousemove', handleMouseMove);
            wrapper.removeEventListener('mouseleave', handleMouseLeave);
            wrapper.removeEventListener('click', handleClick);
        }
    };
  }, [shockRadius, shockStrength]);

  return (
    <div 
      ref={wrapperRef} 
      className={`w-full h-full relative overflow-hidden ${className}`} 
      style={style}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />
    </div>
  );
};

export default React.memo(DotGrid);
