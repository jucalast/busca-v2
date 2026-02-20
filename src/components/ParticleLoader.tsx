'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ParticleLoaderProps {
  progress?: string;
  thoughts?: string[];
}

interface Particle {
  type: 'core' | 'glow' | 'scatter' | 'ambient';
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  size: number;
  alpha: number;
  density: number;
  vx: number;
  vy: number;
}

export default function ParticleLoader({ progress, thoughts = [] }: ParticleLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const ambientRef = useRef<Particle[]>([]);
  const mouseRef = useRef<{ x: number | null; y: number | null; radius: number }>({ x: null, y: null, radius: 80 });
  const shadowCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentVisible, setCurrentVisible] = useState(true);
  const prevTopRef = useRef<string>('');

  // Trigger fade-in animation whenever the latest thought changes
  useEffect(() => {
    const top = thoughts[0];
    if (!top || top === prevTopRef.current) return;
    prevTopRef.current = top;
    setCurrentVisible(false);
    const t = setTimeout(() => setCurrentVisible(true), 120);
    return () => clearTimeout(t);
  }, [thoughts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const shadowCanvas = document.createElement('canvas');
    const shadowCtx = shadowCanvas.getContext('2d');
    shadowCanvasRef.current = shadowCanvas;

    function createParticle(x: number, y: number, type: Particle['type'], cw: number, ch: number): Particle {
      const density = (Math.random() * 30) + 1;
      if (type === 'ambient') {
        return {
          type, baseX: x, baseY: y, density,
          x: Math.random() * cw, y: Math.random() * ch,
          size: Math.random() * 0.8,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          alpha: Math.random() * 0.3 + 0.1,
        };
      }
      let size = 0, alpha = 0;
      if (type === 'core') { size = Math.random() * 0.8 + 0.4; alpha = Math.random() * 0.5 + 0.5; }
      else if (type === 'glow') { size = Math.random() * 1.5 + 0.5; alpha = Math.random() * 0.15 + 0.05; }
      else if (type === 'scatter') { size = Math.random() * 0.8 + 0.3; alpha = Math.random() * 0.6 + 0.2; }
      return { type, baseX: x, baseY: y, x, y, size, alpha, density, vx: 0, vy: 0 };
    }

    function drawStar(c: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
      let rot = Math.PI / 2 * 3;
      const step = Math.PI / spikes;
      c.beginPath();
      c.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        c.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        c.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
      }
      c.lineTo(cx, cy - outerR);
      c.closePath();
      c.fillStyle = 'rgba(255, 255, 255, 0.6)';
      c.fill();
    }

    function drawCustomIA(c: CanvasRenderingContext2D, x: number, y: number, fontSize: number) {
      const scale = fontSize / 100;
      c.save();
      c.translate(x, y - 40 * scale);
      const H = 80 * scale;
      const serifH = 10 * scale;
      c.fillStyle = 'white';
      c.fillRect(0, 0, 36 * scale, serifH);
      c.fillRect(10 * scale, 0, 16 * scale, H);
      c.fillRect(0, H - serifH, 50 * scale, serifH);
      c.fillRect(68 * scale, 45 * scale, 25 * scale, 9 * scale);
      c.beginPath(); c.moveTo(65 * scale, 0); c.lineTo(75 * scale, 0); c.lineTo(50 * scale, H); c.lineTo(40 * scale, H); c.fill();
      c.beginPath(); c.moveTo(75 * scale, 0); c.lineTo(90 * scale, 0); c.lineTo(115 * scale, H); c.lineTo(100 * scale, H); c.fill();
      c.restore();
    }

    function init() {
      if (!canvas || !ctx || !shadowCtx) return;
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio > 1 ? 1 : 1);
      canvas.height = canvas.offsetHeight;
      if (canvas.width === 0 || canvas.height === 0) return;

      const particles: Particle[] = [];
      const ambient: Particle[] = [];

      for (let i = 0; i < 200; i++) {
        ambient.push(createParticle(0, 0, 'ambient', canvas.width, canvas.height));
      }

      ctx.fillStyle = 'white';
      let fontSize = Math.min(canvas.width / 8, 120);
      ctx.font = `bold ${fontSize}px 'Montserrat', sans-serif`;
      ctx.textBaseline = 'middle';

      const text1 = 'vende';
      const w1 = ctx.measureText(text1).width;
      const iaScale = fontSize / 100;
      const w2 = 130 * iaScale;
      const plusSize = fontSize * 0.70;
      const space = fontSize * 0.1;
      const totalWidth = w1 + space + plusSize + space + w2;
      const startX = (canvas.width / 2) - (totalWidth / 2);
      const startY = (canvas.height / 2);

      ctx.fillText(text1, startX, startY);

      const plusX = startX + w1 + space + plusSize / 2;
      const plusY = startY;
      const thick = fontSize * 0.14;

      ctx.fillStyle = 'white';
      ctx.fillRect(plusX - plusSize / 2, plusY - thick / 2, plusSize, thick);
      ctx.fillRect(plusX - thick / 2, plusY - plusSize / 2, thick, plusSize);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(plusX - plusSize, plusY + plusSize);
      ctx.lineTo(plusX + plusSize, plusY - plusSize);
      ctx.lineWidth = thick * 0.55;
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      drawCustomIA(ctx, plusX + plusSize / 2 + space, startY, fontSize);

      // Shadow
      shadowCanvas.width = canvas.width;
      shadowCanvas.height = canvas.height;
      shadowCtx.filter = 'blur(30px)';
      shadowCtx.globalAlpha = 0.15;
      shadowCtx.drawImage(canvas, 0, 0);
      shadowCtx.filter = 'blur(90px)';
      shadowCtx.globalAlpha = 0.1;
      shadowCtx.drawImage(canvas, 0, 0);

      const textCoordinates = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const step = canvas.width < 768 ? 3 : 2;
      const iaStartX = plusX + plusSize / 2 + space;
      const iaEndX = iaStartX + (115 * iaScale);

      for (let y = 0; y < textCoordinates.height; y += step) {
        for (let x = 0; x < textCoordinates.width; x += step) {
          if (textCoordinates.data[(y * 4 * textCoordinates.width) + (x * 4) + 3] > 128) {
            let erodeFactor = 0;
            let isLeftEdge = false;
            let isRightEdge = false;

            if (x >= startX - 20 && x <= startX + (w1 * 0.20)) {
              isLeftEdge = true;
              erodeFactor = 1 - ((x - (startX - 10)) / (w1 * 0.20 + 10));
            } else if (x >= iaEndX - (45 * iaScale) && x <= iaEndX + 20) {
              isRightEdge = true;
              erodeFactor = (x - (iaEndX - 45 * iaScale)) / (45 * iaScale + 20);
            }
            erodeFactor = Math.max(0, Math.min(1, erodeFactor));

            let isEroded = false;
            if (erodeFactor > 0 && Math.random() < erodeFactor * 0.85) {
              isEroded = true;
            }

            if (!isEroded) {
              particles.push(createParticle(x, y, 'core', canvas.width, canvas.height));
              if (Math.random() < 0.3) {
                particles.push(createParticle(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 'glow', canvas.width, canvas.height));
              }
            }

            let scatterProb = 0.08;
            if (erodeFactor > 0) scatterProb += erodeFactor * 0.9;

            if (Math.random() < scatterProb) {
              let spreadY = (Math.random() - 0.5) * (20 + erodeFactor * 30);
              let spreadX = 0;
              if (isLeftEdge && erodeFactor > 0) {
                spreadX = -(Math.random() * 120 * erodeFactor) - (Math.random() * 15);
              } else if (isRightEdge && erodeFactor > 0) {
                spreadX = (Math.random() * 120 * erodeFactor) + (Math.random() * 15);
              } else {
                spreadX = (Math.random() - 0.5) * 10;
              }
              particles.push(createParticle(x + spreadX, y + spreadY, 'scatter', canvas.width, canvas.height));
            }
          }
        }
      }

      particlesRef.current = particles;
      ambientRef.current = ambient;
    }

    function animate() {
      if (!canvas || !ctx) return;

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'lighter';
      if (shadowCanvasRef.current) {
        ctx.drawImage(shadowCanvasRef.current, 0, 0);
      }

      const mouse = mouseRef.current;

      for (const p of ambientRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of particlesRef.current) {
        // Update
        if (p.type !== 'ambient') {
          const dx = (mouse.x ?? -9999) - p.x;
          const dy = (mouse.y ?? -9999) - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            p.x -= (dx / distance) * force * p.density;
            p.y -= (dy / distance) * force * p.density;
          } else {
            if (p.x !== p.baseX) p.x -= (p.x - p.baseX) / 10;
            if (p.y !== p.baseY) p.y -= (p.y - p.baseY) / 10;
          }
        }

        // Draw
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        if (p.type === 'ambient' || p.type === 'glow') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      drawStar(ctx, canvas.width - 50, canvas.height - 50, 4, 15, 4);

      animFrameRef.current = requestAnimationFrame(animate);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseOut = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);

    // Load font then init
    if (document.fonts) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      document.fonts.ready.then(() => {
        init();
        animate();
      });
    } else {
      setTimeout(() => { init(); animate(); }, 500);
    }

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        init();
      }, 300);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[80vh] bg-black flex flex-col items-center justify-center overflow-hidden cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Agent thought stream — bottom-left panel */}
      <div className="absolute bottom-8 left-6 z-10 pointer-events-none w-[min(380px,90vw)]">
        {/* Current thought — active line */}
        {thoughts.length > 0 && (
          <div
            style={{
              transition: 'opacity 0.3s ease',
              opacity: currentVisible ? 1 : 0,
            }}
            className="flex items-center gap-2 mb-3"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/80 shrink-0 animate-pulse" />
            <span className="text-white/90 text-sm font-mono tracking-wide">
              {thoughts[0]}
            </span>
          </div>
        )}

        {/* History — fading previous thoughts */}
        <div className="flex flex-col gap-1.5">
          {thoughts.slice(1, 4).map((thought: string, i: number) => (
            <div
              key={`${thought}-${i}`}
              className="flex items-center gap-2"
              style={{ opacity: 0.18 - i * 0.04 }}
            >
              <span className="inline-block w-1 h-1 rounded-full bg-white/40 shrink-0" />
              <span className="text-white/60 text-xs font-mono tracking-wide line-through decoration-white/20">
                {thought}
              </span>
            </div>
          ))}
        </div>

        {/* Divider + status */}
        <div className="mt-4 border-t border-white/10 pt-3 flex items-center justify-between">
          {progress ? (
            <p className="text-white/40 text-xs tracking-wider">{progress}</p>
          ) : (
            <p className="text-white/30 text-xs tracking-wider">Analisando seu negócio...</p>
          )}
          <p className="text-white/20 text-xs tracking-wider">1–3 min</p>
        </div>
      </div>
    </div>
  );
}
