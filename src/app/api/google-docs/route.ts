import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Função para ajudar a processar o HTML e gerar as requisições de batchUpdate.
// Basicamente converte um texto com marcações muito simples gerado pelo React em parágrafos do Docs.
// Isso garante o bold e fontes, simplificadamente.
// Tipo para ajudar a mapear a formatação de um trecho de texto
type TextRun = {
    content: string;
    bold?: boolean;
    italic?: boolean;
};

// Parseia estilos inline de negrito e itálico: **bold**, *italic*
function parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let currentIdx = 0;

    // Regex para capturar **negrito** ou *itálico* (bold tem prioridade)
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

    // 1. Headings Markdown (#, ##, ###)
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

    // 2. Lists
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
        const { token, title, plainContent } = body;

        if (!token) {
            return NextResponse.json({ error: "Missing Google Access Token" }, { status: 401 });
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });

        const docs = google.docs({ version: "v1", auth });

        // 1. Criar o documento em branco
        const createRes = await docs.documents.create({
            requestBody: {
                title: title || 'Plano de Ação SPCOM',
            },
        });

        const documentId = createRes.data.documentId;
        if (!documentId) throw new Error("Document ID not returned");

        // 2. Construir as requisições de inserção e formatação
        const requests: any[] = [];

        // Começamos inserindo o título do documento
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

        // Índice corrente — depois do título + 2 newlines
        let currentIndex = 1 + titleText.length;

        // Processar o conteúdo linha a linha
        const lines = plainContent.split('\n');

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

            // A. Inserir o texto limpo (sem asteriscos do Markdown)
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
        console.error("Error generating Google Doc", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
