import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

loadEnvConfig(process.cwd());

const client = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED!,
});

async function main() {
    await client.connect();

    const res = await client.query("SELECT * FROM business_billing_runs;");

    console.table(res.rows);
    await client.end();
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});