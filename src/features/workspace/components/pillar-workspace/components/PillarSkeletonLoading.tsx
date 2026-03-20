'use client';

import React from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

export function PillarSkeletonLoading() {
    const { isDark } = useSidebar();

    return (
        <div className="h-full flex relative overflow-hidden animate-in fade-in duration-700">
            {/* Left Column Skeleton (Sidebar) */}
            <div className={`w-[320px] shrink-0 h-full flex flex-col border-r transition-colors duration-300 ${
                isDark ? 'bg-zinc-900/20 border-white/5' : 'bg-slate-50 border-gray-100'
            }`}>
                <div className="p-8 space-y-8">
                    {/* Specialist Profile */}
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`w-24 h-24 rounded-full animate-pulse transition-colors duration-300 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                        <div className="space-y-2">
                            <div className={`h-4 w-32 mx-auto rounded animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                            <div className={`h-3 w-48 mx-auto rounded animate-pulse opacity-50 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                        </div>
                    </div>

                    {/* Stats Mini Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2].map((i) => (
                            <div key={i} className={`h-16 rounded-xl border animate-pulse ${isDark ? 'bg-zinc-800/50 border-white/5' : 'bg-white border-gray-100'}`} />
                        ))}
                    </div>

                    {/* Sources/Docs List */}
                    <div className="space-y-4 pt-4">
                        <div className={`h-3 w-20 rounded animate-pulse opacity-30 ${isDark ? 'bg-zinc-800' : 'bg-slate-300'}`} />
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                                <div className={`h-3 flex-1 rounded animate-pulse ${isDark ? 'bg-zinc-800/50' : 'bg-slate-100'}`} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column Skeleton (Main Area) */}
            <div className={`flex-1 min-w-0 flex flex-col pt-0 transition-colors duration-300 ${
                isDark ? 'bg-[--color-bg]' : 'bg-white'
            }`}>
                {/* Progress Bar Header */}
                <div className={`border-b px-8 py-5 flex items-center justify-between transition-colors duration-300 ${
                    isDark ? 'border-white/5' : 'border-gray-100'
                }`}>
                    <div className={`h-2 w-full max-w-md rounded-full animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                    <div className={`h-8 w-24 rounded-lg animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                </div>

                {/* Task List Skeleton */}
                <div className="flex-1 overflow-hidden p-12">
                    <div className="max-w-4xl space-y-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div 
                                key={i} 
                                className={`p-6 rounded-2xl border flex items-start gap-4 transition-all duration-300 ${
                                    isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100'
                                }`}
                                style={{
                                    animation: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite, drift-${i} 6s ease-in-out infinite`,
                                    animationDelay: `${i * 0.2}s`
                                }}
                            >
                                <div className={`w-12 h-12 rounded-xl shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                                <div className="flex-1 space-y-3">
                                    <div className={`h-4 w-1/3 rounded ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                                    <div className={`h-3 w-2/3 rounded opacity-50 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                                </div>
                                <div className={`w-20 h-6 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes drift-1 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(-5px) translateX(2px);} }
                @keyframes drift-2 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(4px) translateX(-3px);} }
                @keyframes drift-3 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(-3px) translateX(4px);} }
                @keyframes drift-4 { 0%,100% {transform: translateY(0) translateX(0);} 50% {transform: translateY(6px) translateX(2px);} }
                
                .animate-drift-1 { animation: drift-1 6s ease-in-out infinite; }
                .animate-drift-2 { animation: drift-2 7s ease-in-out infinite; }
                .animate-drift-3 { animation: drift-3 8s ease-in-out infinite; }
                .animate-drift-4 { animation: drift-4 6.5s ease-in-out infinite; }
            `}</style>
        </div>
    );
}
