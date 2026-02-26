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
export function writeTempInput(data: any): string {
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
export async function runOrchestrator(action: string, inputData: any, timeoutMs: number = 300000): Promise<any> {
    const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
    const scriptPath = path.join(process.cwd(), 'backend', 'src', 'search_summarizer', 'growth_orchestrator.py');
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', GLOBAL_AI_MODEL: inputData.aiModel || 'groq' };

    // Write input to temp file
    const tmpPath = writeTempInput(inputData);

    try {
        const cmd = `${pythonCommand} "${scriptPath}" --action ${action} --input-file "${tmpPath}"`;
        console.log(`[Growth Orchestrator Server] Running: ${action} (timeout: ${timeoutMs}ms)`);

        const { stdout, stderr } = await execPromise(cmd, {
            env,
            timeout: timeoutMs,
            maxBuffer: 20 * 1024 * 1024,
        });

        if (stderr) {
            console.log(`[Growth Orchestrator Server] stderr: ${stderr}`);
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
export function runOrchestratorStreaming(inputData: any, timeoutMs: number = 480000): ReadableStream {
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

            // Single accumulator for full stdout
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
