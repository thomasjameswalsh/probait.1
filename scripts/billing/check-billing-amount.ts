import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { calculateBillingAmountForCycle } from "@/server/billing/calculate-billing-amount";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if ( !connectionString ) {
    throw new Error("DATABASE_URL_UNPOOLED is missing.");
}

const client = new Client({ connectionString });

async function main() {
    const billingCycleId = process.argv[2];

    if ( !billingCycleId ) {
        throw new Error(
            "Usage: npx tsx scripts/check-billing-amount.ts <billing-cycle-id>"
        );
    }

    await client.connect();

    try {
        const result = await calculateBillingAmountForCycle(
            client,
            billingCycleId
        );

        console.log(result);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});