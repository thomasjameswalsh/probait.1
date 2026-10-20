async function main(): Promise<void> {
    const { createSubscriptionCheckout } = await import(
        "@/server/stripe/create-subscription-checkout"
    );

    const url = await createSubscriptionCheckout({
        businessAccountId: "ea51dd9b-2926-4636-9c3b-bcdd9ac8a14e",
        stripeCustomerId: "cus_VTZs8ctXS2KN6p",
        baseSubscriptionStripePriceId: "price_1UJCl70ZL7Zl009BI7U9XbLU",
    });

    console.log("Checkout URL:", url);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});