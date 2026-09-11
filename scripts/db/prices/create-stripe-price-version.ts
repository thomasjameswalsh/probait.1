import Stripe from "stripe";

import { stripe } from "@scripts/stripe-client";

export type PriceAmounts = {
    baseSubscriptionMinor: number;
    postcodeSubscriptionMinor: number;
    leadMinor: number;
    lockMinor: number;
    leadAndLockMinor: number;
};

export type StripePriceIds = {
    baseSubscriptionPriceId: string;
    postcodeSubscriptionPriceId: string;
    leadPriceId: string;
    lockPriceId: string;
    leadAndLockPriceId: string;
};

function getProductId(variableName: string): string {
    const productId = process.env[variableName];

    if ( ! productId ) {
        throw new Error(`Missing env var ${variableName}`);
    }

    if ( ! productId.startsWith('prod_') ) {
        throw new Error(`Env var '${variableName}' is not a Stripe product ID.`);
    }

    return productId;
}

function validateAmount(name: string, amount: number): void {
  if ( ! Number.isSafeInteger(amount) || amount < 0 ) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}


export async function createStripePriceVersion(
    version: number,
    amounts: PriceAmounts
): Promise<StripePriceIds> {
    if ( ! Number.isSafeInteger(version) || version <= 0 ) {
        throw new Error("Price version must be a positive integer");
    }

    validateAmount("baseMinor", amounts.baseSubscriptionMinor);
    validateAmount("postcodeMinor", amounts.postcodeSubscriptionMinor);
    validateAmount("leadMinor", amounts.leadMinor);
    validateAmount("lockMinor", amounts.lockMinor);
    validateAmount("leadAndLockMinor", amounts.leadAndLockMinor);

    const productIds = 
    {
        baseSubscription: getProductId("STRIPE_BASE_SUBSCRIPTION_PRODUCT_ID"),
        postcodeSubscription: getProductId("STRIPE_POSTCODE_SUBSCRIPTION_PRODUCT_ID"),
        lead: getProductId("STRIPE_LEAD_PRODUCT_ID"),
        lock: getProductId("STRIPE_LOCK_PRODUCT_ID"),
        leadAndLock: getProductId("STRIPE_LEAD_AND_LOCK_PRODUCT_ID")
    };

    const [
        baseSubscriptionPriceData,
        postcodeSubscriptionPriceData,
        leadPriceData,
        lockPriceData,
        leadAndLockPriceData
    ] = await Promise.all([
        stripe.prices.create({
            product: productIds.baseSubscription,
            unit_amount: amounts.baseSubscriptionMinor,
            currency: "gbp",
            recurring: {
                interval: "month",
                usage_type: "licensed"
            },

            metadata: {
                app_price_version: String(version),
                price_type: "BASE_SUBSCRIPTION"
            },
        }),

        stripe.prices.create({
            product: productIds.postcodeSubscription,
            unit_amount: amounts.postcodeSubscriptionMinor,
            currency: "gbp",

            recurring: {
                interval: "month",
                usage_type: "licensed"
            },

            metadata: {
                app_price_version: String(version),
                price_type: "POSTCODE_SUBSCRIPTION"
            },
        }),

        stripe.prices.create({
            product: productIds.lead,
            unit_amount: amounts.leadMinor,
            currency: "gbp",

            metadata: {
                app_price_version: String(version),
                price_type: "LEAD"
            },
        }),

        stripe.prices.create({
            product: productIds.lock,
            unit_amount: amounts.lockMinor,
            currency: "gbp",
            
            metadata: {
                app_price_version: String(version),
                price_type: "LOCK"
            }
       }),

       stripe.prices.create({
            product: productIds.leadAndLock,
            unit_amount: amounts.leadAndLockMinor,
            currency: "gbp",

            metadata: {
                app_price_version: String(version),
                price_type: "LEAD_AND_LOCK"
            }
       })
    ]);

    return {
        baseSubscriptionPriceId: baseSubscriptionPriceData.id,
        postcodeSubscriptionPriceId: postcodeSubscriptionPriceData.id,
        leadPriceId: leadPriceData.id,
        lockPriceId: lockPriceData.id,
        leadAndLockPriceId: leadAndLockPriceData.id
    };
}