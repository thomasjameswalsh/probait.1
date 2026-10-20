// node --conditions=react-server --import tsx scripts/test/stripe/test-start-business-subscription.ts
import { pool } from "@/lib/db/pool";

async function main(): Promise<void> {
    try {
        const { startBusinessSubscription } = await import(
            "@/server/billing/start-business-subscription"
        );

        const url = await startBusinessSubscription(
            "ea51dd9b-2926-4636-9c3b-bcdd9ac8a14e",
        );

        console.log("Checkout url: ", url);
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});