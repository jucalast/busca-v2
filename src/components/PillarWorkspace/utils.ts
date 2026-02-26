import { signIn } from 'next-auth/react';

export function safeRender(value: any): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(safeRender).join('\n');
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([k, v]) => {
                const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
                return `${label}: ${safeRender(v)}`;
            })
            .join('\n');
    }
    return String(value);
}

export function cleanMarkdown(raw: string): string {
    if (!raw) return '';
    let s = raw;

    // Remove formatting fences the LLM often adds (e.g. ```markdown ... ```)
    s = s.replace(/```(markdown|md)?[\s\n]*/gi, '');
    s = s.replace(/```[\s\n]*/g, '');

    return s.trim();
}

export function getToolInfo(deliverable: any): { icon: string; name: string; color: string } {
    const title = (deliverable?.entregavel_titulo || '').toLowerCase();
    const content = (deliverable?.conteudo || '').toLowerCase();
    const tipo = (deliverable?.entregavel_tipo || '').toLowerCase();

    if (title.includes('documento') || title.includes('doc') || tipo.includes('documento') ||
        content.includes('documento') || content.includes('relatório') || content.includes('texto')) {
        return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };
    }

    if (title.includes('planilha') || title.includes('sheets') || title.includes('tabela') ||
        tipo.includes('planilha') || content.includes('planilha') || content.includes('tabela') ||
        content.includes('dados') || content.includes('métricas')) {
        return { icon: '/sheets.png', name: 'Google Sheets', color: 'text-green-400' };
    }

    if (title.includes('design') || title.includes('visual') || title.includes('banner') ||
        title.includes('logo') || title.includes('identidade') || tipo.includes('design') ||
        content.includes('design') || content.includes('visual') || content.includes('criativo') ||
        content.includes('identidade visual') || content.includes('marca')) {
        return { icon: '/canva.png', name: 'Canva', color: 'text-pink-400' };
    }

    return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };
}

export async function openInGoogleDocs(deliverable: any, pillarLabel: string, session: any, setLoadingDoc: (id: string | null) => void, fallbackId?: string) {
    if (!session || !session.accessToken) {
        await signIn('google');
        return;
    }

    const docId = deliverable.id || fallbackId || 'export';
    setLoadingDoc(docId);

    const title = safeRender(deliverable.entregavel_titulo || 'Entregável');
    const rawContent = safeRender(deliverable.conteudo_completo || deliverable.conteudo);
    const content = cleanMarkdown(rawContent);
    const comoAplicar = cleanMarkdown(safeRender(deliverable.como_aplicar || ''));
    const impacto = cleanMarkdown(safeRender(deliverable.impacto_estimado || ''));
    const sources = deliverable.sources || deliverable.fontes_consultadas || [];

    let plainText = ``;
    if (pillarLabel) plainText += `Pilar: ${pillarLabel}\n\n`;
    plainText += content + '\n\n';
    if (comoAplicar) plainText += `Como Aplicar\n${comoAplicar}\n\n`;
    if (impacto) plainText += `Impacto Estimado: ${impacto}\n\n`;
    if (sources.length > 0) {
        plainText += `Fontes:\n`;
        sources.forEach((src: string) => {
            plainText += `- ${src}\n`;
        });
        plainText += '\n';
    }

    try {
        const response = await fetch('/api/google-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: session.accessToken,
                title: title,
                plainContent: plainText,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar documento');
        }

        const result = await response.json();
        if (result.success && result.url) {
            window.open(result.url, '_blank');
        } else {
            throw new Error('Resposta inválida ao criar documento');
        }
    } catch (err: any) {
        console.error('Error creating Google Doc:', err);
        alert('Erro ao criar documento: ' + err.message);
    } finally {
        setLoadingDoc(null);
    }
}

export async function exportFullAnalysis(session: any, setLoadingFull: (loading: boolean) => void, analysisData: any, businessName: string) {
    if (!session || !session.accessToken) {
        await signIn('google');
        return;
    }

    setLoadingFull(true);

    try {
        const response = await fetch('/api/export-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: session.accessToken,
                analysisData: {
                    profile: analysisData.profile,
                    score: analysisData.score,
                    specialists: analysisData.specialists,
                    marketData: analysisData.marketData,
                    taskPlan: analysisData.taskPlan
                },
                businessName: businessName
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar documento completo');
        }

        const result = await response.json();
        if (result.success && result.url) {
            window.open(result.url, '_blank');
        } else {
            throw new Error('Resposta inválida ao criar documento');
        }
    } catch (err: any) {
        console.error('Error creating full analysis Google Doc:', err);
        alert('Erro ao criar documento completo: ' + err.message);
    } finally {
        setLoadingFull(false);
    }
}
