import { runOrchestrator } from './src/lib/orchestrator';

async function test() {
    try {
        console.log("Testing get-business...");
        const result = await runOrchestrator('get-business', {
            aiModel: 'groq',
            business_id: '9e311fd2-cfe5-4a2a-9700-2cfafc915256'
        });
        console.log("Result success:", result?.success);
        console.log("Result has business:", !!result?.business);
        if (!result?.business) {
            console.log("Full result:", JSON.stringify(result, null, 2));
        } else {
            console.log("Business name:", result.business.name);
            console.log("Latest analysis:", !!result.business.latest_analysis);
        }
    } catch (err: any) {
        console.error("Error occurred:", err.message);
    }
}

test();
