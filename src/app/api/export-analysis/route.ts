import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Tipos para ajudar a processar o HTML e gerar as requisições de batchUpdate
type TextRun = {
    content: string;
    bold?: boolean;
    italic?: boolean;
};

// Parseia estilos inline de negrito e itálico: **bold**, *italic*
function parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let currentIdx = 0;

    const regex = /(\*\*(.*?)\*\*|\*(.*?)\*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > currentIdx) {
            runs.push({ content: text.substring(currentIdx, match.index) });
        }

        const fullMatch = match[1];
        if (fullMatch.startsWith('**')) {
            runs.push({ content: match[2], bold: true });
        } else {
            runs.push({ content: match[3], italic: true });
        }

        currentIdx = regex.lastIndex;
    }

    if (currentIdx < text.length) {
        runs.push({ content: text.substring(currentIdx) });
    }

    if (runs.length === 0 && text.length > 0) {
        runs.push({ content: text });
    }

    return runs;
}

// Analisa uma linha de Markdown e retorna dados limpos
function parseLine(rawLine: string) {
    let cleanLine = rawLine;
    let paragraphStyle = 'NORMAL_TEXT';
    let bulletType: 'NONE' | 'BULLET' | 'NUMBERED' = 'NONE';

    // Headings Markdown (#, ##, ###)
    const headingMatch = cleanLine.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
        const level = headingMatch[1].length;
        paragraphStyle = level === 1 ? 'HEADING_1'
            : level === 2 ? 'HEADING_2'
                : level === 3 ? 'HEADING_3'
                    : 'HEADING_4';
        cleanLine = headingMatch[2];
    }
    // Heurística: linhas terminando em ":" sozinhas e com inicial maiúscula → subtítulo
    else if (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-záàâãéèêíïóôõöúç\s]+:$/.test(cleanLine)) {
        paragraphStyle = 'HEADING_3';
        cleanLine = cleanLine.replace(/:$/, '');
    }
    // Heurística: linhas com separadores ──
    else if (cleanLine.startsWith('──')) {
        paragraphStyle = 'HEADING_2';
        cleanLine = cleanLine.replace(/^──\s*|\s*──$/g, '').trim();
    }

    // Lists
    const bulletMatch = cleanLine.match(/^[-•*]\s+(.*)/);
    const numberedMatch = cleanLine.match(/^\d+\.\s+(.*)/);
    if (bulletMatch) {
        bulletType = 'BULLET';
        cleanLine = bulletMatch[1];
    } else if (numberedMatch) {
        bulletType = 'NUMBERED';
        cleanLine = numberedMatch[1];
    }

    return { cleanLine, paragraphStyle, bulletType };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, analysisData, businessName } = body;

        if (!token) {
            return NextResponse.json({ error: "Missing Google Access Token" }, { status: 401 });
        }

        if (!analysisData) {
            return NextResponse.json({ error: "Missing analysis data" }, { status: 400 });
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });

        const docs = google.docs({ version: "v1", auth });

        // Gerar título do documento
        const timestamp = new Date().toLocaleDateString('pt-BR');
        const title = `Análise Completa - ${businessName || 'Negócio'} (${timestamp})`;

        // 1. Criar o documento em branco
        const createRes = await docs.documents.create({
            requestBody: { title },
        });

        const documentId = createRes.data.documentId;
        if (!documentId) throw new Error("Document ID not returned");

        // 2. Gerar conteúdo completo da análise
        const content = generateFullAnalysisContent(analysisData);

        // 3. Construir as requisições de inserção e formatação
        const requests: any[] = [];

        // Inserir título
        const titleText = title + '\n\n';
        requests.push({
            insertText: { location: { index: 1 }, text: titleText }
        });
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: 1, endIndex: 1 + title.length + 1 },
                paragraphStyle: { namedStyleType: 'TITLE' },
                fields: 'namedStyleType'
            }
        });

        // Índice corrente
        let currentIndex = 1 + titleText.length;

        // Processar o conteúdo linha a linha
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();

            // Linha vazia → só insere newline
            if (!trimmed) {
                requests.push({
                    insertText: { location: { index: currentIndex }, text: '\n' }
                });
                currentIndex += 1;
                continue;
            }

            const { cleanLine, paragraphStyle, bulletType } = parseLine(trimmed);

            // Parse inline formatting (bold/italic)
            const runs = parseInlineFormatting(cleanLine);
            const plainText = runs.map(r => r.content).join('');
            const fullText = plainText + '\n';
            const lineStart = currentIndex;
            const lineEnd = currentIndex + fullText.length;

            // A. Inserir o texto limpo
            requests.push({
                insertText: { location: { index: currentIndex }, text: fullText }
            });

            // B. Aplicar estilo de parágrafo (Heading)
            if (paragraphStyle !== 'NORMAL_TEXT') {
                requests.push({
                    updateParagraphStyle: {
                        range: { startIndex: lineStart, endIndex: lineEnd },
                        paragraphStyle: { namedStyleType: paragraphStyle },
                        fields: 'namedStyleType'
                    }
                });
            }

            // C. Aplicar bullets/numbered list
            if (bulletType !== 'NONE') {
                requests.push({
                    createParagraphBullets: {
                        range: { startIndex: lineStart, endIndex: lineEnd },
                        bulletPreset: bulletType === 'BULLET'
                            ? 'BULLET_DISC_CIRCLE_SQUARE'
                            : 'NUMBERED_DECIMAL_ALPHA_ROMAN'
                    }
                });
            }

            // D. Aplicar formatação inline (bold, italic)
            let runOffset = lineStart;
            for (const run of runs) {
                const runLen = run.content.length;
                if (runLen > 0 && (run.bold || run.italic)) {
                    const fields: string[] = [];
                    const textStyle: any = {};
                    if (run.bold) { textStyle.bold = true; fields.push('bold'); }
                    if (run.italic) { textStyle.italic = true; fields.push('italic'); }

                    requests.push({
                        updateTextStyle: {
                            range: { startIndex: runOffset, endIndex: runOffset + runLen },
                            textStyle,
                            fields: fields.join(',')
                        }
                    });
                }
                runOffset += runLen;
            }

            // E. Detectar URLs e transformar em links clicáveis
            const urlRegex = /https?:\/\/[^\s)]+/g;
            let urlMatch;
            while ((urlMatch = urlRegex.exec(plainText)) !== null) {
                const urlStart = lineStart + urlMatch.index;
                const urlEnd = urlStart + urlMatch[0].length;
                requests.push({
                    updateTextStyle: {
                        range: { startIndex: urlStart, endIndex: urlEnd },
                        textStyle: {
                            link: { url: urlMatch[0] },
                            foregroundColor: { color: { rgbColor: { red: 0.06, green: 0.46, blue: 0.88 } } },
                            underline: true
                        },
                        fields: 'link,foregroundColor,underline'
                    }
                });
            }

            currentIndex = lineEnd;
        }

        // 3. Enviar tudo de uma vez
        if (requests.length > 0) {
            await docs.documents.batchUpdate({
                documentId,
                requestBody: { requests },
            });
        }

        return NextResponse.json({
            success: true,
            documentId,
            url: `https://docs.google.com/document/d/${documentId}/edit`
        });

    } catch (error: any) {
        console.error("Error generating full analysis Google Doc", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function generateFullAnalysisContent(data: any): string {
    const { profile, score, specialists, marketData, taskPlan } = data;
    
    let content = '';
    
    // Cabeçalho
    content += '# ANALISE COMPLETA DE NEGOCIO\n\n';
    
    // Informações do Perfil
    if (profile?.perfil) {
        content += '## DADOS DO NEGOCIO\n\n';
        const p = profile.perfil;
        content += `**Nome:** ${p.nome || 'N/A'}\n`;
        content += `**Segmento:** ${p.segmento || 'N/A'}\n`;
        content += `**Modelo de Negocio:** ${p.modelo_negocio || 'N/A'}\n`;
        content += `**Localizacao:** ${p.localizacao || 'N/A'}\n`;
        content += `**Estagio:** ${p.estagio || 'N/A'}\n`;
        content += `**Faturamento:** ${p.faturamento || 'N/A'}\n`;
        content += `**Equipe:** ${p.equipe || 'N/A'}\n`;
        content += `**Diferenciais:** ${p.diferenciais || 'N/A'}\n\n`;
    }
    
    // Score Geral
    if (score) {
        content += '## PONTUACAO GERAL\n\n';
        content += `**Score Total:** ${score.score_geral || 'N/A'}\n`;
        content += `**Classificacao:** ${score.classificacao || 'N/A'}\n`;
        content += `**Resumo:** ${score.resumo_executivo || 'N/A'}\n\n`;
        
        if (score.dimensoes) {
            content += '### Pontuacao por Pilar\n\n';
            Object.entries(score.dimensoes).forEach(([key, pillar]: [string, any]) => {
                content += `- **${pillar.label || key}:** ${pillar.score} (${pillar.status})\n`;
            });
            content += '\n';
        }
    }
    
    // Análise de Mercado
    if (marketData) {
        content += '## ANALISE DE MERCADO\n\n';
        
        if (marketData.visao_geral) {
            content += '### Visao Geral\n\n';
            content += `${marketData.visao_geral}\n\n`;
        }
        
        if (marketData.categorias) {
            content += '### Analise por Categoria\n\n';
            Object.entries(marketData.categorias).forEach(([catKey, catData]: [string, any]) => {
                content += `#### ${catData.nome || catKey}\n\n`;
                if (catData.visao_geral) {
                    content += `${catData.visao_geral}\n\n`;
                }
                if (catData.pontos_chave) {
                    content += '**Pontos Chave:**\n';
                    catData.pontos_chave.forEach((ponto: string) => {
                        content += `- ${ponto}\n`;
                    });
                    content += '\n';
                }
                if (catData.fontes) {
                    content += '**Fontes:**\n';
                    catData.fontes.forEach((fonte: string) => {
                        content += `- ${fonte}\n`;
                    });
                    content += '\n';
                }
            });
        }
    }
    
    // Planos dos Especialistas
    if (specialists) {
        content += '## PLANOS DOS ESPECIALISTAS\n\n';
        
        Object.entries(specialists).forEach(([key, specialist]: [string, any]) => {
            if (specialist.plan) {
                const plan = specialist.plan;
                content += `### ${plan.titulo_plano || specialist.cargo}\n\n`;
                
                if (plan.objetivo) {
                    content += '**Objetivo:**\n';
                    content += `${plan.objetivo}\n\n`;
                }
                
                if (plan.justificativa) {
                    content += '**Justificativa:**\n';
                    content += `${plan.justificativa}\n\n`;
                }
                
                if (plan.tarefas) {
                    content += '**Tarefas:**\n';
                    plan.tarefas.forEach((tarefa: any, index: number) => {
                        content += `${index + 1}. **${tarefa.titulo}**\n`;
                        content += `   ${tarefa.descricao}\n`;
                        if (tarefa.executavel_por_ia) {
                            content += `   *IA pode executar*\n`;
                        } else {
                            content += `   *Acao manual necessaria*\n`;
                        }
                        content += '\n';
                    });
                }
                
                if (plan.kpis) {
                    content += '**KPIs:**\n';
                    plan.kpis.forEach((kpi: string) => {
                        content += `- ${kpi}\n`;
                    });
                    content += '\n';
                }
                
                if (plan.resultado_final) {
                    content += '**Resultado Final:**\n';
                    content += `${plan.resultado_final}\n\n`;
                }
                
                if (plan.fontes_consultadas) {
                    content += '**Fontes Consultadas:**\n';
                    plan.fontes_consultadas.forEach((fonte: string) => {
                        content += `- ${fonte}\n`;
                    });
                    content += '\n';
                }
                
                content += '---\n\n';
            }
        });
    }
    
    // Resultados e Entregáveis
    if (taskPlan) {
        content += '## RESULTADOS E ENTREGAVEIS\n\n';
        
        Object.entries(taskPlan).forEach(([key, pillarData]: [string, any]) => {
            if (pillarData.executions) {
                content += `### ${pillarData.plan?.titulo_plano || key}\n\n`;
                
                pillarData.executions.forEach((execution: any) => {
                    if (execution.deliverable) {
                        content += `#### ${execution.deliverable.titulo || 'Entregavel'}\n\n`;
                        content += `${execution.deliverable.conteudo || execution.deliverable.resumo || 'Sem conteudo'}\n\n`;
                        
                        if (execution.deliverable.impacto) {
                            content += `**Impacto:** ${execution.deliverable.impacto}\n\n`;
                        }
                        
                        if (execution.deliverable.como_aplicar) {
                            content += '**Como Aplicar:**\n';
                            execution.deliverable.como_aplicar.forEach((passo: string) => {
                                content += `- ${passo}\n`;
                            });
                            content += '\n';
                        }
                        
                        if (execution.deliverable.fontes) {
                            content += '**Fontes:**\n';
                            execution.deliverable.fontes.forEach((fonte: string) => {
                                content += `- ${fonte}\n`;
                            });
                            content += '\n';
                        }
                    }
                });
            }
        });
    }
    
    // Conclusão
    content += '## PROXIMOS PASSOS\n\n';
    content += '1. Revisar todos os entregaveis gerados\n';
    content += '2. Priorizar as tarefas de maior impacto\n';
    content += '3. Definir cronograma de implementacao\n';
    content += '4. Acompanhar os KPIs definidos\n';
    content += '5. Reavaliar a analise em 3-6 meses\n\n';
    
    content += '---\n';
    content += `*Documento gerado em ${new Date().toLocaleString('pt-BR')}*\n`;
    
    return content;
}
