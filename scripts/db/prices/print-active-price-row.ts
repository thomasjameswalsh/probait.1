import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { requireOneRow } from "@/scripts/query-helpers";

loadEnvConfig(process.cwd());


const QUERY_GET_ACTIVE_PRICE_VERSION =
    `
    SELECT * FROM prices
    WHERE active = true;
    `;


const QUERY_PRICES_IS_EMPTY = 
    `
    SELECT NOT EXISTS (
        SELECT 1
        FROM prices
    ) AS is_empty;
    `;


type PriceRow = {
    id: string;
    version: number;
    effective_from: Date;
    effective_to: Date | null;

    base_subscription_minor: number;
    postcode_subscription_minor: number;
    lead_minor: number;
    lock_minor: number;
    lead_and_lock_minor: number;

    base_subscription_stripe_price_id: string | null;
    postcode_subscription_stripe_price_id: string | null;
    lead_stripe_price_id: string | null;
    lock_stripe_price_id: string | null;
    lead_and_lock_stripe_price_id: string | null;
};


export async function printCurrentActivePriceVersion(client: Client) {
    const pricesIsEmpty = await client.query<{is_empty: boolean}>(QUERY_PRICES_IS_EMPTY);
    if ( pricesIsEmpty.rows[0].is_empty ) {
        console.log("Prices table is empty.");
        return;
    }

    const activePriceRowQueryResult = await client.query<PriceRow>(
        QUERY_GET_ACTIVE_PRICE_VERSION
    );
    const activePriceRow: PriceRow = requireOneRow(activePriceRowQueryResult, "Get active price row");
    
    console.log("Printing active price row:");
    console.table(
        [
            {
                id: activePriceRow.id,
                version: activePriceRow.version,
                effectiveFrom: activePriceRow.effective_from,
                effectiveTo: activePriceRow.effective_to,
                
                base_subscription: activePriceRow.base_subscription_minor,
                postcode_subscription: activePriceRow.postcode_subscription_minor,
                lead: activePriceRow.lead_minor,
                lock: activePriceRow.lock_minor,
                lead_and_lock: activePriceRow.lead_and_lock_minor,

                base_stripe_price_id: activePriceRow.base_subscription_stripe_price_id,
                postcode_stripe_price_id: activePriceRow.postcode_subscription_stripe_price_id,
                lead_stripe_price_id: activePriceRow.lead_stripe_price_id,
                lock_stripe_price_id: activePriceRow.lock_stripe_price_id,
                lead_and_lock_stripe_price_id: activePriceRow.lead_and_lock_stripe_price_id
            }
        ]
    );
}


async function main() {
    const connectionString = process.env.DATABASE_URL_UNPOOLED;

    if ( ! connectionString ) {
        throw new Error("DATABASE_URL_UNPOOLED is undefined.");
    }

    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        await printCurrentActivePriceVersion(client);
    } finally {
        await client.end();
    }
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : error,
    );

    process.exitCode = 1;
  })
  .finally(() => {
    console.log("Script finished. Exiting.");
  });