import { useState, useCallback, useEffect, RefObject } from 'react';
import { PILLAR_ORDER, PILLAR_POSITIONS } from '../constants';
import { Position } from '../types';

interface UseZoomPanProps {
    containerRef: RefObject<HTMLDivElement | null>;
}

export function useZoomPan({ containerRef }: UseZoomPanProps) {
    const [zoom, setZoom] = useState(0.85);
    const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });

    // Center on mount and resize
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let centered = false;

        const observer = new ResizeObserver((entries) => {
            if (centered) return;

            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 100 && height > 100) {
                    setPan({ x: (width / 2) + 600, y: (height / 2) + 20 });
                    centered = true;
                    observer.disconnect();
                    break;
                }
            }
        });

        observer.observe(el);

        return () => observer.disconnect();
    }, [containerRef]);

    // Pan handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.mindmap-node')) return;
        setDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging) return;
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [dragging, dragStart]);

    const handleMouseUp = useCallback(() => setDragging(false), []);

    // Zoom handlers
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoom(prev => Math.min(2, Math.max(0.3, prev - e.deltaY * 0.001)));
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [containerRef]);

    const zoomIn = useCallback(() => setZoom(prev => Math.min(2, prev + 0.15)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(0.3, prev - 0.15)), []);
    const resetView = useCallback(() => {
        setZoom(0.85);
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPan({ x: (rect.width / 2) + 600, y: (rect.height / 2) + 20 });
        }
    }, [containerRef]);

    const focusNode = useCallback((key: string) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const viewCenterX = rect.width / 2;
            const viewCenterY = rect.height / 2;

            const idx = PILLAR_ORDER.indexOf(key);
            if (idx !== -1) {
                const pos = PILLAR_POSITIONS[idx];
                const targetZoom = 1.1;

                const direction = pos.side === 'left' ? -1 : 1;
                const visualCenterX = pos.x + direction * 100;
                const visualCenterY = pos.y;

                setZoom(targetZoom);
                setPan({
                    x: viewCenterX - visualCenterX * targetZoom,
                    y: viewCenterY - visualCenterY * targetZoom
                });
            }
        }
    }, [containerRef]);

    return {
        zoom, setZoom,
        pan, setPan,
        dragging,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        zoomIn,
        zoomOut,
        resetView,
        focusNode
    };
}
