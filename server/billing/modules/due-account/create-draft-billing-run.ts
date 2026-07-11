import type { Client } from "pg";
import type { BillingAmountForCycle } from "./calculate-billing-amount";


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
        status
    )
    SELECT
        c.id,
        c.business_account_id,
        c.current_period_start,
        c.current_period_end,
        $3,
        'DRAFT'
    FROM business_billing_cycles c
    WHERE 
        c.id = $1
        AND c.business_account_id = $2
    RETURNING 
        id AS "businessBillingRunId", 
        business_billing_cycle_id AS "businessBillingCycleId",
        business_account_id AS "businessAccountId"
    `;


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


/**
 * Inserts an initial DRAFT billing_run for the given cycle
 *      as the first step before invoice.
 * Returns the new run id and the amount details.
 */
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

    const businessBillingRunId = result.rows[0]?.businessBillingRunId;
    if ( ! businessBillingRunId ) {
        throw new Error(
            `Could not create billing run for cycle ${billingAmountForCycle.businessBillingCycleId}`
        );
    }

    return result.rows[0];
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


