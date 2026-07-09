import type { Client } from "pg";

import { calculateBillingAmountForCycle } from "./calculate-billing-amount";
import { createDraftBillingRunForCycle } from "./create-draft-billing-run";
import { createStripeInvoiceForRun } from "./create-stripe-invoice-for-run";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type DueBillingCycle = {
    businessBillingCycleId: string;
    businessAccountId: string;
};

export type RunDueBillingCycleResult = {
    businessBillingCycleId: string;
    businessAccountId: string;
    billingRunId: string;
    stripeInvoiceId: string;
};

type DraftBillingRunIdentity = {
    billingRunId: string;
    businessBillingCycleId: string;
    businessAccountId: string;
};


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function runDueBillingCycle(
    client: Client,
    dueCycle: DueBillingCycle
): Promise<RunDueBillingCycleResult> {
    const draftRun = await createDraftBillingRunStage(client, dueCycle);

    const invoice = await createStripeInvoiceForRun(client, {
        billingRunId: draftRun.billingRunId,
        businessBillingCycleId: draftRun.businessBillingCycleId,
        businessAccountId: draftRun.businessAccountId,
    });

    if (!invoice.stripeInvoiceId) {
        throw new Error(
            `Stripe invoice was not created for billing run ${draftRun.billingRunId}`
        );
    }

    return {
        businessBillingCycleId: draftRun.businessBillingCycleId,
        businessAccountId: draftRun.businessAccountId,
        billingRunId: draftRun.billingRunId,
        stripeInvoiceId: invoice.stripeInvoiceId,
    };
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function createDraftBillingRunStage(
    client: Client,
    dueCycle: DueBillingCycle
): Promise<DraftBillingRunIdentity> {
    await client.query("BEGIN");

    try {
        const billingAmount = await calculateBillingAmountForCycle(
            client,
            dueCycle
        );

        const draftRun = await createDraftBillingRunForCycle(
            client,
            billingAmount
        );

        assertDraftRunMatchesDueCycle(draftRun, dueCycle);

        await client.query("COMMIT");

        return draftRun;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\





///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

