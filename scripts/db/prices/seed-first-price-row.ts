import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";


import { 
    type PriceAmounts,
    type StripePriceIds,
    createStripePriceVersion
 } from "./create-stripe-price-version";
import { withTransaction } from "@/scripts/query-helpers";
import { create } from "node:domain";

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

        stripe_base_subscription_price_id,
        stripe_postcode_subscription_price_id,
        stripe_lead_price_id,
        stripe_lock_price_id,
        stripe_lead_and_lock_price_id,

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


loadEnvConfig(process.cwd());


const consoleInput = createInterface({
    input: stdin,
    output: stdout
});


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
            minor_value: 24000
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
                  priceAmounts.leadMinor
                ),
              };
        }
    }

    return priceAmounts;
}


async function main() {
    const connectionString: string | undefined = process.env.DATABASE_URL_UNPOOLED;
    if ( connectionString == undefined ) {
        throw new Error("Missing env var DATABASE_URL_UNPOOLED");
    }

    const client = new Client({
        connectionString,
    });

    const isEmpty = await client.query<{ is_empty: boolean }>(QUERY_PRICES_IS_EMPTY);
    if ( ! isEmpty.rows[0].is_empty ) {
        throw new Error("Prices table is not empty, cannot seed first price version.");
    }

    const priceAmounts: PriceAmounts = await getPriceAmounts();
    const version: number = 1;
    const stripePriceIds: StripePriceIds = await createStripePriceVersion(version, priceAmounts);

    const effectiveAt = new Date();

    const insertPriceRow = async () => {
        await client.query(
            QUERY_PRICES_INSERT_PRICE_VERSION_1,
            [...Object.values(priceAmounts), ...Object.values(stripePriceIds)]
        );
    }
    withTransaction(client, insertPriceRow);
}

