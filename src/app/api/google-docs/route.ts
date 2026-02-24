import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Função para ajudar a processar o HTML e gerar as requisições de batchUpdate.
// Basicamente converte um texto com marcações muito simples gerado pelo React em parágrafos do Docs.
// Isso garante o bold e fontes, simplificadamente.
function buildUpdateRequests(content: string) {
    const requests: any[] = [];
    const lines = content.split('\n');
    let currentIndex = 1; // o índice inicial onde vamos inserir no Doc vazio

    for (let i = lines.length - 1; i >= 0; i--) {
        let line = lines[i].trim();
        if (!line) {
            requests.push({ insertText: { location: { index: 1 }, text: '\n' } });
            continue;
        }

        // Simplification for the demo: Just inserting the plain text but detecting headers for bolding.
        const isHeaderRegex = /^([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][a-zA-Záàâãéèêíïóôõöúç\s]+:)$|^([IVXLCDM]+\.)\s|^(\d+\.(?:\d+\.)*)$/;
        const isHeader = line.endsWith(':') || isHeaderRegex.test(line) || line.startsWith('──');
        const isListItem = line.startsWith('-') || /^\d+\.\s+[a-zA-Z]/.test(line);

        let textToInsert = line.replace(/^(-|\d+\.)\s*/, isListItem ? '• ' : '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^──\s*|\s*──$/g, '') + '\n';

        requests.push({
            insertText: {
                location: { index: 1 },
                text: textToInsert,
            }
        });

        if (isHeader) {
            requests.push({
                updateTextStyle: {
                    range: { startIndex: 1, endIndex: 1 + textToInsert.length },
                    textStyle: { bold: true, fontSize: { magnitude: 14, unit: 'PT' } },
                    fields: 'bold,fontSize'
                }
            });
        }
    }

    return requests;
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

        // 1. Criar um documento em branco
        const createRes = await docs.documents.create({
            requestBody: {
                title: title || 'Plano de Ação SPCOM',
            },
        });

        const documentId = createRes.data.documentId;

        if (!documentId) throw new Error("Document ID not returned");

        // 2. Montar as instruções de inserção (de baixo pra cima, usando index: 1)
        const requests = buildUpdateRequests(plainContent);

        // 3. Adicionar título gigante no início
        requests.push({
            insertText: {
                location: { index: 1 },
                text: title + '\n\n'
            }
        });
        requests.push({
            updateTextStyle: {
                range: { startIndex: 1, endIndex: 1 + title.length },
                textStyle: { bold: true, fontSize: { magnitude: 24, unit: 'PT' } },
                fields: 'bold,fontSize'
            }
        });

        if (requests.length > 0) {
            await docs.documents.batchUpdate({
                documentId,
                requestBody: {
                    requests,
                }
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
