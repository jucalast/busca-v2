import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { query, maxResults, maxPages, maxSentences, noGroq, verbose } = body;

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        // Construct python command arguments
        // Use 'py' command for windows compatibility as requested
        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';

        // Path to the python script
        // Assumes backend is at project root -> backend/src/search_summarizer/cli.py
        const scriptPath = path.join(process.cwd(), 'backend', 'src', 'search_summarizer', 'cli.py');

        let cmd = `${pythonCommand} "${scriptPath}" "${query}"`;

        if (maxResults) cmd += ` --max-results ${maxResults}`;
        if (maxPages) cmd += ` --max-pages ${maxPages}`;
        if (maxSentences) cmd += ` --max-sentences ${maxSentences}`;
        if (noGroq) cmd += ` --no-groq`;
        if (verbose) cmd += ` --verbose`;

        // Ensure UTF-8 encoding environment variable is set
        const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

        console.log(`Executing: ${cmd}`);

        const { stdout, stderr } = await execPromise(cmd, { env });

        if (stderr && verbose) {
            console.error('Python Stderr:', stderr);
        }

        // Parse output
        // The python script outputs JSON between specific markers or as pure JSON if designed so.
        // Our CLI implementation prints:
        // --- Resumo ---
        // JSON
        // Fontes utilizadas:
        // urls...

        const outputString = stdout.toString();

        // Basic parsing logic based on the CLI output structure
        const jsonStartMarker = "--- Resumo ---";
        const jsonstart = outputString.indexOf(jsonStartMarker);
        const splitParts = outputString.split("Fontes utilizadas:");

        let structuredData = null;
        let sources: string[] = [];

        if (jsonstart !== -1) {
            // Extract JSON part
            const jsonString = outputString.substring(jsonstart + jsonStartMarker.length, splitParts.length > 1 ? outputString.lastIndexOf("Fontes utilizadas:") : undefined).trim();
            try {
                const parsed = JSON.parse(jsonString);
                structuredData = parsed.structured;
                sources = parsed.sources || [];
            } catch (e) {
                console.error("Failed to parse Python JSON output", e, jsonString);
                return NextResponse.json({
                    error: 'Failed to parse synthesis result',
                    raw: outputString
                }, { status: 500 });
            }
        } else {
            // Fallback or error
            console.warn("No JSON marker found in output");
            return NextResponse.json({
                error: 'Invalid response format from backend',
                raw: outputString
            }, { status: 500 });
        }

        return NextResponse.json({
            structured: structuredData,
            sources: sources,
            rawOutput: outputString
        });

    } catch (error: any) {
        console.error('Search API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
