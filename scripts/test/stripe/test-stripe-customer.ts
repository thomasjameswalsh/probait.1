import { loadEnvConfig } from "@next/env";
import { getOrCreateStripeCustomerId } from "@/server/stripe/get-stripe-customer-id";
import { pool } from "@/lib/db/pool";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
    try {
        const customerId = await getOrCreateStripeCustomerId(
            "ea51dd9b-2926-4636-9c3b-bcdd9ac8a14e",
        );

        console.log("Stripe Customer ID", customerId);
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});