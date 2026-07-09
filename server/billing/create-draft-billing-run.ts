import type { Client } from "pg";
import type { BillingAmountForCycle } from "./calculate-billing-amount";

import { calculateBillingAmountForCycle } from "./calculate-billing-amount";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type CreateDraftBillingRunForCycleResult = {
    billing_run_id: string,
    billing_cycle_id: string,
    business_account_id: string
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
    RETURNING id, business_billing_cycle_id, business_account_id;
    `;


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


/**
 * Inserts an initial DRAFT billing_run for the given cycle
 *      as the first step before invoice.
 * Returns the new run id and the amount details.
 */
export async function createDraftBillingRunForCycle(
    client: Client,
    billing_cycle_id: string
): Promise<CreateDraftBillingRunForCycleResult> {
    // Later the boss-script should run this and then pass billing-amount-for-cycle into this function
    // The cron will run the boss-script for all due accounts
    const billingAmountForCycle: BillingAmountForCycle = await calculateBillingAmountForCycle(
        client,
        billing_cycle_id
    );

    const result = await client.query<{
        billing_run_id: string,
        billing_cycle_id: string,
        business_account_id: string
    }>(
        QUERY_INSERT_DRAFT_BILLING_RUN_FOR_CYCLE,
        [
            billingAmountForCycle.businessBillingCycleId,
            billingAmountForCycle.businessAccountId,
            billingAmountForCycle.totalMinor
        ]
    );

    const billing_run_id = result.rows[0]?.billing_run_id;
    if ( ! billing_run_id ) {
        throw new Error(
            `Could not create billing run for cycle ${billing_cycle_id}`
        );
    }

    return {
        billing_run_id,
        billing_cycle_id: result.rows[0].billing_cycle_id,
        business_account_id: result.rows[0].business_account_id
    };
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


