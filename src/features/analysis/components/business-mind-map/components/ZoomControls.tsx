import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
    return (
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-1.5">
            <button onClick={onZoomIn} className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <ZoomIn className="w-4 h-4 text-zinc-400" />
            </button>
            <button onClick={onZoomOut} className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <ZoomOut className="w-4 h-4 text-zinc-400" />
            </button>
            <button onClick={onReset} className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <Maximize2 className="w-4 h-4 text-zinc-400" />
            </button>
        </div>
    );
}
