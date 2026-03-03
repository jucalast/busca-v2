import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * Google Sheets API Route
 * 
 * Takes structured_data from SpreadsheetTool (with abas/colunas/linhas format)
 * and creates a real Google Sheet with proper tabs, headers, and data.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, title, structured_data } = body;

        if (!token) {
            return NextResponse.json({ error: "Missing Google Access Token" }, { status: 401 });
        }

        if (!structured_data || !structured_data.abas || structured_data.abas.length === 0) {
            return NextResponse.json({ error: "No structured data (abas) provided" }, { status: 400 });
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });

        const sheets = google.sheets({ version: "v4", auth });

        // ━━━ 1. Build sheet definitions from structured_data ━━━
        const abas = structured_data.abas;
        const sheetDefs = abas.map((aba: any, idx: number) => ({
            properties: {
                sheetId: idx,
                title: aba.nome || `Aba ${idx + 1}`,
                index: idx,
            },
        }));

        // ━━━ 2. Create the spreadsheet with all sheets ━━━
        const createRes = await sheets.spreadsheets.create({
            requestBody: {
                properties: {
                    title: title || "Planilha Gerada",
                },
                sheets: sheetDefs,
            },
        });

        const spreadsheetId = createRes.data.spreadsheetId;
        if (!spreadsheetId) throw new Error("Spreadsheet ID not returned");

        // ━━━ 3. Populate each sheet with data ━━━
        const valueRanges: any[] = [];

        for (let i = 0; i < abas.length; i++) {
            const aba = abas[i];
            const sheetTitle = aba.nome || `Aba ${i + 1}`;
            const colunas = aba.colunas || [];
            const linhas = aba.linhas || [];

            // Build rows: header + data
            const rows: any[][] = [];
            if (colunas.length > 0) {
                rows.push(colunas);
            }
            for (const row of linhas) {
                if (Array.isArray(row)) {
                    rows.push(row.map((cell: any) => cell ?? ""));
                }
            }

            if (rows.length > 0) {
                valueRanges.push({
                    range: `'${sheetTitle}'!A1`,
                    majorDimension: "ROWS",
                    values: rows,
                });
            }
        }

        if (valueRanges.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: valueRanges,
                },
            });
        }

        // ━━━ 4. Format headers (bold, background color, freeze) ━━━
        const formatRequests: any[] = [];

        for (let i = 0; i < abas.length; i++) {
            const aba = abas[i];
            const colunas = aba.colunas || [];

            if (colunas.length > 0) {
                // Bold header row
                formatRequests.push({
                    repeatCell: {
                        range: {
                            sheetId: i,
                            startRowIndex: 0,
                            endRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: colunas.length,
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: {
                                    red: 0.9,
                                    green: 0.93,
                                    blue: 0.98,
                                    alpha: 1,
                                },
                            },
                        },
                        fields: "userEnteredFormat(textFormat,backgroundColor)",
                    },
                });

                // Freeze header row
                formatRequests.push({
                    updateSheetProperties: {
                        properties: {
                            sheetId: i,
                            gridProperties: {
                                frozenRowCount: 1,
                            },
                        },
                        fields: "gridProperties.frozenRowCount",
                    },
                });

                // Auto-resize columns
                formatRequests.push({
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId: i,
                            dimension: "COLUMNS",
                            startIndex: 0,
                            endIndex: colunas.length,
                        },
                    },
                });
            }
        }

        if (formatRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: formatRequests },
            });
        }

        return NextResponse.json({
            success: true,
            spreadsheetId,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        });

    } catch (error: any) {
        console.error("Error creating Google Sheet:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
