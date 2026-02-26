import { redirect } from 'next/navigation';

export default async function AnalysisIndexRedirect({ params }: { params: Promise<{ businessId: string }> }) {
    const { businessId } = await params;
    redirect(`/analysis/${businessId}/especialistas`);
}
