import { stripe } from "@/server/stripe/client";
import {
    saveStripeSubscriptionStateToDatabase,
} from "@/server/billing/sync-business-subscription";

export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if ( ! webhookSecret ) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing.");
}

export async function POST(request: Request): Promise<Response> {
    const signature = request.headers.get("stripe-signature");
    if ( ! signature ) {
        return new Response("Missing Stripe signature.", { status: 400 });
    }

    const body = await request.text();
    let event;
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            webhookSecret!,
        );
    } catch {
        return new Response("Invalid Stripe webhook.", { status: 400 });
    }

    try {
        switch ( event.type ) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object;

                const customerId =
                    typeof subscription.customer === "string"
                        ? subscription.customer
                        : subscription.customer.id;
                
                await saveStripeSubscriptionStateToDatabase(
                    customerId,
                    subscription.id,
                );

                break;
            }
        }
    } catch (error) {
        console.error("Stripe subscription sync failed:", {
            eventId: event.id,
            eventType: event.type,
            error,
        });

        return new Response("Subscription sync failed.", { status: 500 });
    }

    return new Response(null, { status: 200 });
}