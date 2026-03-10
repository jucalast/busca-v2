import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { runOrchestrator, runOrchestratorStreaming } from '@/lib/api/client';

import { auth } from '@/auth';

// ─────────────────────────────────────────────
// Growth Mode API
// ─────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const session = await auth();
        const jwtToken = session?.jwtToken || null;

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
                onboardingData,
            }, 60000, jwtToken);

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
            }, 600000, jwtToken);

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
            }, 60000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Chat (conversational AI consultant) — SSE streaming ━━━
        if (action === 'chat') {
            const stream = runOrchestratorStreaming({
                aiModel,
                action: 'chat',
                messages: messages || [],
                user_message: user_message || body.message || '',
                extracted_profile: extracted_profile || {},
            }, 120000, jwtToken);

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
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
            }, 30000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 30000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Logout ━━━
        if (action === 'logout') {
            const { token } = body;

            const result = await runOrchestrator('logout', {
                aiModel,
                token: token || null,
            }, 10000, jwtToken);

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
            }, 10000, jwtToken);

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
            }, 10000, jwtToken);

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
            }, 10000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 120000, jwtToken);

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
            }, 30000, jwtToken);

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
            }, 15000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Get Analysis Tasks ━━━
        if (action === 'get-analysis-tasks') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('get-analysis-tasks', {
                analysis_id,
                pillar_key,
            }, 15000, jwtToken);

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
            }, 15000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Stop Task ━━━
        if (action === 'stop-task') {
            // Frontend handles abort via AbortController, backend just acknowledges
            const result = await runOrchestrator('stop-task', {}, 5000, jwtToken);
            return NextResponse.json(result);
        }

        // ━━━ Action: Cancel Task ━━━
        if (action === 'cancel-task') {
            const { analysis_id, pillar_key, task_id } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, and task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('cancel-task', {
                analysis_id,
                pillar_key,
                task_id,
            }, 10000, jwtToken);

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
            }, 15000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Redo Subtasks ━━━
        if (action === 'redo-subtasks') {
            const { analysis_id, pillar_key, task_id } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, and task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('redo-subtasks', {
                aiModel,
                analysis_id,
                pillar_key,
                task_id,
            }, 15000, jwtToken);

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
            }, 15000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Get Subtasks ━━━
        if (action === 'get-subtasks') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('get-subtasks', {
                analysis_id,
                pillar_key,
            }, 15000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Get Pillar Executions ━━━
        if (action === 'get-pillar-executions') {
            const { analysis_id, pillar_key } = body;
            if (!analysis_id || !pillar_key) {
                return NextResponse.json({ error: 'analysis_id and pillar_key are required' }, { status: 400 });
            }

            const result = await runOrchestrator('get-pillar-executions', {
                analysis_id,
                pillar_key,
            }, 15000, jwtToken);

            return NextResponse.json(result);
        }

        // ━━━ Action: Execute All Subtasks (Background) ━━━
        if (action === 'execute-all-subtasks') {
            const { analysis_id, pillar_key, task_id, task_data } = body;
            if (!analysis_id || !pillar_key || !task_id) {
                return NextResponse.json({ error: 'analysis_id, pillar_key, and task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('execute-all-subtasks', {
                aiModel,
                analysis_id,
                pillar_key,
                task_id,
                task_data: task_data || {},
                profile: profile || {},
            }, 10000);

            return NextResponse.json(result);
        }

        // ━━━ Action: Poll Background Status ━━━
        if (action === 'poll-background-status') {
            const { analysis_id, task_id } = body;
            if (!analysis_id || !task_id) {
                return NextResponse.json({ error: 'analysis_id and task_id are required' }, { status: 400 });
            }

            const result = await runOrchestrator('poll-background-status', {
                analysis_id,
                task_id,
            }, 5000, jwtToken);

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
