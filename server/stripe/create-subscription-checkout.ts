import "server-only";

import { stripe } from "@/server/stripe/client";

type CreateSubscriptionCheckoutInput = {
    businessAccountId: string;
    stripeCustomerId: string;
    baseSubscriptionStripePriceId: string;
};

export async function createSubscriptionCheckout({
    businessAccountId,
    stripeCustomerId,
    baseSubscriptionStripePriceId,
}: CreateSubscriptionCheckoutInput): Promise<string> {
    const appURL = process.env.APP_URL;

    if ( ! appURL ) {
        throw new Error("APP_URL is missing.");
    }

    const origin = new URL(appURL).origin;

    const session = await stripe.checkout.sessions.create({
        mode: "subscription",

        customer: stripeCustomerId,
        client_reference_id: businessAccountId,

        line_items: [
            {
                price: baseSubscriptionStripePriceId,
                quantity: 1
            }
        ],

        subscription_data: {
            metadata: {
                business_account_id: businessAccountId,
            }
        },

        success_url:
            `${origin}/billing/success` +
            "?session_id={CHECKOUT_SESSION_ID}",
        
        cancel_url: `${origin}/billing`
    });

    if ( ! session.url ) {
        throw new Error("Stripe did not return a Checkout URL");
    }

    return session.url;
}