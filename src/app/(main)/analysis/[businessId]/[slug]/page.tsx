import React, { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { runOrchestrator } from '@/lib/api/client';
import AnalysisClientWrapper from '../ClientWrapper';
import AnalysisSkeleton from '@/features/shared/components/AnalysisSkeleton';

// Adicionamos Next.js Cache Revalidation Behavior
export const dynamic = 'force-dynamic';

async function AnalysisContentLoader({ businessId, slug, session }: { businessId: string; slug: string; session: any }) {
    let businessData = null;

    try {
        // SSR Data Fetch: Pedindo apenas o plano de ação (Score + Tarefas) - Muito mais leve!
        const result = await runOrchestrator('get-business-action-plan', {
            aiModel: 'auto',
            business_id: businessId,
        }, 15000);

        if (result && result.success && result.business) {
            businessData = result.business;
        }
    } catch (e: any) {
        console.error("Failed fetching business on server:", e);
    }

    if (!businessData) {
        return (
            <div className="min-h-[400px] flex items-center justify-center bg-transparent text-zinc-400">
                <p>Negócio não encontrado ou sem acesso.</p>
            </div>
        );
    }

    // Prepare data to pass to Client Components
    // Handle both DB format (id, score_data, market_data) and Cache format (analysis_id, score, marketData)
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
            activeSlug={slug}
        />
    );
}

export default async function AnalysisSlugPage({ params }: { params: Promise<{ businessId: string; slug: string }> }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/');
    }

    const { businessId, slug } = await params;

    return (
        <Suspense fallback={<AnalysisSkeleton />}>
            <AnalysisContentLoader 
                businessId={businessId} 
                slug={slug} 
                session={session} 
            />
        </Suspense>
    );
}
