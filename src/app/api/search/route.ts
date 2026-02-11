import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { query, maxResults, maxPages, maxSentences, noGroq, verbose, region, businessMode } = body;

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
        const scriptPath = path.join(process.cwd(), 'backend', 'src', 'search_summarizer', 'cli.py');

        // Escape the query for shell safety
        const escapedQuery = query.replace(/"/g, '\\"');
        let cmd = `${pythonCommand} "${scriptPath}" "${escapedQuery}"`;

        if (maxResults) cmd += ` --max-results ${maxResults}`;
        if (maxPages) cmd += ` --max-pages ${maxPages}`;
        if (maxSentences) cmd += ` --max-sentences ${maxSentences}`;
        if (region) cmd += ` --region ${region}`;
        if (businessMode) cmd += ` --business`;
        if (noGroq) cmd += ` --no-groq`;
        if (verbose) cmd += ` --verbose`;

        const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

        console.log(`Executing: ${cmd}`);

        // Business mode needs more time (multiple searches + AI calls)
        const timeout = businessMode ? 240000 : 30000;
        const maxBuffer = businessMode ? 10 * 1024 * 1024 : 5 * 1024 * 1024;

        const { stdout, stderr } = await execPromise(cmd, { env, timeout, maxBuffer });

        if (stderr && verbose) {
            console.error('Python Stderr:', stderr);
        }

        const outputString = stdout.toString();

        // Parse output
        const jsonStartMarker = "--- Resumo ---";
        const jsonstart = outputString.indexOf(jsonStartMarker);
        const splitParts = outputString.split("Fontes utilizadas:");

        if (jsonstart !== -1) {
            const jsonString = outputString.substring(
                jsonstart + jsonStartMarker.length,
                splitParts.length > 1 ? outputString.lastIndexOf("Fontes utilizadas:") : undefined
            ).trim();

            try {
                const parsed = JSON.parse(jsonString);

                // Business mode returns a different structure
                if (parsed.businessMode) {
                    return NextResponse.json(parsed);
                }

                // Simple mode
                return NextResponse.json({
                    structured: parsed.structured,
                    sources: parsed.sources || [],
                    rawOutput: outputString
                });
            } catch (e) {
                console.error("Failed to parse Python JSON output", e, jsonString.substring(0, 500));
                return NextResponse.json({
                    error: 'Failed to parse synthesis result',
                    raw: outputString.substring(0, 1000)
                }, { status: 500 });
            }
        } else {
            console.warn("No JSON marker found in output");
            return NextResponse.json({
                error: 'Invalid response format from backend',
                raw: outputString.substring(0, 1000)
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Search API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
