import type { Interface } from "node:readline/promises";
import type { PriceAmounts, PriceRow } from "./types/price-types";


export async function readMinorAmount(
    input: Interface,
    name: string,
    currentValue: number
): Promise<number> {
    while (true) {
        const answer = (
            await input.question(
                `${name} [current value ${currentValue}]: `
            )
        ).trim();

        if ( answer.toLowerCase() === "x" ) {
            console.log(`(x) Using current value ${currentValue} for ${name}`);
            return currentValue;
        }

        if ( answer === "" ) {
            console.log("Please enter a value; or enter 'x' to use current value.");
            continue;
        }

        const value = Number(answer);

        if ( Number.isSafeInteger(value) && value >= 0 ) {
            return value;
        }

        console.log("Enter a non-negative whole number.");
    }
}


export async function readPriceAmounts(
    input: Interface,
    currentAmounts: PriceAmounts
): Promise<PriceAmounts> {
    return {
        baseSubscriptionMinor: await readMinorAmount(
            input,
            "Base Subscription Minor",
            currentAmounts.baseSubscriptionMinor
        ),
        postcodeSubscriptionMinor: await readMinorAmount(
            input,
            "Postcode Subscription Minor",
            currentAmounts.postcodeSubscriptionMinor
        ),
        leadMinor: await readMinorAmount(
            input,
            "Lead Minor",
            currentAmounts.leadMinor
        ),
        lockMinor: await readMinorAmount(
            input,
            "Lock Minor",
            currentAmounts.lockMinor
        ),
        leadAndLockMinor: await readMinorAmount(
            input,
            "Lead-and-lock Minor",
            currentAmounts.leadAndLockMinor
        ),
    };
}


export function showPrices(
    title: string,
    version: number,
    amounts: PriceAmounts
): void {
    console.log(`\nPrices table - ${title} - Version ${version}`);

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
            price: "Lead (minor)",
            minor: amounts.leadMinor,
        },
        {
            price: "Lock (minor)",
            minor: amounts.lockMinor,
        },
        {
            price: "Lead-and-lock (minor)",
            minor: amounts.leadAndLockMinor,
        },
    ]);
}


export function printPriceRow(row: PriceRow, message: string = ""): void {
    console.log(`${message}\n`);
    console.table([
        {
            id: row.id,
            version: row.version,
            effective_from: row.effective_from,
            effective_to: row.effective_to,

            base_subscription: row.base_subscription_minor,
            postcode_subscription: row.postcode_subscription_minor,
            lead: row.lead_minor,
            lock: row.lock_minor,
            lead_and_lock: row.lead_and_lock_minor,

            base_stripe_price_id: row.base_subscription_stripe_price_id,
            postcode_stripe_price_id: row.postcode_subscription_stripe_price_id,
            lead_stripe_price_id: row.lead_stripe_price_id,
            lock_stripe_price_id: row.lock_stripe_price_id,
            lead_and_lock_stripe_price_id: row.lead_and_lock_stripe_price_id,
        },
    ]);
}