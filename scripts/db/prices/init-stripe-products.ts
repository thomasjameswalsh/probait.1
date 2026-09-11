import { stripe } from "@scripts/stripe-client";

// run scripts outside of next-js using env var with flag
// npx tsx --env-file=.env.local scripts/db/prices/init-stripe-products.ts

const products = [
  ["STRIPE_BASE_SUBSCRIPTION_PRODUCT_ID", "Probait Base Subscription"],
  ["STRIPE_POSTCODE_SUBSCRIPTION_PRODUCT_ID", "Probait Postcode Subscription"],
  ["STRIPE_LEAD_PRODUCT_ID", "Probait Lead"],
  ["STRIPE_LOCK_PRODUCT_ID", "Probait Lock"],
  ["STRIPE_LEAD_AND_LOCK_PRODUCT_ID", "Probait Lead and Lock"],
] as const;

async function main() {
  for ( const [environmentName, productName] of products ) {
    const product = await stripe.products.create({
      name: productName,
    });

    console.log(`${environmentName} = ${product.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});