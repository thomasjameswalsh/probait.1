import type { Client } from "pg";

import { requireOneRow } from "@/scripts/query-helpers";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


type PriceRow = {
    currency: "GBP";
    baseSubscriptionMinor: number;
    postcodeSubscriptionMinor: number;
};

type BillingCycleIdentity = {
    businessBillingCycleId: string;
    businessAccountId: string;
}

export type BillingAmountForCycle = {
    businessBillingCycleId: string;
    businessAccountId: string;
    currency: "GBP";
    baseSubscriptionMinor: number;
    postcodeSubscriptionMinor: number;
    activePostcodeSubscriptionCount: number;
    postcodeSubscriptionsTotalMinor: number;
    totalMinor: number;
};


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


const QUERY_GET_BILLING_CYCLE_BUSINESS_ID =
    `
    SELECT
        id AS "businessBillingCycleId",
        business_account_id AS "businessAccountId"
    FROM business_billing_cycles
    WHERE 
        id = $1
        AND business_account_id = $2
        AND active = true
        AND billing_state  = 'ACTIVE';
    `;

const QUERY_GET_CURRENT_PRICE_ROW =
    `
    SELECT
        currency,
        base_subscription_minor AS "baseSubscriptionMinor",
        postcode_subscription_minor AS "postcodeSubscriptionMinor"
    FROM prices
    WHERE active = true
    `;

const QUERY_COUNT_POSTCODE_SUBSCRIPTIONS =
    `
    SELECT COUNT(*)::integer AS count
    FROM postcode_subscriptions
    WHERE business_account_id = $1
    AND active = true
    `;


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function calculateBillingAmountForCycle(
    client: Client,
    businessBillingCycleId: string,
    businessAccountId: string
): Promise<BillingAmountForCycle> {
    const billingCycle: BillingCycleIdentity = await getBillingCycle(
        client,
        businessBillingCycleId,
        businessAccountId
    );

    const activePrice: PriceRow = await getActivePrice(client);

    const activePostcodeSubscriptionCount: number =
        await countActivePostcodeSubscriptions(
            client,
            billingCycle.businessAccountId,
        );

    const postcodeSubscriptionsTotalMinor =
        ( activePrice.postcodeSubscriptionMinor * activePostcodeSubscriptionCount );

    const totalMinor =
        ( activePrice.baseSubscriptionMinor + postcodeSubscriptionsTotalMinor );

    return {
        businessBillingCycleId: billingCycle.businessBillingCycleId,
        businessAccountId: billingCycle.businessAccountId,
        currency: activePrice.currency,
        baseSubscriptionMinor: activePrice.baseSubscriptionMinor,
        postcodeSubscriptionMinor: activePrice.postcodeSubscriptionMinor,
        activePostcodeSubscriptionCount,
        postcodeSubscriptionsTotalMinor,
        totalMinor,
    };
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function getBillingCycle(
    client: Client,
    businessBillingCycleId: string,
    businessAccountId: string
): Promise<BillingCycleIdentity> {
    const result = await client.query<BillingCycleIdentity>(
        QUERY_GET_BILLING_CYCLE_BUSINESS_ID,
        [businessBillingCycleId, businessAccountId],
    );

    return requireOneRow(
        result,
        `Getting active billing cycle ${businessBillingCycleId} with account ${businessAccountId}`);
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function getActivePrice(
    client: Client,
): Promise<PriceRow> {
    const result = await client.query<PriceRow>(
        QUERY_GET_CURRENT_PRICE_ROW,
    );

    return requireOneRow(
        result,
        `Getting active price row for billing calculation`
    );
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function countActivePostcodeSubscriptions(
    client: Client,
    businessAccountId: string,
): Promise<number> {
    const result = await client.query<{ count: number }>(
        QUERY_COUNT_POSTCODE_SUBSCRIPTIONS,
        [businessAccountId],
    );

    const countRow = requireOneRow(
        result,
        `Counting active postcode subscriptions for business account ${businessAccountId}`
    );

    return countRow.count;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


