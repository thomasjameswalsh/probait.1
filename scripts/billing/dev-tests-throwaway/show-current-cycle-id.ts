import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if ( !connectionString ) {
    throw new Error("Unpooled connection string missing");
}

const conn = new Client({ connectionString: connectionString });

async function main() {
    await conn.connect();

    const res = await conn.query<{ id: string }>(`
        SELECT c.id
        FROM business_billing_cycles c
        JOIN business_accounts a ON a.id = c.business_account_id
        WHERE a.clerk_user_id = 'dev_clerk_user_001'
        LIMIT 1;
    `);

    console.log("Current billing_cycle_id:", res.rows[0]?.id ?? "NONE");
    await conn.end();
}

main().catch(e => { console.error(e); process.exitCode = 1; });