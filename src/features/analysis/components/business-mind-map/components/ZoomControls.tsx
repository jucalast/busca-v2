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
            <button onClick={onZoomIn} className="w-8 h-8 rounded-lg bg-white/80 backdrop-blur-md border border-gray-300 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm">
                <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={onZoomOut} className="w-8 h-8 rounded-lg bg-white/80 backdrop-blur-md border border-gray-300 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm">
                <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={onReset} className="w-8 h-8 rounded-lg bg-white/80 backdrop-blur-md border border-gray-300 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm">
                <Maximize2 className="w-4 h-4 text-gray-600" />
            </button>
        </div>
    );
}
