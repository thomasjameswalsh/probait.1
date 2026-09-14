import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

import {
  type PriceAmounts,
  type StripePriceIds,
  createStripePriceVersion
} from "@scripts/db/prices/create-stripe-price-version";

import {
  printCurrentActivePriceVersion
} from "@scripts/db/prices/print-active-price-row";

import { requireOneRow, withTransaction } from "@/scripts/query-helpers";
import { act } from "react";


// Run scripts using env var with flag
// npx tsx --env-file=.env.local scripts/db/prices/init-stripe-products.ts


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


const QUERY_CURRENT_PRICE_ROW = 
  `
  SELECT *
  FROM prices
  WHERE active = true
  `;

const QUERY_LOCK_PRICE_ROW_FOR_UPDATE =
  `
  SELECT version
  FROM prices
  WHERE active = true
  FOR UPDATE;
  `;

const QUERY_UPDATE_PRICE_ROW_ACTIVE_FALSE = 
  `
  UPDATE prices
  SET
    active = false,
    effective_to = $1
  WHERE id = $2 AND version = $3;
  `;

const QUERY_INSERT_NEXT_PRICE_ROW =
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
  )
  VALUES (
    $1,
    true,
    $2,

    $3, $4, $5, $6, $7,

    $8, $9, $10, $11, $12,

    'GBP'
  );
  `;


const QUERY_GET_PRICE_VERSION = 
  `
  SELECT * FROM prices
  WHERE active = true AND version = $1;
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


function showPrices(
  title: string,
  version: number,
  amounts: PriceAmounts
): void {
  console.log(`\nPrices table - version ${version}`);

  console.table([
    {
      price: "Base Subscription (minor)",
      minor: amounts.baseSubscriptionMinor,
    },
    {
      price: "Postcode Subscription (minor)",
      minor: amounts.postcodeSubscriptionMinor,
    },
    {
      price: "Lead Price (minor)",
      minor: amounts.leadMinor,
    },
    {
      price: "Lock Price (minor)",
      minor: amounts.lockMinor,
    },
    {
      price: "Lead-and-lock Price (minor)",
      minor: amounts.leadAndLockMinor,
    }
  ]);
}


async function publishPriceVersion(client: Client): Promise<void> {
  const currentPriceRowQueryResult = await client.query<PriceRow>(QUERY_CURRENT_PRICE_ROW);
  const currentPriceRow: PriceRow = requireOneRow(currentPriceRowQueryResult, "Current active price row");

  const currentAmounts: PriceAmounts = {
    baseSubscriptionMinor: currentPriceRow.base_subscription_minor,
    postcodeSubscriptionMinor: currentPriceRow.postcode_subscription_minor,
    leadMinor: currentPriceRow.lead_minor,
    lockMinor: currentPriceRow.lock_minor,
    leadAndLockMinor: currentPriceRow.lead_and_lock_minor
  };

  showPrices(
    "Current prices",
    currentPriceRow.version,
    currentAmounts
  );

  const newAmounts: PriceAmounts = {
    baseSubscriptionMinor: await readMinorAmount(
      "Base Subscription Minor",
      currentAmounts.baseSubscriptionMinor
    ),

    postcodeSubscriptionMinor: await readMinorAmount(
      "Postcode Subscription Minor",
      currentAmounts.postcodeSubscriptionMinor
    ),

    leadMinor: await readMinorAmount(
      "Lead Minor",
      currentAmounts.leadMinor
    ),

    lockMinor: await readMinorAmount(
      "Lock Minor",
      currentAmounts.lockMinor
    ),

    leadAndLockMinor: await readMinorAmount(
      "Lead-and-lock Minor",
      currentAmounts.leadAndLockMinor
    ),
  };

  const newVersion = currentPriceRow.version + 1;
  showPrices("New prices", newVersion, newAmounts);

  const confirmation = (
    await consoleInput.question(
      `Type PUBLISH to publish version ${newVersion}`
    )
  ).trim();

  if ( confirmation !== "PUBLISH" ) {
    console.log("Cancelled. Exiting script.");
    return;
  }

  const stripePriceIds = await createStripePriceVersion(
    newVersion,
    newAmounts
  );

  const effectiveFrom = new Date();

  const publishNextPriceRow = async () => {
    const lockedRowQueryResult = await client.query(QUERY_LOCK_PRICE_ROW_FOR_UPDATE);
    requireOneRow(lockedRowQueryResult, "Lock active price row");

    await client.query(
      QUERY_UPDATE_PRICE_ROW_ACTIVE_FALSE,
      [effectiveFrom, currentPriceRow.id, currentPriceRow.version]
    );

    await client.query(
      QUERY_INSERT_NEXT_PRICE_ROW,
      [
        newVersion, 
        effectiveFrom,

        newAmounts.baseSubscriptionMinor,
        newAmounts.postcodeSubscriptionMinor,
        newAmounts.leadMinor,
        newAmounts.lockMinor,
        newAmounts.leadAndLockMinor,

        stripePriceIds.baseSubscriptionPriceId,
        stripePriceIds.postcodeSubscriptionPriceId,
        stripePriceIds.leadPriceId,
        stripePriceIds.lockPriceId,
        stripePriceIds.leadAndLockPriceId,

        'GBP'
      ]
    );
  }

  await withTransaction(client, publishNextPriceRow);

  validateAndPrintPriceVersion(newVersion, client);

  console.log(
    `Price version ${newVersion} published successfully,`
  );
}


async function validateAndPrintPriceVersion(version: number, client: Client) {
  console.log("Fetching price version row...");
  const activePriceRowQueryResult = await client.query<PriceRow>(
          QUERY_GET_PRICE_VERSION,
          [version]
      );
      const activePriceRow: PriceRow = requireOneRow(activePriceRowQueryResult, "Get active price row");
      
      console.log("Printing active price row:");
      console.table(
          [
              {
                  version: activePriceRow.version,
                  effective_from: activePriceRow.effective_from,
                  
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
    throw new Error("Database unpooled is missing.");
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    await publishPriceVersion(client);
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
    consoleInput.close();
  });