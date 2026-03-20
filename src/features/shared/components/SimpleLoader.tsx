'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function SimpleLoader() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-2xl bg-white/40 dark:bg-black/40 transition-all duration-500">
            <div className="animate-in zoom-in duration-500">
                <Loader2 
                    className="w-16 h-16 animate-spin text-[#8b5cf6]" 
                    strokeWidth={1.5}
                />
            </div>
        </div>
    );
}
