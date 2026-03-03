'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';

// ─── Estado de animação dos papéis (posições start → end) ───
const papersState = {
    esquerdo: { startX: -50, startY: -50, startRot: -8, endX: -100, endY: -135, endRot: -6 },
    central:  { startX: 0,   startY: -60, startRot: -2, endX: 0,    endY: -145, endRot: 0 },
    direito:  { startX: 65,  startY: -45, startRot: 12, endX: 100,  endY: -135, endRot: 6 },
};

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function calcState(state: typeof papersState.esquerdo, p: number) {
    return {
        x: state.startX + (state.endX - state.startX) * p,
        y: state.startY + (state.endY - state.startY) * p,
        rot: state.startRot + (state.endRot - state.startRot) * p,
    };
}

// ─── Drawing helpers (exatos do HTML de referência) ───

function limparCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(-w / 2, -h / 2, w, h);
}

function desenharFundoPasta(ctx: CanvasRenderingContext2D) {
    const w = 260, h = 200, r = 20, x = -w / 2, y = -110;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
}

function desenharTraseiraPasta(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(-120, 60);
    ctx.lineTo(-120, -100);
    ctx.quadraticCurveTo(-120, -115, -105, -115);
    ctx.lineTo(-40, -115);
    ctx.quadraticCurveTo(-30, -115, -20, -100);
    ctx.lineTo(-15, -95);
    ctx.quadraticCurveTo(-5, -85, 10, -85);
    ctx.lineTo(105, -85);
    ctx.quadraticCurveTo(120, -85, 120, -70);
    ctx.lineTo(120, 60);
    ctx.closePath();
    ctx.fillStyle = '#38383a';
    ctx.fill();
}

function desenharPapelEsquerdo(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(-45, -60, 90, 130, 8);
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();
    ctx.restore();
}

function desenharPapelCentral(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    const w = 90, h = 130, r = 8, foldSize = 25;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2);
    ctx.lineTo(w / 2 - foldSize, -h / 2);
    ctx.lineTo(w / 2, -h / 2 + foldSize);
    ctx.lineTo(w / 2, h / 2 - r);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    ctx.lineTo(-w / 2 + r, h / 2);
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    ctx.lineTo(-w / 2, -h / 2 + r);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Fold corner
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.moveTo(w / 2 - foldSize, -h / 2);
    ctx.lineTo(w / 2 - foldSize, -h / 2 + foldSize - 5);
    ctx.quadraticCurveTo(w / 2 - foldSize, -h / 2 + foldSize, w / 2 - foldSize + 5, -h / 2 + foldSize);
    ctx.lineTo(w / 2, -h / 2 + foldSize);
    ctx.closePath();
    ctx.fillStyle = '#e0e0e0';
    ctx.fill();
    ctx.restore();
}

function desenharPapelDireito(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;

    ctx.beginPath();
    ctx.roundRect(-45, -60, 90, 130, 8);
    ctx.fillStyle = '#e8e8e8';
    ctx.fill();

    // PDF badge
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.roundRect(-25, -30, 50, 26, 6);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px Inter, system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PDF', 0, -16);
    ctx.restore();
}

function desenharFrentePasta(ctx: CanvasRenderingContext2D) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = -2;

    ctx.beginPath();
    ctx.moveTo(-130, -75);
    ctx.lineTo(-25, -75);
    ctx.bezierCurveTo(5, -75, 15, -15, 45, -15);
    ctx.lineTo(130, -15);
    ctx.lineTo(130, 75);
    ctx.quadraticCurveTo(130, 95, 110, 95);
    ctx.lineTo(-110, 95);
    ctx.quadraticCurveTo(-130, 95, -130, 75);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, -75, 0, 95);
    gradient.addColorStop(0, '#4a4a4d');
    gradient.addColorStop(1, '#3a3a3c');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Top edge highlight
    ctx.beginPath();
    ctx.moveTo(-128, -74);
    ctx.lineTo(-25, -74);
    ctx.bezierCurveTo(5, -74, 15, -14, 45, -14);
    ctx.lineTo(128, -14);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    ctx.shadowColor = 'transparent';
}

