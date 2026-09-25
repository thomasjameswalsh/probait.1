import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Run scripts using env var with flag
// npx tsx --env-file=.env.local scripts/db/prices/init-stripe-products.ts

import type { PriceRow, PriceAmounts, StripePriceIds } from "./types/price-types";

import { 
    createStripePriceVersion
 } from "./create-stripe-price-version";
import { showPrices, readPriceAmounts, printPriceRow } from "./price-console";
import { requireOneRow, withTransaction } from "@/lib/db/query-helpers";

const QUERY_PRICES_IS_EMPTY = 
    `
    SELECT NOT EXISTS (
        SELECT 1
        FROM prices
    ) AS is_empty;
    `;

const QUERY_PRICES_INSERT_PRICE_VERSION_1 = 
    `
    INSERT INTO prices (
        version,
        active,
        effective_from,

        base_subscription_minor,
        postcode_subscription_minor,
        lead_minor,
        lock_minor,
        lead_and_lock_minor,

        base_subscription_stripe_price_id,
        postcode_subscription_stripe_price_id,
        lead_stripe_price_id,
        lock_stripe_price_id,
        lead_and_lock_stripe_price_id,

        currency
    ) VALUES (
        1,
        true,
        now(),
        
        $1, $2, $3, $4, $5,

        $6, $7, $8, $9, $10,

        'GBP'
    );
    `;

const QUERY_GET_INSERTED_PRICE_VERSION = 
    `
    SELECT *
    FROM prices
    WHERE active = true AND version = 1;
    `;


loadEnvConfig(process.cwd());


const consoleInput = createInterface({
    input: stdin,
    output: stdout
});


async function checkPricesTableEmpty(client: Client): Promise<boolean> {
    const isEmpty = await client.query<{ is_empty: boolean }>(QUERY_PRICES_IS_EMPTY);
    return isEmpty.rows[0].is_empty;
}


async function getPriceAmounts(): Promise<PriceAmounts> {
    let priceAmounts: PriceAmounts = {
        baseSubscriptionMinor: 3200,
        postcodeSubscriptionMinor: 2400,
        leadMinor: 1600,
        lockMinor: 1200,
        leadAndLockMinor: 2400
    };
    showPrices("Default Prices", -1, priceAmounts);

    while ( true ) {
        const useDefaults = 
            (await consoleInput.question("Proceed with defaults? y/n: ")).trim();
        if ( useDefaults == "y" ) {
            break;
        } 
        
        if ( useDefaults == "n" ) {
            priceAmounts = await readPriceAmounts(consoleInput, priceAmounts);
            break;
        }
    }

    return priceAmounts;
}


async function seedFirstPriceVersion(client: Client): Promise<void> {
    if ( ! await checkPricesTableEmpty(client) ) {
        throw new Error("Prices table is not empty, cannot seed first price version.");
    }

    const priceAmounts: PriceAmounts = await getPriceAmounts();
    const version: number = 1;
    const stripePriceIds: StripePriceIds = await createStripePriceVersion(version, priceAmounts);

    const insertPriceRow = async () => {
        const params = 
        [
            priceAmounts.baseSubscriptionMinor,
            priceAmounts.postcodeSubscriptionMinor,
            priceAmounts.leadMinor,
            priceAmounts.lockMinor,
            priceAmounts.leadAndLockMinor,

            stripePriceIds.baseSubscriptionPriceId,
            stripePriceIds.postcodeSubscriptionPriceId,
            stripePriceIds.leadPriceId,
            stripePriceIds.lockPriceId,
            stripePriceIds.leadAndLockPriceId
        ];

        await client.query(
            QUERY_PRICES_INSERT_PRICE_VERSION_1,
            params
        );
    }

    await withTransaction(client, insertPriceRow);

    console.log("Price version created.");
}


async function getInsertedPriceVersion(client: Client) {
    console.log("VALIDATE: Query DB for price version 1...");

    if ( await checkPricesTableEmpty(client) ) {
        throw new Error("Prices table is STILL empty, inserting price row failed.");
    }

    const insertedRowResult = await client.query<PriceRow>(
        QUERY_GET_INSERTED_PRICE_VERSION
    );
    const insertedRow = requireOneRow(insertedRowResult, "Price row with version = 1 and active = true not found.");
    printPriceRow(insertedRow, "Success. Printing inserted price row...");
}


async function main() {
    const connectionString: string | undefined = process.env.DATABASE_URL_UNPOOLED;
    if ( connectionString == undefined ) {
        throw new Error("Missing env var DATABASE_URL_UNPOOLED");
    }

    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        await seedFirstPriceVersion(client);
        await getInsertedPriceVersion(client);
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
    consoleInput.close();
  });