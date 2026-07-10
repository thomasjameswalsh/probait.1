import type { ClientBase } from "pg";


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
    ORDER BY effective_from DESC
    LIMIT 1
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
    client: ClientBase,
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
        businessBillingCycleId: businessBillingCycleId,
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
    client: ClientBase,
    billing_cycle_id: string,
    businessAccountId: string
): Promise<BillingCycleIdentity> {
    const result = await client.query<BillingCycleIdentity>(
        QUERY_GET_BILLING_CYCLE_BUSINESS_ID,
        [billing_cycle_id, businessAccountId],
    );

    const row: BillingCycleIdentity = result.rows[0];
    if ( !row ) {
        throw new Error(
            `Billing cycle not found: ${billing_cycle_id}`
        );
    }

    return row;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function getActivePrice(
    client: ClientBase,
): Promise<PriceRow> {
    const result = await client.query<PriceRow>(
        QUERY_GET_CURRENT_PRICE_ROW,
    );

    const row = result.rows[0];

    if ( !row ) {
        throw new Error("No active price row found");
    }

    return row;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function countActivePostcodeSubscriptions(
    client: ClientBase,
    businessAccountId: string,
): Promise<number> {
    const result = await client.query<{ count: number }>(
        QUERY_COUNT_POSTCODE_SUBSCRIPTIONS,
        [businessAccountId],
    );

    return result.rows[0]?.count ?? 0;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


