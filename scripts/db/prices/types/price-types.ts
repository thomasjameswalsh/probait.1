export type PriceRow = {
    id: string;
    version: number;
    effective_from: Date;
    effective_to: Date | null;

    base_subscription_minor: number;
    postcode_subscription_minor: number;
    lead_minor: number;
    lock_minor: number;
    lead_and_lock_minor: number;

    base_subscription_stripe_price_id: string | null;
    postcode_subscription_stripe_price_id: string | null;
    lead_stripe_price_id: string | null;
    lock_stripe_price_id: string | null;
    lead_and_lock_stripe_price_id: string | null;
};

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