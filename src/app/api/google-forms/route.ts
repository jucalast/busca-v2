import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * Google Forms API Route
 * 
 * Takes structured_data from FormTool (with secoes/perguntas format)
 * and creates a real Google Form with sections, questions, and options.
 */

// Map our question types to Google Forms question types
function mapQuestionType(tipo: string): { type: string; choiceType?: string } {
    const t = (tipo || "").toLowerCase();
    if (t.includes("multipla_escolha") || t.includes("multiple_choice")) {
        return { type: "RADIO", choiceType: "RADIO" };
    }
    if (t.includes("caixa_selecao") || t.includes("checkbox")) {
        return { type: "CHECKBOX", choiceType: "CHECKBOX" };
    }
    if (t.includes("dropdown") || t.includes("lista")) {
        return { type: "DROP_DOWN", choiceType: "DROP_DOWN" };
    }
    if (t.includes("escala_likert") || t.includes("likert") || t.includes("escala")) {
        return { type: "SCALE" };
    }
    if (t.includes("nps")) {
        return { type: "SCALE" };
    }
    if (t.includes("texto_livre") || t.includes("texto") || t.includes("text") || t.includes("paragrafo")) {
        return { type: "TEXT" };
    }
    if (t.includes("grade") || t.includes("grid")) {
        return { type: "RADIO", choiceType: "RADIO" }; // Fallback: scale questions as radio
    }
    // Default to radio for choice types, text for open-ended
    return { type: "TEXT" };
}

// Build a choiceQuestion item
function buildChoiceQuestion(pergunta: any, typeInfo: { type: string; choiceType?: string }) {
    const options = (pergunta.opcoes || []).map((opcao: string) => ({
        value: opcao,
    }));

    // Must have at least one option for choice questions
    if (options.length === 0) {
        options.push({ value: "Opção 1" });
    }

    return {
        choiceQuestion: {
            type: typeInfo.choiceType || "RADIO",
            options,
        },
    };
}

// Build a scaleQuestion item
function buildScaleQuestion(pergunta: any) {
    const low = pergunta.escala_min ?? 1;
    const high = pergunta.escala_max ?? 5;
    const labels = pergunta.labels || {};

    return {
        scaleQuestion: {
            low,
            high,
            lowLabel: labels.min || "",
            highLabel: labels.max || "",
        },
    };
}

// Build a textQuestion item
function buildTextQuestion(pergunta: any) {
    const tipo = (pergunta.tipo || "").toLowerCase();
    return {
        textQuestion: {
            paragraph: tipo.includes("paragrafo") || tipo.includes("texto_livre"),
        },
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, title, structured_data } = body;

        if (!token) {
            return NextResponse.json({ error: "Missing Google Access Token" }, { status: 401 });
        }

        if (!structured_data || !structured_data.secoes || structured_data.secoes.length === 0) {
            return NextResponse.json({ error: "No structured data (secoes) provided" }, { status: 400 });
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });

        const forms = google.forms({ version: "v1", auth });

        // ━━━ 1. Create empty form ━━━
        const formTitle = structured_data.titulo_formulario || title || "Formulário";
        
        const createRes = await forms.forms.create({
            requestBody: {
                info: {
                    title: formTitle,
                    documentTitle: formTitle,
                },
            },
        });

        const formId = createRes.data.formId;
        if (!formId) throw new Error("Form ID not returned");

        // ━━━ 2. Build update requests to add description, sections, and questions ━━━
        const requests: any[] = [];
        let itemIndex = 0;

        // Add form description if available
        if (structured_data.descricao_intro) {
            requests.push({
                updateFormInfo: {
                    info: {
                        description: structured_data.descricao_intro,
                    },
                    updateMask: "description",
                },
            });
        }

        // Process each section
        const secoes = structured_data.secoes || [];
        
        for (let s = 0; s < secoes.length; s++) {
            const secao = secoes[s];

            // Add section header (skip for first section — it's the form itself)
            if (s > 0) {
                requests.push({
                    createItem: {
                        item: {
                            title: secao.titulo || `Seção ${s + 1}`,
                            description: secao.descricao || "",
                            pageBreakItem: {},
                        },
                        location: { index: itemIndex },
                    },
                });
                itemIndex++;
            }

            // Add questions for this section
            const perguntas = secao.perguntas || [];
            
            for (const pergunta of perguntas) {
                const typeInfo = mapQuestionType(pergunta.tipo);
                let questionDetail: any;

                if (typeInfo.type === "SCALE") {
                    questionDetail = buildScaleQuestion(pergunta);
                } else if (typeInfo.type === "TEXT") {
                    questionDetail = buildTextQuestion(pergunta);
                } else {
                    // RADIO, CHECKBOX, DROP_DOWN
                    questionDetail = buildChoiceQuestion(pergunta, typeInfo);
                }

                requests.push({
                    createItem: {
                        item: {
                            title: pergunta.texto || "Pergunta sem título",
                            questionItem: {
                                question: {
                                    required: pergunta.obrigatoria ?? false,
                                    ...questionDetail,
                                },
                            },
                        },
                        location: { index: itemIndex },
                    },
                });
                itemIndex++;
            }
        }

        // ━━━ 3. Apply all updates ━━━
        if (requests.length > 0) {
            await forms.forms.batchUpdate({
                formId,
                requestBody: {
                    requests,
                },
            });
        }

        // ━━━ 4. Get the form URL ━━━
        const formData = await forms.forms.get({ formId });
        const responderUri = formData.data.responderUri || `https://docs.google.com/forms/d/${formId}/edit`;
        const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

        return NextResponse.json({
            success: true,
            formId,
            url: editUrl,
            responderUrl: responderUri,
        });

    } catch (error: any) {
        console.error("Error creating Google Form:", error);
        
        // Specific error handling for Forms API
        if (error.code === 403 || error.message?.includes("insufficient")) {
            return NextResponse.json({ 
                error: "Permissão insuficiente. Faça login novamente para conceder acesso ao Google Forms." 
            }, { status: 403 });
        }
        
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
