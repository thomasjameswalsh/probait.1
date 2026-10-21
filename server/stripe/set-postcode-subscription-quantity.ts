import "server-only";

import type Stripe from "stripe";

import { stripe } from "@/server/stripe/client";

const _POSTCODE_PRODUCT_ID: string | undefined =
    process.env.STRIPE_POSTCODE_SUBSCRIPTION_PRODUCT_ID;
if ( ! _POSTCODE_PRODUCT_ID ) {
    throw new Error("Missing Stripe postcode product ID.");
}
const POSTCODE_PRODUCT_ID: string = _POSTCODE_PRODUCT_ID!;


export async function setPostcodeSubscriptionQuantityInStripe(
    stripeSubscriptionId: string,
    stripeCustomerId: string,
    quantity: number,
    postcodeStripePriceId: string,
): Promise<Stripe.Subscription> {

    if ( ! Number.isSafeInteger(quantity) || quantity < 0 ) {
        throw new Error("Invalid postcode quantity.");
    }

    const subscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        {},
        {
            timeout: 10_000,
            maxNetworkRetries: 2,
        }
    );

    const customerId =
        typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        
    if ( customerId !== stripeCustomerId ) {
        throw new Error("Stripe subscription customer mismatch.");
    }

    if ( subscription.ended_at !== null ) {
        throw new Error("Cannot change postcodes on an ended subscription.");
    }

    const postcodeItem = subscription.items.data.find((item) => {
        const productId =
            typeof item.price.product === "string"
                ? item.price.product
                : item.price.product.id;
        
        return productId === POSTCODE_PRODUCT_ID;
    });

    let itemUpdate: Stripe.SubscriptionUpdateParams.Item;
    if ( quantity === 0 ) {
        if ( ! postcodeItem ) {
            return subscription;
        }

        itemUpdate = {
            id: postcodeItem.id,
            deleted: true,
        };
    } else if ( postcodeItem ) {
        if ( postcodeItem.quantity === quantity ) {
            return subscription;
        }

        itemUpdate = {
            id: postcodeItem.id,
            quantity,
        };
    } else {
        itemUpdate = {
            price: postcodeStripePriceId,
            quantity,
        };
    }

    return stripe.subscriptions.update(
        subscription.id,
        {
            items: [itemUpdate],
            proration_behavior: "none",
        },
        {
            timeout: 10_000,
            maxNetworkRetries: 2,
        },
    );
}