import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { exec, spawn } from 'child_process';
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
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', GLOBAL_AI_MODEL: inputData.aiModel || 'groq' };

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
        const markerMap: Record<string, string> = {
            'analyze': '--- GROWTH_RESULT ---',
            'assist': '--- ASSIST_RESULT ---',
            'chat': '--- CHAT_RESULT ---',
            'dimension-chat': '--- DIMENSION_CHAT_RESULT ---',
            'pillar-plan': '--- PILLAR_PLAN_RESULT ---',
            'approve-plan': '--- APPROVE_PLAN_RESULT ---',
            'track-result': '--- TRACK_RESULT_RESULT ---',
            'pillar-state': '--- PILLAR_STATE_RESULT ---',
            'specialist-tasks': '--- SPECIALIST_TASKS_RESULT ---',
            'specialist-execute': '--- SPECIALIST_EXECUTE_RESULT ---',
            'all-pillars-state': '--- ALL_PILLARS_STATE_RESULT ---',
            'expand-subtasks': '--- EXPAND_SUBTASKS_RESULT ---',
            'ai-try-user-task': '--- AI_TRY_USER_TASK_RESULT ---',
            'macro-plan': '--- MACRO_PLAN_RESULT ---',
            'expand-task': '--- EXPAND_TASK_RESULT ---',
            'task-chat': '--- TASK_CHAT_RESULT ---',
            'list-businesses': '--- LIST_BUSINESSES_RESULT ---',
            'get-business': '--- GET_BUSINESS_RESULT ---',
            'create-business': '--- CREATE_BUSINESS_RESULT ---',
            'save-analysis': '--- SAVE_ANALYSIS_RESULT ---',
            'register': '--- REGISTER_RESULT ---',
            'login': '--- LOGIN_RESULT ---',
            'logout': '--- LOGOUT_RESULT ---',
            'validate-session': '--- VALIDATE_SESSION_RESULT ---',
            'delete-business': '--- DELETE_BUSINESS_RESULT ---',
            'run-pillar': '--- RUN_PILLAR_RESULT ---',
            'pillar-status': '--- PILLAR_STATUS_RESULT ---',
            'get-pillar-data': '--- GET_PILLAR_DATA_RESULT ---',
            'stop-task': '--- STOP_TASK_RESULT ---',
            'redo-task': '--- REDO_TASK_RESULT ---',
            'redo-subtasks': '--- REDO_SUBTASKS_RESULT ---',
        };
        const marker = markerMap[action] || null;

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

/**
 * Run the analyze action with real-time SSE streaming.
 * Emits: { type: 'thought', text } for THOUGHT: lines
 *        { type: 'result', data } for the final JSON result
 *        { type: 'error', message } on failure
 */
function runOrchestratorStreaming(inputData: any, timeoutMs: number = 480000): ReadableStream {
    const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
    const scriptPath = path.join(process.cwd(), 'backend', 'src', 'search_summarizer', 'growth_orchestrator.py');
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', GLOBAL_AI_MODEL: inputData.aiModel || 'groq' };
    const tmpPath = writeTempInput(inputData);

    return new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const send = (obj: object) => {
                try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* stream closed */ }
            };

            const child = spawn(pythonCommand, [scriptPath, '--action', 'analyze', '--input-file', tmpPath], {
                env,
                windowsHide: true,
            });

            // Single accumulator for full stdout — used both for streaming thoughts and parsing result
            let fullStdout = '';
            let lineBuffer = '';

            child.stdout.setEncoding('utf-8');
            child.stdout.on('data', (chunk: string) => {
                fullStdout += chunk;
                lineBuffer += chunk;

                // Emit THOUGHT lines as they arrive
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('THOUGHT: ')) {
                        send({ type: 'thought', text: trimmed.slice(9) });
                    }
                }
            });

            child.stderr.setEncoding('utf-8');
            child.stderr.on('data', (chunk: string) => {
                console.log(`[Growth SSE] stderr: ${chunk}`);
            });

            const timer = setTimeout(() => {
                child.kill();
                send({ type: 'error', message: 'Analysis timed out' });
                try { controller.close(); } catch { /* ignore */ }
            }, timeoutMs);

            child.on('error', (err) => {
                clearTimeout(timer);
                try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
                send({ type: 'error', message: err.message });
                try { controller.close(); } catch { /* ignore */ }
            });

            child.on('close', () => {
                clearTimeout(timer);
                try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

                // Flush any remaining line in buffer
                if (lineBuffer.trim().startsWith('THOUGHT: ')) {
                    send({ type: 'thought', text: lineBuffer.trim().slice(9) });
                }

                // Parse and emit final result
                const marker = '--- GROWTH_RESULT ---';
                const markerIdx = fullStdout.indexOf(marker);
                if (markerIdx !== -1) {
                    try {
                        const jsonStr = fullStdout.substring(markerIdx + marker.length).trim();
                        const result = JSON.parse(jsonStr);
                        send({ type: 'result', data: result });
                    } catch (e: any) {
                        send({ type: 'error', message: `Failed to parse result: ${e.message}` });
                    }
                } else {
                    send({ type: 'error', message: 'No result found in output' });
                }

                try { controller.close(); } catch { /* ignore */ }
            });
        },
    });
}

