import type { Client } from "pg";
import type { BillingAmountForCycle } from "./calculate-billing-amount";
import type { DraftBillingRunForCycleIdentity } from "./create-draft-billing-run";
import type { OpenBillingRunInvoice } from "./create-stripe-invoice-for-run";

import { calculateBillingAmountForCycle } from "./calculate-billing-amount";
import { createDraftBillingRunForCycle } from "./create-draft-billing-run";
import { createStripeInvoiceForRun } from "./create-stripe-invoice-for-run";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type DueBillingCycleIdentity = {
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
    dueBillingCycleIdentity: DueBillingCycleIdentity
): Promise<RunDueBillingCycleResult> {

    const billingAmountForCycle: BillingAmountForCycle = await calculateBillingAmountForCycle(
        client,
        dueBillingCycleIdentity.businessBillingCycleId,
        dueBillingCycleIdentity.businessAccountId
    );

    const draftBillingRunForCycleIdentity: DraftBillingRunForCycleIdentity =
        await createDraftBillingRunForCycle(
            client,
            billingAmountForCycle
        );

    const openBillingRunInvoice: OpenBillingRunInvoice
        = await createStripeInvoiceForRun(client, draftBillingRunForCycleIdentity);

    if ( ! openBillingRunInvoice.stripeInvoiceId ) {
        throw new Error(
            `Stripe invoice was not created for billing run ${openBillingRunInvoice.businessBillingRunId}`
        );
    }

    return {
        businessBillingCycleId: draftBillingRunForCycleIdentity.businessBillingCycleId,
        businessAccountId: draftBillingRunForCycleIdentity.businessAccountId,
        billingRunId: draftBillingRunForCycleIdentity.businessBillingRunId,
        stripeInvoiceId: openBillingRunInvoice.stripeInvoiceId,
    };
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


