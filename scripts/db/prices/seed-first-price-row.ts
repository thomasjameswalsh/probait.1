import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Run scripts using env var with flag
// npx tsx --env-file=.env.local scripts/db/prices/init-stripe-products.ts

import { 
    type PriceAmounts,
    type StripePriceIds,
    createStripePriceVersion
 } from "./create-stripe-price-version";
import { requireOneRow, withTransaction } from "@/scripts/query-helpers";

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
    SELECT 
        version,
        effective_from,

        base_subscription_minor,
        postcode_subscription_minor,
        lead_minor,
        lock_minor,
        lead_and_lock_minor
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


async function readMinorAmount(
  name: string,
  currentValue: number
): Promise<number> {
  while ( true ) {
    const answer = (
      await consoleInput.question(
        `${name} [current value ${currentValue}]: `
      )).trim();

      if ( answer.toLowerCase() == "x" ) {
        console.log(`(x) Using current value ${currentValue} for ${name}`);
        return currentValue;
      } 

      if ( answer == "" ) {
        console.log("Please enter a value; or, enter ' x ' to use current value.");
        continue;
      }
      const value = Number(answer);
      if ( Number.isSafeInteger(value) && value >= 0 ) {
        return value;
      }

      console.log("Enter a non-negative whole number.");
  }
}


async function getPriceAmounts(): Promise<PriceAmounts> {
    let priceAmounts: PriceAmounts = {
        baseSubscriptionMinor: 3200,
        postcodeSubscriptionMinor: 2400,
        leadMinor: 1200,
        lockMinor: 1600,
        leadAndLockMinor: 2400
    };

    console.log("Default price values table:")
    console.table([
        {
            price: "Base Subscription",
            minor_value: 3200     
        },
        {
            price: "Postcode Subscription",
            minor_value: 2400
        },
        {
            price: "Lead Purchase",
            minor_value: 1600 
        },
        {
            price: "Lock Purchase",
            minor_value: 1200
        },
        {
            price: "Lead and lock",
            minor_value: 2400
        }
    ]);

    while ( true ) {
        const useDefaults = 
            (await consoleInput.question("Proceed with defaults? y/n")).trim();
        if ( useDefaults == "y" ) {
            break;
        } else if ( useDefaults == "n" ) {
            priceAmounts = {
                baseSubscriptionMinor: await readMinorAmount(
                  "Base Subscription Minor",
                  priceAmounts.baseSubscriptionMinor
                ),
            
                postcodeSubscriptionMinor: await readMinorAmount(
                  "Postcode Subscription Minor",
                  priceAmounts.postcodeSubscriptionMinor
                ),
            
                leadMinor: await readMinorAmount(
                  "Lead Minor",
                  priceAmounts.leadMinor
                ),
            
                lockMinor: await readMinorAmount(
                  "Lock Minor",
                  priceAmounts.lockMinor
                ),
            
                leadAndLockMinor: await readMinorAmount(
                  "Lead-and-lock Minor",
                  priceAmounts.leadAndLockMinor
                ),
              };
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

    type PriceVersionRow = {
        version: number,
        effective_from: Date,
        base_subscription_minor: number,
        postcode_subscription_minor: number,
        lead_minor: number,
        lock_minor: number,
        lead_and_lock_minor: number
    };

    if ( await checkPricesTableEmpty(client) ) {
        throw new Error("Prices table is STILL empty, inserting price row failed.");
    }

    const insertedRowResult = await client.query<PriceVersionRow>(
        QUERY_GET_INSERTED_PRICE_VERSION
    );
    const insertedRow = requireOneRow(insertedRowResult, "Price row with version = 1 and active = true not found.");

    console.log("Price version 1 found. Printing row:")
    console.table([
        {
            version: insertedRow.version,
            effectiveFrom: insertedRow.effective_from,
            base_subscription: insertedRow.base_subscription_minor,
            postcode_subscription: insertedRow.postcode_subscription_minor,
            lead: insertedRow.lead_minor,
            lock: insertedRow.lock_minor,
            lead_and_lock: insertedRow.lead_and_lock_minor
        }
    ]);

    console.log("SUCCESS.");
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