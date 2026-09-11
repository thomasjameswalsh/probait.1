import type { Client } from "pg";

import type { BillingAmountForCycle } from "../modules/due-account/calculate-billing-amount";
import type { DraftBillingRunForCycleIdentity } from "../modules/due-account/create-draft-billing-run";
import type { OpenBillingRunInvoice } from "../modules/due-account/create-stripe-invoice-for-run";

import { calculateBillingAmountForCycle } from "../modules/due-account/calculate-billing-amount";
import { createDraftBillingRunForCycle } from "../modules/due-account/create-draft-billing-run";
import { createStripeInvoiceForRun } from "../modules/due-account/create-stripe-invoice-for-run";

import { requireOneRow } from "../../../scripts/query-helpers";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type DueBillingCycleIdentity = {
    businessBillingCycleId: string;
    businessAccountId: string;
};

export type DueBillingCycleRow = {
    businessBillingCycleId: string;
    businessAccountId: string;
    active: boolean;
    billingState: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    stripeCustomerId: string | null;
};

export type RunDueBillingCycleResult =
    | {
        outcome: "COMPLETED";
        businessBillingCycleId: string;
        businessAccountId: string;
        billingRunId: string;
        stripeInvoiceId: string;
    }
    | {
        outcome: "SKIPPED";
        reason:
            | "NOT_ACTIVE"
            | "BILLING_STATE_NOT_ACTIVE"
            | "CURRENT_PERIOD_NOT_ENDED"
            | "NO_STRIPE_ID";
        businessBillingCycleId: string;
    };


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


const QUERY_LOAD_AND_LOCK_BILLING_CYCLE = `
    SELECT
        id AS "businessBillingCycleId",
        business_account_id AS "businessAccountId",
        active,
        billing_state AS "billingState",
        current_period_start AS "currentPeriodStart",
        current_period_end AS "currentPeriodEnd",
        stripe_customer_id AS "stripeCustomerId"
    FROM business_billing_cycles
    WHERE
        id = $1
        AND business_account_id = $2
    FOR UPDATE;
`;


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function runDueBillingCycle(
    client: Client,
    dueBillingCycleIdentity: DueBillingCycleIdentity
): Promise<RunDueBillingCycleResult> {
    const billingCycleResult = await client.query<DueBillingCycleRow>(
        QUERY_LOAD_AND_LOCK_BILLING_CYCLE,
        [
            dueBillingCycleIdentity.businessBillingCycleId,
            dueBillingCycleIdentity.businessAccountId,
        ]
    );

    const billingCycleRow: DueBillingCycleRow = requireOneRow(
        billingCycleResult,
        "run-due-billing-cycle.ts"
    );

    const cycleId = billingCycleRow.businessBillingCycleId;

    if (!billingCycleRow.active) {
        return {
            outcome: "SKIPPED",
            reason: "NOT_ACTIVE",
            businessBillingCycleId: cycleId,
        };
    }

    if (billingCycleRow.billingState !== "ACTIVE") {
        return {
            outcome: "SKIPPED",
            reason: "BILLING_STATE_NOT_ACTIVE",
            businessBillingCycleId: cycleId,
        };
    }

    if (billingCycleRow.currentPeriodEnd.getTime() > Date.now()) {
        return {
            outcome: "SKIPPED",
            reason: "CURRENT_PERIOD_NOT_ENDED",
            businessBillingCycleId: cycleId,
        };
    }

    if (!billingCycleRow.stripeCustomerId) {
        return {
            outcome: "SKIPPED",
            reason: "NO_STRIPE_ID",
            businessBillingCycleId: cycleId,
        };
    }

    const billingAmountForCycle: BillingAmountForCycle =
        await calculateBillingAmountForCycle(
            client,
            dueBillingCycleIdentity.businessBillingCycleId,
            dueBillingCycleIdentity.businessAccountId
        );

    const draftBillingRunForCycleIdentity:
        DraftBillingRunForCycleIdentity =
        await createDraftBillingRunForCycle(
            client,
            billingAmountForCycle
        );

    const openBillingRunInvoice: OpenBillingRunInvoice =
        await createStripeInvoiceForRun(
            client,
            draftBillingRunForCycleIdentity
        );

    if (!openBillingRunInvoice.stripeInvoiceId) {
        throw new Error(
            `Stripe invoice was not created for billing run ${openBillingRunInvoice.businessBillingRunId}`
        );
    }

    return {
        outcome: "COMPLETED",
        businessBillingCycleId:
            draftBillingRunForCycleIdentity.businessBillingCycleId,
        businessAccountId:
            draftBillingRunForCycleIdentity.businessAccountId,
        billingRunId:
            draftBillingRunForCycleIdentity.businessBillingRunId,
        stripeInvoiceId: openBillingRunInvoice.stripeInvoiceId,
    };
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


