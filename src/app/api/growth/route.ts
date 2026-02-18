import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const execPromise = util.promisify(exec);

/**
 * Write input JSON to a temp file so we don't hit Windows command-line limits.
 * Returns the temp file path.
 */
function writeTempInput(data: any): string {
    const tmpDir = os.tmpdir();
    const fileName = `growth_${crypto.randomBytes(8).toString('hex')}.json`;
    const tmpPath = path.join(tmpDir, fileName);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 0), 'utf-8');
    return tmpPath;
}

/**
 * Run the growth orchestrator with given action and input data.
 * Uses temp files to pass large JSON payloads safely on Windows.
 */
async function runOrchestrator(action: string, inputData: any, timeoutMs: number = 300000): Promise<any> {
    const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
    const scriptPath = path.join(process.cwd(), 'backend', 'src', 'search_summarizer', 'growth_orchestrator.py');
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

    // Write input to temp file
    const tmpPath = writeTempInput(inputData);

    try {
        const cmd = `${pythonCommand} "${scriptPath}" --action ${action} --input-file "${tmpPath}"`;
        console.log(`[Growth API] Running: ${action} (timeout: ${timeoutMs}ms)`);

        const { stdout, stderr } = await execPromise(cmd, {
            env,
            timeout: timeoutMs,
            maxBuffer: 20 * 1024 * 1024,
        });

        if (stderr) {
            console.log(`[Growth API] stderr: ${stderr}`);
        }

        // Parse output based on action markers
        const marker = action === 'analyze' ? '--- GROWTH_RESULT ---'
            : action === 'assist' ? '--- ASSIST_RESULT ---'
                : action === 'dimension-chat' ? '--- DIMENSION_CHAT_RESULT ---'
                    : action === 'list-businesses' ? '--- LIST_BUSINESSES_RESULT ---'
                        : action === 'get-business' ? '--- GET_BUSINESS_RESULT ---'
                            : action === 'create-business' ? '--- CREATE_BUSINESS_RESULT ---'
                                : action === 'save-analysis' ? '--- SAVE_ANALYSIS_RESULT ---'
                                    : action === 'register' ? '--- REGISTER_RESULT ---'
                                        : action === 'login' ? '--- LOGIN_RESULT ---'
                                            : action === 'logout' ? '--- LOGOUT_RESULT ---'
                                                : action === 'validate-session' ? '--- VALIDATE_SESSION_RESULT ---'
                                                    : null;

        if (marker) {
            const markerIdx = stdout.indexOf(marker);
            if (markerIdx !== -1) {
                const jsonStr = stdout.substring(markerIdx + marker.length).trim();
                return JSON.parse(jsonStr);
            }
        }

        // Fallback: find last complete JSON object in output
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error(`No JSON found in output. stdout preview: ${stdout.substring(0, 300)}`);

    } finally {
        // Clean up temp file
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
}

// ─────────────────────────────────────────────
// Growth Mode API
// ─────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, onboardingData, task, profile, region, messages, user_message, extracted_profile, user_id, business_id } = body;

        // ━━━ Action: Profile (onboarding → profile) ━━━
        if (action === 'profile') {
            if (!onboardingData) {
                return NextResponse.json({ error: 'onboardingData is required' }, { status: 400 });
            }

            const result = await runOrchestrator('profile', {
                action: 'profile',
                onboarding: onboardingData,
            }, 60000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Analyze (profile → market data + score + tasks) ━━━
        if (action === 'analyze') {
            if (!profile) {
                return NextResponse.json({ error: 'profile is required' }, { status: 400 });
            }

            const result = await runOrchestrator('analyze', {
                action: 'analyze',
                profile,
                region: region || 'br-pt',
                business_id: business_id || null,
                user_id: user_id || 'default_user',
            }, 300000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Assist (task → AI help) ━━━
        if (action === 'assist') {
            if (!task || !profile) {
                return NextResponse.json({ error: 'task and profile are required' }, { status: 400 });
            }

            const result = await runOrchestrator('assist', {
                action: 'assist',
                task,
                profile,
            }, 60000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Chat (conversational AI consultant) ━━━
        if (action === 'chat') {
            const result = await runOrchestrator('chat', {
                messages: messages || [],
                user_message: user_message || '',
                extracted_profile: extracted_profile || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Dimension Chat (per-dimension AI with search) ━━━
        if (action === 'dimension-chat') {
            const { dimension, userMessage: dimMessage, messages: dimMessages, context } = body;
            if (!dimension || !dimMessage) {
                return NextResponse.json({ error: 'dimension and userMessage are required' }, { status: 400 });
            }

            const result = await runOrchestrator('dimension-chat', {
                dimension,
                userMessage: dimMessage,
                messages: dimMessages || [],
                context: context || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: List Businesses ━━━
        if (action === 'list-businesses') {
            const result = await runOrchestrator('list-businesses', {
                user_id: user_id || 'default_user',
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Get Business ━━━
        if (action === 'get-business') {
            if (!business_id) {
                return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
            }

            const result = await runOrchestrator('get-business', {
                business_id,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Create Business ━━━
        if (action === 'create-business') {
            if (!profile) {
                return NextResponse.json({ error: 'profile is required' }, { status: 400 });
            }

            const result = await runOrchestrator('create-business', {
                user_id: user_id || 'default_user',
                profile,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Save Analysis ━━━
        if (action === 'save-analysis') {
            const { score, taskPlan, marketData } = body;
            if (!business_id || !score || !taskPlan || !marketData) {
                return NextResponse.json({ error: 'business_id, score, taskPlan, and marketData are required' }, { status: 400 });
            }

            const result = await runOrchestrator('save-analysis', {
                business_id,
                score,
                taskPlan,
                marketData,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Register ━━━
        if (action === 'register') {
            const { email, password, name } = body;
            if (!email || !password) {
                return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
            }

            const result = await runOrchestrator('register', {
                email,
                password,
                name: name || null,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Login ━━━
        if (action === 'login') {
            const { email, password } = body;
            if (!email || !password) {
                return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
            }

            const result = await runOrchestrator('login', {
                email,
                password,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Logout ━━━
        if (action === 'logout') {
            const { token } = body;

            const result = await runOrchestrator('logout', {
                token: token || null,
            }, 10000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Validate Session ━━━
        if (action === 'validate-session') {
            const { token } = body;
            if (!token) {
                return NextResponse.json({ error: 'token is required' }, { status: 400 });
            }

            const result = await runOrchestrator('validate-session', {
                token,
            }, 10000);

            return NextResponse.json(result);
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

    } catch (error: any) {
        console.error('Growth API Error:', error.message || error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
