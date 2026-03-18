import React, { use } from 'react';

export default function AnalysisLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ businessId: string }>;
}) {
    const { businessId } = use(params);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {children}
        </div>
    );
}