// ─────────────────────────────────────────────
// Growth Mode API
// ─────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, onboardingData, task, profile, region, messages, user_message, extracted_profile, user_id, business_id, aiModel } = body;

        // ━━━ Action: Profile (onboarding → profile) ━━━
        if (action === 'profile') {
            if (!onboardingData) {
                return NextResponse.json({ error: 'onboardingData is required' }, { status: 400 });
            }

            const result = await runOrchestrator('profile', {
                aiModel,
                action: 'profile',
                onboarding: onboardingData,
            }, 60000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Analyze (profile → market data + score + tasks) — SSE streaming ━━━
        if (action === 'analyze') {
            if (!profile) {
                return NextResponse.json({ error: 'profile is required' }, { status: 400 });
            }

            const stream = runOrchestratorStreaming({
                aiModel,
                action: 'analyze',
                profile,
                region: region || 'br-pt',
                business_id: business_id || null,
                user_id: user_id || 'default_user',
            }, 600000);

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // ━━━ Action: Assist (task → AI help) ━━━
        if (action === 'assist') {
            if (!task || !profile) {
                return NextResponse.json({ error: 'task and profile are required' }, { status: 400 });
            }

            const result = await runOrchestrator('assist', {
                aiModel,
                action: 'assist',
                task,
                profile,
            }, 60000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Chat (conversational AI consultant) ━━━
        if (action === 'chat') {
            const result = await runOrchestrator('chat', {
                aiModel,
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
                aiModel,
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
                aiModel,
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
                aiModel,
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
                aiModel,
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
                aiModel,
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
                aiModel,
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
                aiModel,
                email,
                password,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Logout ━━━
        if (action === 'logout') {
            const { token } = body;

            const result = await runOrchestrator('logout', {
                aiModel,
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
                aiModel,
                token,
            }, 10000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Pillar Plan (specialist generates professional plan) ━━━
        if (action === 'pillar-plan') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('pillar-plan', {
                aiModel,
                analysis_id,
                pillar_key,
                business_id: body.business_id || null,
                profile: profile || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Approve Plan (user validates specialist plan) ━━━
        if (action === 'approve-plan') {
            const { analysis_id, pillar_key, user_notes } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('approve-plan', {
                aiModel,
                analysis_id,
                pillar_key,
                user_notes: user_notes || '',
            }, 10000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Track Result (record completed action + outcome) ━━━
        if (action === 'track-result') {
            const { analysis_id, pillar_key, task_id, action_title, outcome, business_impact } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('track-result', {
                aiModel,
                analysis_id,
                pillar_key,
                task_id,
                action_title: action_title || '',
                outcome: outcome || '',
                business_impact: business_impact || '',
            }, 10000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Pillar State (full pillar state: diag + plan + results + KPIs) ━━━
        if (action === 'pillar-state') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('pillar-state', {
                aiModel,
                analysis_id,
                pillar_key,
            }, 10000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Specialist Tasks (generate tasks with AI/user classification) ━━━
        if (action === 'specialist-tasks') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('specialist-tasks', {
                aiModel,
                analysis_id,
                pillar_key,
                business_id: body.business_id || null,
                profile: profile || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Specialist Execute (AI agent executes a task) ━━━
        if (action === 'specialist-execute') {
            const { analysis_id, pillar_key, task_id, task_data } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('specialist-execute', {
                aiModel,
                analysis_id,
                pillar_key,
                task_id,
                task_data: task_data || {},
                business_id: body.business_id || null,
                profile: profile || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Expand Subtasks (break task into micro-steps) ━━━
        if (action === 'expand-subtasks') {
            const { analysis_id, pillar_key, task_data } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('expand-subtasks', {
                aiModel,
                analysis_id,
                pillar_key,
                task_data: task_data || {},
                profile: profile || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: AI Try User Task (AI attempts user-classified task) ━━━
        if (action === 'ai-try-user-task') {
            const { analysis_id, pillar_key, task_id, task_data } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('ai-try-user-task', {
                aiModel,
                analysis_id,
                pillar_key,
                task_id,
                task_data: task_data || {},
                profile: profile || {},
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: All Pillars State (unified dashboard data) ━━━
        if (action === 'all-pillars-state') {
            const { analysis_id } = body;
            if (!analysis_id) {
                return NextResponse.json({ error: 'analysis_id is required' }, { status: 400 });
            }

            const result = await runOrchestrator('all-pillars-state', {
                aiModel,
                analysis_id,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Macro Plan (generate execution plan skeleton) ━━━
        if (action === 'macro-plan') {
            const { score, meta, discovery_data, analysis_id } = body;
            if (!profile || !score) {
                return NextResponse.json({ error: 'profile and score are required' }, { status: 400 });
            }

            const result = await runOrchestrator('macro-plan', {
                aiModel,
                profile,
                score,
                meta: meta || '',
                discovery_data: discovery_data || null,
                analysis_id: analysis_id || null,
            }, 120000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Expand Task (JIT micro-planning with RAG) ━━━
        if (action === 'expand-task') {
            const { task_id, task_title, categoria, plan_context, plan_id } = body;
            if (!task_id || !task_title) {
                return NextResponse.json({ error: 'task_id and task_title are required' }, { status: 400 });
            }

            const result = await runOrchestrator('expand-task', {
                aiModel,
                task_id,
                task_title,
                categoria: categoria || '',
                profile: profile || {},
                plan_context: plan_context || {},
                plan_id: plan_id || null,
            }, 60000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Task Chat (task-scoped execution chat) ━━━
        if (action === 'task-chat') {
            const { task_id, task_title, user_message: taskMsg, messages: taskMessages, task_detail, plan_context, plan_id } = body;
            if (!task_id || !taskMsg) {
                return NextResponse.json({ error: 'task_id and user_message are required' }, { status: 400 });
            }

            const result = await runOrchestrator('task-chat', {
                aiModel,
                task_id,
                task_title: task_title || '',
                user_message: taskMsg,
                messages: taskMessages || [],
                profile: profile || {},
                task_detail: task_detail || {},
                plan_context: plan_context || {},
                plan_id: plan_id || null,
            }, 60000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Delete Business ━━━
        if (action === 'delete-business') {
            if (!business_id) {
                return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
            }

            const result = await runOrchestrator('delete-business', {
                aiModel,
                business_id,
            }, 30000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Run Pillar Agent ━━━
        if (action === 'run-pillar') {
            const { pillar_key, user_command } = body;
            if (!pillar_key || !business_id) {
                return NextResponse.json({ error: 'pillar_key and business_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('run-pillar', {
                pillar_key,
                business_id,
                profile: profile || {},
                user_command: user_command || '',
            }, 180000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Pillar Status ━━━
        if (action === 'pillar-status') {
            if (!business_id) {
                return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
            }

            const result = await runOrchestrator('pillar-status', {
                business_id,
            }, 15000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Get Pillar Data ━━━
        if (action === 'get-pillar-data') {
            const { pillar_key } = body;
            if (!pillar_key || !business_id) {
                return NextResponse.json({ error: 'pillar_key and business_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('get-pillar-data', {
                pillar_key,
                business_id,
            }, 15000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Stop Task ━━━
        if (action === 'stop-task') {
            // Frontend handles abort via AbortController, backend just acknowledges
            const result = await runOrchestrator('stop-task', {}, 5000);
            return NextResponse.json(result);
        }

        // ━━━ Action: Redo Task ━━━
        if (action === 'redo-task') {
            const { analysis_id, pillar_key, task_id } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, and task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('redo-task', {
                analysis_id,
                pillar_key,
                task_id,
            }, 15000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Redo Subtasks ━━━
        if (action === 'redo-subtasks') {
            const { analysis_id, pillar_key, task_id } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, and task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('redo-subtasks', {
                analysis_id,
                pillar_key,
                task_id,
            }, 15000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Redo Pillar ━━━
        if (action === 'redo-pillar') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('redo-pillar', {
                analysis_id,
                pillar_key,
            }, 15000);

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
