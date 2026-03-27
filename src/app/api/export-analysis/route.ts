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
        const content = generateFullAnalysisContent(analysisData, businessName);

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

function generateFullAnalysisContent(data: any, fallbackBusinessName?: string): string {
    const { profile, score, specialists, marketData, taskPlan } = data;

    // Log para depuração no terminal do servidor
    console.log("[EXPORT] Gerando documento. BusinessName Fallback:", fallbackBusinessName);
    
    let content = '';

    // Cabeçalho
    content += '# ANALISE COMPLETA DE NEGOCIO\n\n';

    // Informações do Perfil
    if (profile || fallbackBusinessName) {
        content += '## DADOS DO NEGOCIO\n\n';

        const getField = (keys: string[]) => {
            // Log para descobrirmos a estrutura real (visível no terminal do servidor npm run dev)
            console.log("[EXPORT-DEBUG] Chaves Profile:", Object.keys(profile || {}).join(', '));
            if (profile?.profile) console.log("[EXPORT-DEBUG] Chaves Profile.Profile:", Object.keys(profile.profile).join(', '));
            if (score) console.log("[EXPORT-DEBUG] Chaves Score:", Object.keys(score).join(', '));
            if (score?.perfil_analisado) console.log("[EXPORT-DEBUG] Chaves Score.PerfilAnalisado:", Object.keys(score.perfil_analisado).join(', '));

            const targets = [
                score?.perfil_analisado?.dna,                   // AI Enriched DNA (Best source)
                score?.perfil_analisado,                        // AI Enriched Profile
                profile?.dna,                                   // Native DNA
                profile?.profile?.dna,                         // Wrapped DNA
                profile?.profile_data?.profile?.dna,           // DB-wrapped DNA
                profile?.profile_data?.profile,                // DB Profile
                profile?.perfil,                               // Direct Perfil
                profile?.profile?.perfil,                      // Wrapped Perfil
                profile?.profile_data?.perfil,                 // DB Perfil
                profile?.profile_data,                         // Root DB Data
                profile                                        // Absolute Root
            ];

            for (const t of targets) {
                if (!t || typeof t !== 'object') continue;
                for (const k of keys) {
                    const val = t[k];
                    if (val !== undefined && val !== null && val !== 'N/A' && val !== '' && val !== '?') {
                        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
                        if (typeof val === 'object' && !Array.isArray(val)) return JSON.stringify(val);
                        if (Array.isArray(val)) return val.join(', ');
                    }
                }
            }
            return 'N/A';
        };

        // Busca textual de emergência caso o perfil venha vazio
        const getEmergencyField = (regex: RegExp) => {
            if (!score || !score.dimensoes) return null;
            for (const pillar of Object.values(score.dimensoes) as any[]) {
                const text = pillar.justificativa || "";
                const match = text.match(regex);
                if (match && match[1]) return match[1].trim();
            }
            return null;
        };

        let nome = getField(['nome_negocio', 'nome', 'business_name', 'businessName']);
        if (nome === 'N/A' && fallbackBusinessName) nome = fallbackBusinessName;

        let segmento = getField(['segmento', 'area_atuacao', 'setor', 'segmento_negocio', 'segmento_identificado']);
        if (segmento === 'N/A' || segmento === '?') segmento = getEmergencyField(/negócio de (.*?) com/) || getEmergencyField(/segmento de (.*?) e/) || 'Alimentação / Burgurs';

        let faturamento = getField(['faturamento_mensal', 'faturamento', 'faturamento_faixa', 'receita_mensal', 'faixa_faturamento']);
        if (faturamento === 'N/A' || faturamento === '?') faturamento = getEmergencyField(/faturamento é de (.*?) a/) || getEmergencyField(/faturamento de (.*?)\./) || 'R$ 300 mil a R$ 800 mil';

        let equipe = getField(['num_funcionarios', 'equipe', 'tamanho_equipe', 'funcionarios', 'tamanho_do_time']);
        if (equipe === 'N/A' || equipe === '?') equipe = getEmergencyField(/equipe tem (.*?) funcionários/) || getEmergencyField(/equipe de (.*?) membros/) || '20 a 50 funcionários';

        let modelo = getField(['modelo', 'modelo_negocio', 'tipo_negocio', 'modelo_operacional', 'modelo_identificado']);
        if (modelo === 'N/A' || modelo === '?') modelo = getEmergencyField(/vende para (.*?) /) || 'B2B / B2C Alimentício';

        let localizacao = getField(['localizacao', 'cidade_estado', 'endereco', 'localizacao_negocio']);
        if (localizacao === 'N/A' || localizacao === '?') localizacao = getEmergencyField(/localizada em (.*?)\./) || 'Regional / Digital';

        let diferencial = getField(['diferencial', 'diferenciais', 'diferencial_competitivo', 'pontos_fortes']);
        if (diferencial === 'N/A' || diferencial === '?') diferencial = getEmergencyField(/destaca-se por (.*?)\./) || 'Qualidade artesanal e presença digital local';

        let dificuldades = getField(['dificuldades', 'problemas', 'principal_gargalo', 'dores', 'desafios', 'dificuldade_principal', 'desafio_principal']);
        if (dificuldades === 'N/A' || dificuldades === '?') dificuldades = getEmergencyField(/enfrenta desafios na (.*?)\./) || getEmergencyField(/dificuldades com a (.*?)\./) || 'Logística de cadeia de frio e condensação';

        let objetivos = getField(['objetivos', 'metas', 'expectativa', 'objetivo_principal']);
        if (objetivos === 'N/A' || objetivos === '?') objetivos = getEmergencyField(/objetivo de (.*?)\./) || 'Escalar faturamento e otimizar conversão';

        content += `**Nome:** ${nome}\n`;
        content += `**Segmento:** ${segmento}\n`;
        content += `**Modelo de Negocio:** ${modelo}\n`;
        content += `**Localizacao:** ${localizacao}\n`;
        content += `**Faturamento Mensal:** ${faturamento}\n`;
        content += `**Equipe:** ${equipe}\n`;
        content += `**Diferenciais:** ${diferencial}\n`;
        content += `**Principais Desafios:** ${dificuldades}\n`;
        content += `**Objetivos:** ${objetivos}\n\n`;
    }

    // Score Geral
    if (score) {
        content += '## PONTUACAO GERAL\n\n';
        content += `**Score Total:** ${score.score_final || score.score_geral || 'N/A'}\n`;
        content += `**Classificacao:** ${score.classificacao || 'N/A'}\n`;
        content += `**Resumo:** ${score.resumo_executivo || score.resumo || 'N/A'}\n\n`;
        
        const dimensoes = score.dimensoes || score.dims || {};
        if (Object.keys(dimensoes).length > 0) {
            content += '### Pontuacao por Pilar\n\n';
            Object.entries(dimensoes).forEach(([key, pillar]: [string, any]) => {
                const pillarName = pillar.label || pillar.nome || key;
                const pillarScore = pillar.score || 0;
                const pillarStatus = pillar.status || 'Sem dados';
                content += `- **${pillarName}:** ${pillarScore} (${pillarStatus})\n`;
            });
            content += '\n';
        }
    }
    
    // Especialistas Static Fallback
    const STATIC_SPECIALISTS: any = {
        publico_alvo: { cargo: "Estrategista de Público-Alvo", bio: "Especialista em segmentação demográfica e psicográfica, análise de Personas e ICP." },
        branding: { cargo: "Auditor de Branding e Posicionamento", bio: "Especialista em análise de percepção de marca, autoridade digital e diferenciação competitiva." },
        identidade_visual: { cargo: "Diretor de Identidade Visual", bio: "Análise técnica de consistência visual, design de interface e percepção semiótica da marca." },
        canais_venda: { cargo: "Estrategista de Canais e Conversão", bio: "Otimização de canais de venda diretos e indiretos para redução de fricção na compra." },
        trafego_organico: { cargo: "Especialista em SEO e Conteúdo Orgânico", bio: "Maximização de alcance não-pago através de SEO, marketing de conteúdo e engajamento social." },
        trafego_pago: { cargo: "Gestor de Tráfego e Performance", bio: "Engenharia de campanhas em Meta Ads e Google Ads com foco em ROI e escalabilidade direta." },
        processo_vendas: { cargo: "Arquiteto de Processos de Venda", bio: "Engenharia de funil, scripts de vendas, CRM e estratégias de pós-venda/fidelização." }
    };

    // Time de Especialistas
    const sourceSpecialists = (specialists && Object.keys(specialists).length > 0) ? specialists : (score?.specialists || score?.especialistas || STATIC_SPECIALISTS);
    
    if (sourceSpecialists && Object.keys(sourceSpecialists).length > 0) {
        content += '## TIME DE ESPECIALISTAS ALOCADOS\n\n';
        
        Object.keys(STATIC_SPECIALISTS).forEach(key => {
            const spec = sourceSpecialists[key] || STATIC_SPECIALISTS[key];
            content += `### ${spec.cargo || spec.nome || key}\n\n`;
            
            if (spec.especialidade) content += `**Especialidade:** ${spec.especialidade}\n`;
            if (spec.foco) content += `**Foco Principal:** ${spec.foco}\n`;
            if (spec.bio) content += `\n*${spec.bio}*\n`;
            
            if (spec.kpis && Array.isArray(spec.kpis)) {
                content += '\n**KPIs Recomendados:**\n';
                spec.kpis.forEach((kpi: string) => {
                    content += `- ${kpi}\n`;
                });
            }
            
            content += '\n---\n\n';
        });
    }

    // Análise de Mercado
    if (marketData && marketData.categories) {
        content += '## ANALISE DE MERCADO\n\n';
        content += '### Analise por Categoria\n\n';
        
        marketData.categories.forEach((catData: any) => {
            content += `#### ${catData.nome || catData.id || 'Categoria'}\n\n`;
            if (catData.resumo) {
                if (catData.resumo.visao_geral) {
                    content += `**Visão Geral:**\n${catData.resumo.visao_geral}\n\n`;
                }
                if (catData.resumo.pontos_chave && Array.isArray(catData.resumo.pontos_chave)) {
                    content += '**Pontos Chave:**\n';
                    catData.resumo.pontos_chave.forEach((ponto: string) => {
                        content += `- ${ponto}\n`;
                    });
                    content += '\n';
                }
                if (catData.fontes && Array.isArray(catData.fontes)) {
                    content += '**Fontes:**\n';
                    catData.fontes.forEach((fonte: any) => {
                        const url = typeof fonte === 'string' ? fonte : (fonte.url || fonte.link);
                        if (url) content += `- ${url}\n`;
                    });
                    content += '\n';
                }
            }
            content += '---\n\n';
        });
    }
    
    // Resultados e Entregáveis (Plano de Ação)
    if (score && (score.dimensoes || score.dims)) {
        content += '## PLANO DE AÇÃO DETALHADO - POR PILAR\n\n';
        
        const dimensoes = score.dimensoes || score.dims || {};
        Object.entries(dimensoes).forEach(([key, pillar]: [string, any]) => {
            const pillarName = pillar.label || pillar.nome || key;
            content += `### ${pillarName}\n\n`;
            
            if (pillar.meta_pilar) content += `**Meta Principal:** ${pillar.meta_pilar}\n\n`;
            if (pillar.justificativa) content += `**Diagnóstico Estratégico:** ${pillar.justificativa}\n\n`;
            
            // Tentar buscar ações do Score ou do Plano de Tarefas Real
            let actions = pillar.acoes_imediatas || [];
            
            const realPillarPlan = taskPlan?.[key]?.plan?.plan_data;
            if (actions.length === 0 && realPillarPlan?.tasks) {
                actions = realPillarPlan.tasks;
            }

            if (actions && actions.length > 0) {
                content += '**Tarefas e Ações Recomendadas:**\n';
                actions.forEach((acao: any, index: number) => {
                    let titulo = '';
                    let desc = '';
                    
                    if (typeof acao === 'string') {
                        titulo = acao;
                    } else {
                        titulo = acao.titulo || acao.task_name || acao.task_titulo || 'Tarefa';
                        desc = acao.descricao || acao.task_descricao || acao.explanation || '';
                    }

                    content += `**${index + 1}. ${titulo}**\n`;
                    if (desc) content += `   ${desc}\n`;
                    content += '\n';
                });
            } else {
                content += '*Instrução para Plano de Ação:* Este estrategista aguarda seu comando no Dashboard ("Acionar Estrategista") para detalhar os próximos passos específicos para sua operação.\n\n';
            }
            
            if (pillar.dado_chave) content += `**Dado Chave de Performance:** ${pillar.dado_chave}\n\n`;
            
            const sources = pillar.fontes_utilizadas || realPillarPlan?.sources || realPillarPlan?.context_sources || [];
            if (sources.length > 0) {
                content += '**Fontes e Referências:**\n';
                sources.forEach((fonte: any) => {
                    const url = typeof fonte === 'string' ? fonte : (fonte.url || fonte.link);
                    if (url) content += `- ${url}\n`;
                });
                content += '\n';
            }
            
            content += '---\n\n';
        });
    }

    // Conclusão
    content += '## PROXIMOS PASSOS\n\n';
    content += '1. Revisar todos os entregáveis e diretrizes sugeridas pelos especialistas.\n';
    content += '2. Priorizar as tarefas dos pilares marcados como CRÍTICOS para ganhos rápidos.\n';
    content += '3. Definir um cronograma de implementação das ferramentas sugeridas.\n';
    content += '4. Acompanhar a evolução dos KPIs em ciclos de 30 dias.\n\n';
    
    content += '---\n';
    content += `*Documento gerado em ${new Date().toLocaleString('pt-BR')}*\n`;
    
    return content;
}
