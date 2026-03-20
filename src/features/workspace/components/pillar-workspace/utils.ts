import { signIn } from 'next-auth/react';

// ────────────────────────────────────────────────────────────────────────────
// PENDING DOC ACTION — persisted across OAuth redirect
// ────────────────────────────────────────────────────────────────────────────
const PENDING_DOC_KEY = 'pendingDocAction';

export interface PendingDocAction {
    type: 'google_docs' | 'google_sheets' | 'google_forms' | 'csv';
    tid: string;
    idx: number;
    result: any;
    title: string;
    fmt: string;
}

export function savePendingDocAction(action: PendingDocAction) {
    try {
        sessionStorage.setItem(PENDING_DOC_KEY, JSON.stringify(action));
    } catch { /* ignore quota errors */ }
}

export function getPendingDocAction(): PendingDocAction | null {
    try {
        const raw = sessionStorage.getItem(PENDING_DOC_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PendingDocAction;
    } catch {
        return null;
    }
}

export function clearPendingDocAction() {
    try { sessionStorage.removeItem(PENDING_DOC_KEY); } catch { /* ignore */ }
}

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

export function cleanMarkdown(raw: string | any): string {
    if (!raw) return '';
    if (typeof raw !== 'string') return String(raw);
    let s = raw;

    // Remove formatting fences the LLM often adds (e.g. ```markdown ... ```)
    s = s.replace(/```(markdown|md)?[\s\n]*/gi, '');
    s = s.replace(/```[\s\n]*/g, '');

    return s.trim();
}

export function getToolInfo(deliverable: any): { icon: string; name: string; color: string } {
    // 1. Use artifact_type as PRIMARY signal (most reliable, comes from backend tool execution)
    const artifactType = (deliverable?.artifact_type || '').toLowerCase();
    if (artifactType === 'formulario') return { icon: '/forms.svg', name: 'Google Forms', color: 'text-purple-400' };
    if (artifactType === 'planilha' || artifactType === 'calendario') return { icon: '/sheets.png', name: 'Google Sheets', color: 'text-green-400' };
    if (artifactType === 'documento' || artifactType === 'analise') return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };

    // 2. Use entregavel_tipo (set by tools on production results)
    const tipo = safeRender(deliverable?.entregavel_tipo).toLowerCase();
    if (tipo === 'formulario' || tipo === 'pesquisa' || tipo === 'survey') return { icon: '/forms.svg', name: 'Google Forms', color: 'text-purple-400' };
    if (tipo === 'planilha' || tipo === 'calendario' || tipo === 'cronograma') return { icon: '/sheets.png', name: 'Google Sheets', color: 'text-green-400' };
    if (tipo === 'documento' || tipo === 'analise' || tipo === 'relatorio') return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };

    // 3. Keyword-based fallback for pre-execution (plan entregáveis)
    const title = safeRender(deliverable?.entregavel_titulo).toLowerCase();
    const content = safeRender(deliverable?.conteudo).toLowerCase();

    if (title.includes('formulário') || title.includes('pesquisa online') || title.includes('questionário') ||
        title.includes('survey') || title.includes('enquete') || tipo.includes('formulario')) {
        return { icon: '/forms.svg', name: 'Google Forms', color: 'text-purple-400' };
    }

    if (title.includes('planilha') || title.includes('sheets') || title.includes('tabela') ||
        title.includes('calendário') || title.includes('cronograma') || title.includes('matriz') ||
        tipo.includes('planilha') || content.includes('planilha') || content.includes('calendário editorial')) {
        return { icon: '/sheets.png', name: 'Google Sheets', color: 'text-green-400' };
    }

    if (title.includes('design') || title.includes('visual') || title.includes('banner') ||
        title.includes('logo') || title.includes('identidade') || tipo.includes('design')) {
        return { icon: '/canva.png', name: 'Canva', color: 'text-pink-400' };
    }

    return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };
}

