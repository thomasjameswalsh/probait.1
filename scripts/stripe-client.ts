import { loadEnvConfig } from "@next/env";
import Stripe from "stripe";

loadEnvConfig(process.cwd());

if ( ! process.env.STRIPE_SECRET_KEY ) {
    throw new Error(
        "STRIPE_SECRET_KEY is missing.",
    );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);