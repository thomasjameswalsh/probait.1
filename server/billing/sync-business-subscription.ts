import "server-only";

import type Stripe from "stripe";
import type { PoolClient } from "pg";

import { pool } from "@/lib/db/pool";
import { optionalOneRow, requireOneRow } from "@/lib/db/query-helpers";
import { stripe } from "@/server/stripe/client";


const BASE_PRODUCT_ID =
    process.env.STRIPE_BASE_SUBSCRIPTION_PRODUCT_ID;

const POSTCODE_PRODUCT_ID =
    process.env.STRIPE_POSTCODE_SUBSCRIPTION_PRODUCT_ID;

if (
    ! BASE_PRODUCT_ID ||
    ! POSTCODE_PRODUCT_ID ||
    BASE_PRODUCT_ID === POSTCODE_PRODUCT_ID
) {
    throw new Error("Missing or invalid Stripe product IDs from env.");
}


const QUERY_LOCK_BUSINESS_ACCOUNT = `
    SELECT id
    FROM business_accounts
    WHERE stripe_customer_id = $1
    FOR UPDATE;
`;


const QUERY_SELECT_UNENDED_SUBSCRIPTION = `
    SELECT stripe_subscription_id
    FROM business_subscriptions
    WHERE business_account_id = $1
        AND ended_at IS NULL;
`;


const QUERY_UPSERT_BUSINESS_SUBSCRIPTION = `
    INSERT INTO business_subscriptions (
        business_account_id,
        stripe_subscription_id,
        stripe_base_subscription_item_id,
        stripe_postcode_subscription_item_id,
        stripe_status,
        postcode_quantity,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        cancel_at,
        canceled_at,
        ended_at
    ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
    )
    ON CONFLICT (stripe_subscription_id)
    DO UPDATE SET
        stripe_base_subscription_item_id =
            EXCLUDED.stripe_base_subscription_item_id,
        stripe_postcode_subscription_item_id =
            EXCLUDED.stripe_postcode_subscription_item_id,
        stripe_status = EXCLUDED.stripe_status,
        postcode_quantity = EXCLUDED.postcode_quantity,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        cancel_at = EXCLUDED.cancel_at,
        canceled_at = EXCLUDED.canceled_at,
        ended_at = EXCLUDED.ended_at
    WHERE business_subscriptions.business_account_id =
        EXCLUDED.business_account_id
    RETURNING id;
`;


const QUERY_UPDATE_ENDED_SUBSCRIPTION =
    `
        UPDATE business_subscriptions
        SET
            stripe_status = $3,
            ended_at = $4,
            cancel_at = $5,
            canceled_at = $6
        WHERE business_account_id = $1
            AND stripe_subscription_id = $2
        RETURNING id;
    `;


function toDate(timestamp: number | null): Date | null {
    return timestamp === null
        ? null
        : new Date(timestamp * 1000);
}


function getProductId(item: Stripe.SubscriptionItem): string {
    return typeof item.price.product === "string"
        ? item.price.product
        : item.price.product.id;
}


async function retrieveSubscriptionFromStripe(
    subscriptionId: string,
    stripeCustomerId: string,
): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(
        subscriptionId,
        {},
        {
            timeout: 10_000,
            maxNetworkRetries: 1,
        },
    );

    const customerId =
        typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

    if ( customerId !== stripeCustomerId ) {
        throw new Error("Stripe subscription customer mismatch.");
    }

    return subscription;
}


async function upsertSubscriptionRow(
    client: PoolClient,
    businessAccountId: string,
    subscription: Stripe.Subscription,
): Promise<void> {
    if ( subscription.ended_at !== null ) {
        const result = await client.query<{ id: string }>(
            QUERY_UPDATE_ENDED_SUBSCRIPTION,
            [
                businessAccountId,
                subscription.id,
                subscription.status,
                toDate(subscription.ended_at),
                toDate(subscription.cancel_at),
                toDate(subscription.canceled_at),
            ],
        );
        optionalOneRow(result, "Update ended subscription");

        return;
    }

    const baseItem = subscription.items.data.find(
        (item) => getProductId(item) === BASE_PRODUCT_ID,
    );

    const postcodeItem = subscription.items.data.find(
        (item) => getProductId(item) === POSTCODE_PRODUCT_ID,
    );

    if ( ! baseItem ) {
        throw new Error("Base subscription item missing.");
    }

    const result = await client.query<{ id: string }>(
        QUERY_UPSERT_BUSINESS_SUBSCRIPTION,
        [
            businessAccountId,
            subscription.id,
            baseItem.id,
            postcodeItem?.id ?? null,
            subscription.status,
            postcodeItem ? postcodeItem.quantity : 0,
            toDate(baseItem.current_period_start),
            toDate(baseItem.current_period_end),
            subscription.cancel_at_period_end,
            toDate(subscription.cancel_at),
            toDate(subscription.canceled_at),
            toDate(subscription.ended_at),
        ],
    );

    requireOneRow(result, "Save business subscription");
}


export async function saveStripeSubscriptionStateToDatabase(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
): Promise<void> {
    const client = await pool.connect();
    let discardConnection = false;

    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout = '5s'");

        const accountResult = await client.query<{ id: string }>(
            QUERY_LOCK_BUSINESS_ACCOUNT,
            [stripeCustomerId],
        );

        const account = requireOneRow(
            accountResult,
            "Find business account for Stripe subscription",
        );

        const stripeSubscription = await retrieveSubscriptionFromStripe(
            stripeSubscriptionId,
            stripeCustomerId,
        );

        let shouldSave = true;

        if ( stripeSubscription.ended_at === null ) {
            const existingResult = await client.query<{
                stripe_subscription_id: string;
            }>(
                QUERY_SELECT_UNENDED_SUBSCRIPTION,
                [account.id],
            );

            const existing = optionalOneRow(
                existingResult,
                "Find unended business subscription",
            );

            // The unlikely case where an existing active subscription is already recorded.
            // Refresh the recorded subscription before deciding whether to accept incoming.
            if (
                existing &&
                existing.stripe_subscription_id !== stripeSubscription.id
            ) {
                const existingSubscription =
                    await retrieveSubscriptionFromStripe(
                        existing.stripe_subscription_id,
                        stripeCustomerId,
                    );

                await upsertSubscriptionRow(
                    client,
                    account.id,
                    existingSubscription,
                );

                shouldSave = existingSubscription.ended_at !== null;
            }
        }

        if ( shouldSave ) {
            await upsertSubscriptionRow(
                client,
                account.id,
                stripeSubscription,
            );
        }

        await client.query("COMMIT");
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