export async function openInGoogleDocs(deliverable: any, pillarLabel: string, session: any, setLoadingDoc: (id: string | null) => void, fallbackId?: string) {
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
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
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
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

// ════════════════════════════════════════════════════════════════
// GOOGLE SHEETS EXPORT
// ════════════════════════════════════════════════════════════════

export async function openInGoogleSheets(result: any, session: any, setLoadingDoc: (id: string | null) => void, fallbackId?: string) {
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
        await signIn('google');
        return;
    }

    const docId = result.id || fallbackId || 'export-sheet';

    const structured = result.structured_data || {};
    const abas = Array.isArray(structured.abas) ? structured.abas : [];
    if (abas.length === 0) {
        alert('Esta planilha ainda não possui dados estruturados (abas). Execute a tarefa novamente para gerar o conteúdo.');
        return;
    }

    setLoadingDoc(docId);
    const title = safeRender(result.entregavel_titulo || 'Planilha');

    try {
        const response = await fetch('/api/google-sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: session.accessToken,
                title,
                structured_data: structured,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar planilha');
        }

        const data = await response.json();
        if (data.success && data.url) {
            window.open(data.url, '_blank');
        } else {
            throw new Error('Resposta inválida ao criar planilha');
        }
    } catch (err: any) {
        console.error('Error creating Google Sheet:', err);
        alert('Erro ao criar planilha: ' + err.message);
    } finally {
        setLoadingDoc(null);
    }
}

// ════════════════════════════════════════════════════════════════
// GOOGLE FORMS EXPORT
// ════════════════════════════════════════════════════════════════

export async function openInGoogleForms(result: any, session: any, setLoadingDoc: (id: string | null) => void, fallbackId?: string) {
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
        await signIn('google');
        return;
    }

    const docId = result.id || fallbackId || 'export-form';
    setLoadingDoc(docId);

    const structured = result.structured_data || {};
    const title = safeRender(result.entregavel_titulo || 'Formulário');

    try {
        const response = await fetch('/api/google-forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: session.accessToken,
                title,
                structured_data: structured,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar formulário');
        }

        const data = await response.json();
        if (data.success && data.url) {
            window.open(data.url, '_blank');
        } else {
            throw new Error('Resposta inválida ao criar formulário');
        }
    } catch (err: any) {
        console.error('Error creating Google Form:', err);
        alert('Erro ao criar formulário: ' + err.message);
    } finally {
        setLoadingDoc(null);
    }
}

// ════════════════════════════════════════════════════════════════
// EXPORT UTILITIES — CSV, structured data download
// ════════════════════════════════════════════════════════════════

/**
 * Export structured tabular data as CSV file download.
 * Works with spreadsheet_tool structured_data format.
 */
export function exportAsCSV(structuredData: any, filename?: string) {
    const abas = structuredData?.abas || [];
    if (abas.length === 0) return;

    const lines: string[] = [];

    for (const aba of abas) {
        if (abas.length > 1) {
            lines.push(`--- ${aba.nome || 'Dados'} ---`);
        }

        // Header row
        const cols = aba.colunas || [];
        if (cols.length > 0) {
            lines.push(cols.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(','));
        }

        // Data rows
        const rows = aba.linhas || [];
        for (const row of rows) {
            if (Array.isArray(row)) {
                lines.push(row.map((cell: any) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
            }
        }

        lines.push(''); // blank line between sheets
    }

    const csvContent = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename || 'dados'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Export form structured_data as a formatted text document ready for Google Forms.
 */
export function exportFormAsText(structuredData: any): string {
    if (!structuredData?.secoes) return '';

    const lines: string[] = [];
    lines.push(`# ${structuredData.titulo_formulario || 'Formulário'}`);
    lines.push('');
    if (structuredData.descricao_intro) {
        lines.push(structuredData.descricao_intro);
        lines.push('');
    }

    let qNum = 1;
    for (const secao of structuredData.secoes) {
        lines.push(`## ${secao.titulo}`);
        if (secao.descricao) lines.push(secao.descricao);
        lines.push('');

        for (const pergunta of (secao.perguntas || [])) {
            const req = pergunta.obrigatoria ? ' *' : '';
            lines.push(`${qNum}. ${pergunta.texto}${req}`);
            lines.push(`   Tipo: ${pergunta.tipo}`);

            if (pergunta.opcoes && pergunta.opcoes.length > 0) {
                for (const opcao of pergunta.opcoes) {
                    lines.push(`   ( ) ${opcao}`);
                }
            }
            if (pergunta.escala_min != null && pergunta.escala_max != null) {
                const labels = pergunta.labels || {};
                lines.push(`   Escala: ${pergunta.escala_min} (${labels.min || ''}) → ${pergunta.escala_max} (${labels.max || ''})`);
            }
            lines.push('');
            qNum++;
        }
    }

    if (structuredData.mensagem_final) {
        lines.push('---');
        lines.push(structuredData.mensagem_final);
    }

    return lines.join('\n');
}
