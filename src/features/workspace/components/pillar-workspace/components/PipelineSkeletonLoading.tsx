'use client';

import React from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

export function PipelineSkeletonLoading() {
    const { isDark } = useSidebar();

    return (
        <div className={`absolute inset-0 z-[100] backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-700 ${
            isDark ? 'bg-zinc-950/40' : 'bg-white/40'
        }`}>
            {/* Header Skeleton (Score Gauge area) */}
            <div className={`w-full border-b px-8 py-12 flex items-center justify-between transition-colors duration-300 ${
                isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50/80 border-gray-100'
            }`}>
                <div className="flex flex-col gap-4">
                    <div className={`h-8 w-64 rounded-xl animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                    <div className="flex gap-2">
                        <div className={`h-4 w-40 rounded animate-pulse opacity-50 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`h-12 w-48 rounded-2xl animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                    <div className={`h-12 w-12 rounded-full animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                </div>
            </div>

            {/* Pipeline Board Skeleton */}
            <div className="flex-1 relative">
                {/* Dots background emulation */}
                <div 
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `radial-gradient(${isDark ? '#fff' : '#000'} 1px, transparent 0)`,
                        backgroundSize: '32px 32px'
                    }}
                />

                {/* Floating Cards Flow */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-24 px-32 max-w-full overflow-hidden">
                    
                    {/* Card 1 */}
                    <div className="animate-drift-1 flex flex-col items-center">
                        <div className={`w-64 h-20 rounded-2xl border animate-pulse ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`} />
                    </div>

                    {/* Path 1 -> 2 */}
                    <div className="w-24 h-48 flex items-center justify-center opacity-20">
                        <svg className="w-full h-full overflow-visible">
                            <path d="M 0 96 C 40 96, 40 32, 80 32" stroke={isDark ? "white":"black"} strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                            <path d="M 0 96 C 40 96, 40 160, 80 160" stroke={isDark ? "white":"black"} strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                        </svg>
                    </div>

                    {/* Cards 2 & 3 */}
                    <div className="flex flex-col gap-12">
                        <div className="animate-drift-2">
                            <div className={`w-64 h-20 rounded-2xl border animate-pulse ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`} />
                        </div>
                        <div className="animate-drift-3">
                            <div className={`w-64 h-20 rounded-2xl border animate-pulse ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`} />
                        </div>
                    </div>

                    {/* Path 2,3 -> 4 */}
                    <div className="w-24 h-48 flex items-center justify-center opacity-20">
                        <svg className="w-full h-full overflow-visible">
                            <path d="M 0 32 C 40 32, 40 96, 80 96" stroke={isDark ? "white":"black"} strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                            <path d="M 0 160 C 40 160, 40 96, 80 96" stroke={isDark ? "white":"black"} strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                        </svg>
                    </div>

                    {/* Card 4 */}
                    <div className="animate-drift-4">
                        <div className={`w-64 h-20 rounded-2xl border animate-pulse ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`} />
                    </div>

                    {/* Path 4 -> 5,6 */}
                    <div className="w-24 h-48 flex items-center justify-center opacity-20">
                        <svg className="w-full h-full overflow-visible">
                            <path d="M 0 96 C 40 96, 40 32, 80 32" stroke={isDark ? "white":"black"} strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                            <path d="M 0 96 C 40 96, 40 160, 80 160" stroke={isDark ? "white":"black"} strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                        </svg>
                    </div>

                    {/* Cards 5 & 6 */}
                    <div className="flex flex-col gap-12">
                        <div className="animate-drift-1">
                            <div className={`w-64 h-20 rounded-2xl border animate-pulse ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`} />
                        </div>
                        <div className="animate-drift-2">
                            <div className={`w-64 h-20 rounded-2xl border animate-pulse ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Panel (Bottom Left) */}
            <div className="absolute bottom-12 left-12 space-y-4">
                <div className={`p-6 rounded-3xl border shadow-2xl backdrop-blur-3xl w-80 animate-in slide-in-from-bottom-5 duration-700 ${
                    isDark ? 'bg-zinc-900/90 border-white/10' : 'bg-white/90 border-gray-200'
                }`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Status da Operação</span>
                    </div>
                    <div className="space-y-3">
                        <div className={`h-4 w-full rounded animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                        <div className={`h-3 w-2/3 rounded animate-pulse opacity-50 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes drift-1 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(-8px) translateX(4px);} }
                @keyframes drift-2 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(10px) translateX(-5px);} }
                @keyframes drift-3 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(-12px) translateX(6px);} }
                @keyframes drift-4 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(15px) translateX(3px);} }
                
                .animate-drift-1 { animation: drift-1 8s ease-in-out infinite; }
                .animate-drift-2 { animation: drift-2 9s ease-in-out infinite; }
                .animate-drift-3 { animation: drift-3 10s ease-in-out infinite; }
                .animate-drift-4 { animation: drift-4 11s ease-in-out infinite; }
            `}</style>
        </div>
    );
}