function desenharLogotipoDrive(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    ctx.save();
    // White outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, size + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.translate(cx, cy);
    const s = size * 0.5;
    const w = size * 0.35;

    // Green
    ctx.fillStyle = '#34A853';
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s + 1, s * 0.6 + 1);
    ctx.lineTo(s - w, s * 0.6 + 1);
    ctx.lineTo(-w * 0.8, -s + w);
    ctx.fill();

    // Blue
    ctx.fillStyle = '#4285F4';
    ctx.beginPath();
    ctx.moveTo(s, s * 0.6);
    ctx.lineTo(-s * 0.2, s * 0.6);
    ctx.lineTo(0, s * 0.6 - w);
    ctx.lineTo(s - w * 0.8, s * 0.6 - w);
    ctx.fill();

    // Yellow
    ctx.fillStyle = '#FBBC05';
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(-s, s * 0.6);
    ctx.lineTo(-s + w, s * 0.6);
    ctx.lineTo(w * 0.8, -s + w);
    ctx.fill();

    ctx.restore();
}

function desenharLogotipoNotion(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    ctx.save();
    // White outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, size + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Black inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fillStyle = '#111111';
    ctx.fill();

    // "N" in Times New Roman
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${size * 1.3}px "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy + 1);
    ctx.restore();
}

function desenharLogotipos(ctx: CanvasRenderingContext2D) {
    const cy = 60;
    desenharLogotipoDrive(ctx, -85, cy, 14);
    desenharLogotipoNotion(ctx, -45, cy, 14);
}

// ─── Main Component ───

interface FolderCanvasProps {
    width?: number;
    height?: number;
    className?: string;
}

export function FolderCanvas({ width = 460, height = 560, className = '' }: FolderCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | null>(null);
    const progressRef = useRef(0);
    const isExpandedRef = useRef(false);
    const isAnimatingRef = useRef(false);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.translate(width / 2, height / 2);

        limparCanvas(ctx, width, height);
        desenharFundoPasta(ctx);
        desenharTraseiraPasta(ctx);

        const p = easeInOutCubic(progressRef.current);
        const esq = calcState(papersState.esquerdo, p);
        const cen = calcState(papersState.central, p);
        const dir = calcState(papersState.direito, p);

        desenharPapelEsquerdo(ctx, esq.x, esq.y, esq.rot);
        desenharPapelCentral(ctx, cen.x, cen.y, cen.rot);
        desenharPapelDireito(ctx, dir.x, dir.y, dir.rot);
        desenharFrentePasta(ctx);
        desenharLogotipos(ctx);
    }, [width, height]);

    const animate = useCallback(() => {
        if (!isAnimatingRef.current) return;

        const speed = 0.04;
        if (isExpandedRef.current) {
            progressRef.current += speed;
            if (progressRef.current >= 1) {
                progressRef.current = 1;
                isAnimatingRef.current = false;
            }
        } else {
            progressRef.current -= speed;
            if (progressRef.current <= 0) {
                progressRef.current = 0;
                isAnimatingRef.current = false;
            }
        }

        draw();

        if (isAnimatingRef.current) {
            animRef.current = requestAnimationFrame(animate);
        }
    }, [draw]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX / dpr - width / 2;
        const mouseY = (e.clientY - rect.top) * scaleY / dpr - height / 2;

        if (mouseX >= -140 && mouseX <= 140 && mouseY >= -120 && mouseY <= 100) {
            if (!isAnimatingRef.current) {
                isExpandedRef.current = !isExpandedRef.current;
                isAnimatingRef.current = true;
                animate();
            }
        }
    }, [width, height, animate]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX / dpr - width / 2;
        const mouseY = (e.clientY - rect.top) * scaleY / dpr - height / 2;

        canvas.style.cursor =
            mouseX >= -140 && mouseX <= 140 && mouseY >= -120 && mouseY <= 100
                ? 'pointer' : 'default';
    }, [width, height]);

    useEffect(() => { draw(); }, [draw]);
    useEffect(() => {
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, []);

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <canvas
                ref={canvasRef}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                style={{
                    width, height,
                    filter: 'drop-shadow(0px 20px 40px rgba(0, 0, 0, 0.8))',
                }}
            />
        </div>
    );
}
