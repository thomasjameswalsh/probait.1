import type { Client } from "pg";
import type { BillingAmountForCycle } from "./calculate-billing-amount";

import { requireOneRow } from "@/scripts/query-helpers"

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\
// Responsibility: Strictly insert one eligible DRAFT billing run.
///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type DraftBillingRunForCycleIdentity = {
    businessBillingRunId: string,
    businessBillingCycleId: string,
    businessAccountId: string
};


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


const QUERY_INSERT_DRAFT_BILLING_RUN_FOR_CYCLE =
    `
    INSERT INTO business_billing_runs (
        business_billing_cycle_id,
        business_account_id,
        period_start,
        period_end,
        amount_minor,
        currency,
        status
    )
    SELECT
        c.id,
        c.business_account_id,
        c.current_period_start,
        c.current_period_end,
        $3,
        $4,
        'DRAFT'
    FROM business_billing_cycles c
    WHERE
        c.id = $1
        AND c. business_account_id = $2
        AND c.active = true,
        AND c.billing_state = 'ACTIVE'
        AND c.current_period_end <= now()
        AND c.stripe_customer_id IS NOT NULL
    RETURNING 
        id AS "businessBillingRunId", 
        business_billing_cycle_id AS "businessBillingCycleId",
        business_account_id AS "businessAccountId"
    `;


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function createDraftBillingRunForCycle(
    client: Client,
    billingAmountForCycle: BillingAmountForCycle
): Promise<DraftBillingRunForCycleIdentity> {
    const result = await client.query<DraftBillingRunForCycleIdentity>(
        QUERY_INSERT_DRAFT_BILLING_RUN_FOR_CYCLE,
        [
            billingAmountForCycle.businessBillingCycleId,
            billingAmountForCycle.businessAccountId,
            billingAmountForCycle.totalMinor
        ]
    );

    return requireOneRow(
        result,
        `Creating DRAFT billing run for cycle ${billingAmountForCycle.businessBillingCycleId}`
    );
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


