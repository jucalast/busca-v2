import React, { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { runOrchestrator } from '@/lib/api/client';
import AnalysisClientWrapper from './ClientWrapper';
import AnalysisSkeleton from '@/features/shared/components/AnalysisSkeleton';

// Adicionamos Next.js Cache Revalidation Behavior
export const dynamic = 'force-dynamic';

async function PersistentAnalysisLoader({ 
    businessId, 
    session 
}: { 
    businessId: string; 
    session: any 
}) {
    let businessData = null;

    try {
        // SSR Data Fetch: Pedindo o plano de ação no nível do Layout
        // Assim, ele é carregado uma única vez para toda a navegação do dashboard
        const result = await runOrchestrator('get-business-action-plan', {
            aiModel: 'auto',
            business_id: businessId,
        }, 20000);

        if (result && result.success && result.business) {
            businessData = result.business;
        }
    } catch (e: any) {
        console.error("Failed fetching business on server Layout:", e);
    }

    if (!businessData) {
        notFound();
    }

    const latest = businessData.latest_analysis || {};
    const growthData = {
        score: latest.score_data || latest.score || {},
        specialists: latest.specialists || {},
        marketData: latest.market_data || latest.marketData || {},
        analysis_id: latest.id || latest.analysis_id,
        business_id: businessId
    };

    const userProf = {
        name: businessData.name || businessData.profile_data?.perfil?.nome_negocio || businessData.profile_data?.perfil?.nome || 'Seu Negócio',
        segment: businessData.profile_data?.perfil?.segmento || '',
    };

    return (
        <AnalysisClientWrapper
            initialGrowthData={growthData}
            initialProfile={{ profile: businessData.profile_data }}
            userProf={userProf}
            userId={session.user.email!}
            currentBusinessId={businessId}
        />
    );
}

export default async function AnalysisLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ businessId: string }>;
}) {
    const session = await auth();
    const { businessId } = await params;

    if (!session || !session.user) {
        redirect('/');
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* O Loader Persistente fica no Layout, garantindo que o estado de especialistas
                não seja perdido entre navegações de slug */}
            <Suspense fallback={<AnalysisSkeleton />}>
                <PersistentAnalysisLoader 
                    businessId={businessId} 
                    session={session} 
                />
            </Suspense>
            
            {/* Mantemos o children aqui caso as páginas precisem injetar algo, 
                mas o Dashboard agora vive no PersistentAnalysisLoader */}
            <div className="hidden">
                 {children}
            </div>
        </div>
    );
}
