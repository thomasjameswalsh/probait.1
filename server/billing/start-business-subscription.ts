import "server-only";

import { pool } from "@/lib/db/pool";
import { optionalOneRow, requireOneRow } from "@/lib/db/query-helpers";
import { getOrCreateStripeCustomerId } from "@/server/stripe/get-stripe-customer-id";
import { createSubscriptionCheckout } from "@/server/stripe/create-subscription-checkout";


const QUERY_SELECT_BUSINESS_ACCOUNT =
    `
    SELECT active, closed_at
    FROM business_accounts
    WHERE id = $1;
    `;

const QUERY_SELECT_UNENDED_SUBSCRIPTION =
    `
    SELECT stripe_subscription_id
    FROM business_subscriptions
    WHERE business_account_id = $1
        AND ended_at IS NULL;
    `;

const QUERY_SELECT_CURRENT_BASE_PRICE_ID =
    `
    SELECT base_subscription_stripe_price_id
    FROM prices
    WHERE active = true;
    `;


export async function startBusinessSubscription(
    businessAccountId: string,
): Promise<string> {
    const accountResult = await pool.query<{
        active: Boolean;
        closed_at: Date | null;
    }>(
        QUERY_SELECT_BUSINESS_ACCOUNT,
        [businessAccountId]
    );
    const account = requireOneRow(
        accountResult,
        "Find business account for subscription checkout",
    );

    if ( ! account.active || account.closed_at !== null ) {
        throw new Error("Business account is inactive or closed.");
    }

    const existingUnendedSubscriptionResult = await pool.query<{
        stripe_subscription_id: string;
    }>(
        QUERY_SELECT_UNENDED_SUBSCRIPTION,
        [businessAccountId]
    );

    const existingUnendedSubscription = optionalOneRow(
        existingUnendedSubscriptionResult,
        "Find existing unended subscription to block new checkout",
    );

    if ( existingUnendedSubscription ) {
        throw new Error("Business account already has an unended subscription.");
    }

    const priceResult = await pool.query<{
        base_subscription_stripe_price_id: string | null;
    }>(QUERY_SELECT_CURRENT_BASE_PRICE_ID);
    const price = requireOneRow(
        priceResult,
        "Find current base subscription stripe price id"
    );

    if ( ! price.base_subscription_stripe_price_id ) {
        throw new Error("Stripe base price ID null.");
    }

    const priceId: string = price.base_subscription_stripe_price_id!;
    const stripeCustomerId = await getOrCreateStripeCustomerId(businessAccountId);
    return createSubscriptionCheckout({
        businessAccountId,
        stripeCustomerId,
        baseSubscriptionStripePriceId: priceId,
    });
}

