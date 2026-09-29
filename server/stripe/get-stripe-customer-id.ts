import "server-only";

import { pool } from "@/lib/db/db";
import { stripe } from "@/server/stripe/client";

import { requireOneRow } from "@/lib/db/query-helpers";


type BusinessAccountRow = {
    id: string,
    stripe_customer_id: string | null
};


const QUERY_SET_LOCK_TIMEOUT = 
    `
    SET LOCAL lock_timeout = '5s'
    `;

const QUERY_SELECT_BUSINESS_ACCOUNT =
    `
    SELECT id, stripe_customer_id
    FROM business_accounts
    WHERE id = $1
    FOR UPDATE;
    `;

const QUERY_UPDATE_STRIPE_CUSTOMER_ID =
    `
    UPDATE business_accounts
    SET stripe_customer_id = $1
    WHERE id = $2
        AND stripe_customer_id IS NULL
    RETURNING id;
    `;


export async function getOrCreateStripeCustomerId(
    businessAccountId: string
): Promise<string> {
    const client = await pool.connect();
    let discardConnection = false;

    try {
        await client.query("BEGIN");
        await client.query(QUERY_SET_LOCK_TIMEOUT);

        const businessQueryResult = await client.query<BusinessAccountRow>(
            QUERY_SELECT_BUSINESS_ACCOUNT,
            [businessAccountId]
        );
        const businessAccountRow: BusinessAccountRow = requireOneRow(businessQueryResult, "Get business account stripe customer id");

        if ( businessAccountRow.stripe_customer_id ) {
            await client.query("COMMIT");
            return businessAccountRow.stripe_customer_id;
        }

        const stripeCustomer = await stripe.customers.create(
            {
                metadata: {
                    business_account_id: businessAccountRow.id,
                },
            },
            {
                idempotencyKey: `business-customer:${businessAccountRow.id}`,
                timeout: 10_000,
                maxNetworkRetries: 1,
            }
        );

        const updateResult = await client.query(
            QUERY_UPDATE_STRIPE_CUSTOMER_ID,
            [stripeCustomer.id, businessAccountRow.id]
        );
        requireOneRow(updateResult, "Could not save new Stripe Customer ID");
        
        await client.query("COMMIT");

        return stripeCustomer.id;

    } catch ( error ) {
        try {
            await client.query("ROLLBACK");
        } catch {
            discardConnection = true;
        }

        throw error;
    } finally {
        client.release(discardConnection);
    }
}