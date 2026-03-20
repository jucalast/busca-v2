import React from 'react';

export default function AnalysisSkeleton() {
    return (
        <div className="w-full h-full p-8 animate-in fade-in duration-700">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between mb-12">
                <div className="space-y-3">
                    <div className="h-8 w-64 bg-slate-200/60 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                    <div className="h-4 w-40 bg-slate-100/40 dark:bg-zinc-800/30 rounded-md animate-pulse" />
                </div>
                <div className="h-10 w-32 bg-slate-200/60 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
            </div>

            {/* Grid for Score and Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 rounded-3xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-white/5 p-6 space-y-4">
                        <div className="h-4 w-24 bg-slate-200/60 dark:bg-zinc-800/50 rounded animate-pulse" />
                        <div className="h-12 w-full bg-slate-100/40 dark:bg-zinc-800/30 rounded-xl animate-pulse" />
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="space-y-6">
                <div className="h-6 w-48 bg-slate-200/60 dark:bg-zinc-800/50 rounded animate-pulse mb-8" />
                
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-6 p-6 rounded-3xl bg-slate-50/30 dark:bg-zinc-900/20 border border-slate-100 dark:border-white/5 items-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-200/50 dark:bg-zinc-800/50 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-3">
                            <div className="h-5 w-1/3 bg-slate-200/60 dark:bg-zinc-800/50 rounded animate-pulse" />
                            <div className="h-4 w-2/3 bg-slate-100/40 dark:bg-zinc-800/30 rounded animate-pulse" />
                        </div>
                        <div className="w-24 h-8 bg-slate-200/40 dark:bg-zinc-800/40 rounded-full animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    );
}
