// Purpose: put one completely fake business into the DB with
// 1 active price row
// 1 business account
// 1 postcode district subscription
// 1 active billing cycle
// 1 active postcode subscription

import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

///////////////////////////////////////////////////////////////////////

const QUERY_DEACTIVATE_OLD_PRICE_ROWS =
    `
    UPDATE prices
    SET active = false;
    `;

const QUERY_INSERT_FIRST_PRICE_ROW =
    `
    INSERT INTO prices ( version ) VALUES ( 1 )
    ON CONFLICT ( version ) DO UPDATE
    SET active = true;
    `;

const QUERY_INSERT_DUMMY_BUSINESS_ACCOUNT =
    `
    INSERT INTO business_accounts (
        clerk_user_id,
        business_name,
        contact_forenames,
        contact_surname,
        notification_email
    )
    VALUES (
        'dev_clerk_user_001',
        'Dev Test Business',
        'Alicia',
        'Keys',
        'dev@example.com'
    )
    ON CONFLICT (clerk_user_id) DO UPDATE
    SET business_name = 'Dev Test Business'
    RETURNING id;
    `;

const QUERY_INSERT_DUMMY_BUSINESS_BILLING_CYCLE =
    `
    INSERT INTO business_billing_cycles (
        business_account_id,   
        billing_state,
        billing_anchor_day,
        current_period_start,
        current_period_end
    ) VALUES (
        $1,
        'ACTIVE',
        EXTRACT(DAY FROM now())::integer,
        now(),
        now() + interval '1 month'
    )
    ON CONFLICT (business_account_id) DO UPDATE
    SET billing_state = 'ACTIVE'
    RETURNING id;
    `;

const QUERY_INSERT_DUMMY_POSTCODE_SUBSCRIPTION =
    `
    INSERT INTO postcode_subscriptions (
        business_account_id,
        district_norm,
        started_at
    )
    VALUES (
        $1,
        'CM21',
        now()
    )
    ON CONFLICT DO NOTHING;
    `;

///////////////////////////////////////////////////////////////////////

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if ( ! connectionString ) {
    throw new Error("Missing unpooled connection string");
}

const client = new Client({
    connectionString: connectionString,
});

async function main() {
    await client.connect();

    try {
        await client.query('BEGIN');

        await client.query(QUERY_DEACTIVATE_OLD_PRICE_ROWS);
        await client.query(QUERY_INSERT_FIRST_PRICE_ROW);

        const businessAccountResult =
            await client.query<{id: string}>(QUERY_INSERT_DUMMY_BUSINESS_ACCOUNT);
        const businessAccountId = businessAccountResult.rows[0].id;

        const businessBillingCycleResult =
            await client.query<{id: string}>(
                QUERY_INSERT_DUMMY_BUSINESS_BILLING_CYCLE,
                [businessAccountId]);
        const businessBillingCycleId = businessBillingCycleResult.rows[0].id;

        await client.query(
            QUERY_INSERT_DUMMY_POSTCODE_SUBSCRIPTION,
            [businessAccountId]);

        await client.query('COMMIT');

        console.log("Dev seeded price row, business account, billing cycle, postcode sub.");
        console.log(`Business id: ${businessAccountId} \t Billing cycle id: ${businessBillingCycleId}`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});