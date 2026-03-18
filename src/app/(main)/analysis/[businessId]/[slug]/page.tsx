import React from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { runOrchestrator } from '@/lib/api/client';
import AnalysisClientWrapper from '../ClientWrapper';

// Adicionamos Next.js Cache Revalidation Behavior
export const dynamic = 'force-dynamic';

export default async function AnalysisSlugPage({ params }: { params: Promise<{ businessId: string; slug: string }> }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/');
    }

    const { businessId, slug } = await params;
    let businessData = null;

    try {
        // SSR Data Fetch: Pedindo o Business ID direto do Python sem API Request.
        const result = await runOrchestrator('get-business', {
            aiModel: 'auto',
            business_id: businessId,
        }, 30000);

        if (result && result.success && result.business) {
            businessData = result.business;
        }
    } catch (e: any) {
        console.error("Failed fetching business on server:", e);
    }

    if (!businessData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-400">
                <p>Negócio não encontrado ou sem acesso.</p>
            </div>
        );
    }

    // Prepare data to pass to Client Components
    const growthData = {
        score: businessData.latest_analysis?.score_data || {},
        specialists: {},
        marketData: businessData.latest_analysis?.market_data || {},
        analysis_id: businessData.latest_analysis?.id,
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
