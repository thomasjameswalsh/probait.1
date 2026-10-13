import "server-only";

import type Stripe from "stripe";
import type { PoolClient } from "pg";

import { pool } from "@/lib/db/pool";
import { optionalOneRow, requireOneRow } from "@/lib/db/query-helpers";
import { stripe } from "@/server/stripe/client";


type BusinessAccountId = {
    id: string;
};

type UnendedSubscriptionId = {
    stripe_subscription_id: string;
};


const BASE_PRODUCT_ID = process.env.STRIPE_BASE_SUBSCRIPTION_PRODUCT_ID;
const POSTCODE_PRODUCT_ID = process.env.STRIPE_POSTCODE_SUBSCRIPTION_PRODUCT_ID;
if (
    ! BASE_PRODUCT_ID ||
    ! POSTCODE_PRODUCT_ID ||
    BASE_PRODUCT_ID === POSTCODE_PRODUCT_ID ) {
        throw new Error("Missing or invalid Stripe product IDs from env.");
    }


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
    WHERE
        business_subscriptions.business_account_id =
            EXCLUDED.business_account_id
    RETURNING id;
`;


const QUERY_LOCK_BUSINESS_ACCOUNT =
    `
    SELECT id
    FROM business_accounts
    WHERE stripe_customer_id = $1
    FOR UPDATE;
    `;


const QUERY_SELECT_UNENDED_SUBSCRIPTION =
    `
    SELECT stripe_subscription_id
    FROM business_subscriptions
    WHERE business_account_id = $1
        AND ended_at IS NULL;
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
    const stripeSubscription= await stripe.subscriptions.retrieve(
        subscriptionId,
        {},
        {
            timeout: 10_000,
            maxNetworkRetries: 1,
        },
    );

    const subscriptionCustomerId =
        typeof stripeSubscription.customer === "string"
            ? stripeSubscription.customer
            : stripeSubscription.customer.id;
    
    if ( subscriptionCustomerId !== stripeCustomerId ) {
        throw new Error("Stripe subscription customer mismatch");
    }

    return stripeSubscription;
}


async function saveSubscription(
    client: PoolClient,
    businessAccountId: string,
    subscription: Stripe.Subscription
): Promise<void> {
    const items = subscription.items.data;

    const baseItems = items.filter(
        (item) => getProductId(item) === BASE_PRODUCT_ID,
    );
    const baseItem = baseItems[0];
    if ( ! baseItem ) {
        throw new Error("Base subscription item missing.");
    }

    const postcodeItems = items.filter(
        (item) => getProductId(item) === POSTCODE_PRODUCT_ID,
    );

    const totalNumberOfItems = items.length;
    const numberOfBaseProductItems = baseItems.length;
    const numberOfPostcodeProductItems = postcodeItems.length;
    if ( numberOfBaseProductItems !== 1 ) {
        throw new Error("Base subscription item missing.");
    }

    /*
    if ( numberOfPostcodeProductItems > 1 ) {
        // Future: Consider handling of additional postcode items.
    }
    */

    // Is this necessary? REally, if the user has done something strange in stripe to make additional items, our app can go on and take the first item
    // Later clean-up script could run, but currently that is not there. Throw error doesn't seem right because it might lose an important update on the sub,
    // and this system needs to run-itself and keep working no matter what as much as possible - nobody is going to do admin work on individual subs
    if ( ( numberOfPostcodeProductItems + numberOfBaseProductItems ) !== totalNumberOfItems ) {
        throw new Error("Unexpected subscription items present.");
    }

    const baseItem = baseItems[0];
    const postcodeItem = postcodeItems[0];

    if ( ! baseItem || baseItem.quantity !== 1 ) {
        throw new Error("Expected one base item with quantity of 1.");
    }

    const postcodeQuantity = postcodeItem
        ? postcodeItem.quantity
        : 0;
    
    if ( typeof postcodeQuantity !== "number" ||
        ! Number.isSafeInteger(postcodeQuantity) ||
        postcodeQuantity < 0 )
    {
        throw new Error("Invalid postcode subscription quantity.");
    }
    
    const result = await client.query<{ id: string }>(
        QUERY_UPSERT_BUSINESS_SUBSCRIPTION,
        [
            businessAccountId,
            subscription.id,
            baseItem.id,
            postcodeItem?.id ?? null,
            subscription.status,
            postcodeQuantity,
            toDate(baseItem.current_period_start),
            toDate(baseItem.current_period_end),
            subscription.cancel_at_period_end,
            toDate(subscription.cancel_at),
            toDate(subscription.canceled_at),
            toDate(subscription.ended_at),
        ],
    );
    requireOneRow(result, "Save (upsert) business subscription");
}


export async function pullStripeSubscriptionStateToDatabase(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
): Promise<void> {
    const client = await pool.connect();
    let discardConnection = false;

    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout = '5s';");

        const accountResult = await client.query<BusinessAccountId>(
            QUERY_LOCK_BUSINESS_ACCOUNT,
            [stripeCustomerId]
        );

        const account = requireOneRow(
            accountResult,
            "Find business account for Stripe subscription"
        );

        const stripeSubscription = await retrieveSubscriptionFromStripe(
            stripeSubscriptionId,
            stripeCustomerId
        );

        if ( stripeSubscription.ended_at === null ) {
            const unendedSubscriptionInDbResult =
                await client.query<UnendedSubscriptionId>(
                    QUERY_SELECT_UNENDED_SUBSCRIPTION,
                    [account.id]
                );
            
            // What if there is no row returned?
            const unendedSubscriptionInDb = optionalOneRow(
                unendedSubscriptionInDbResult,
                `Select unended subscription for ${account.id}`);
            
            // This is a complicated state where a previous subscription has ended in Stripe
            // before the ending webhook has arrived and been logged in db
            if ( unendedSubscriptionInDb &&
                 unendedSubscriptionInDb.stripe_subscription_id !== stripeSubscription.id ) {
                const endedStripeSubscription = await retrieveSubscriptionFromStripe(
                    unendedSubscriptionInDb.stripe_subscription_id,
                    stripeCustomerId
                );
                
                if ( endedStripeSubscription.ended_at === null ) {
                    // Make something happen here where the old subscription gets deleted
                    // Doesn't Stripe have fundamental protection against this?
                    // This seems like coding around things that Stripe should prevent/be fully reliable for
                    throw new Error(`Business has two unended subscriptions in Stripe.`);
                }

            }
            
        }

        if ( existingResult)
    }
}