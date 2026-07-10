import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

import { createDraftBillingRunForCycle } from "@/server/billing/modules/due-account/create-draft-billing-run";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if ( ! connectionString ) {
    throw new Error("Connection string missing.");
}

const BILLING_CYCLE_ID = "f5d730b4-c5e1-443d-a7b0-52a62d8923c0";   // ← change this

async function main() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        await client.query("BEGIN");

        const run = await createDraftBillingRunForCycle(
            client,
            BILLING_CYCLE_ID,
        );

        await client.query("COMMIT");

        console.table({
            id:        run.billing_run_id,
            periodStart: run.period_start,   // snake-case key from PG
            periodEnd:   run.period_end
        });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        await client.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});