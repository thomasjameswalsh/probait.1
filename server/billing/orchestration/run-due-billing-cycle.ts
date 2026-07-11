import type { Client } from "pg";

import type { BillingAmountForCycle } from "../modules/due-account/calculate-billing-amount";
import type { DraftBillingRunForCycleIdentity } from "../modules/due-account/create-draft-billing-run";
import type { OpenBillingRunInvoice } from "../modules/due-account/create-stripe-invoice-for-run";

import { calculateBillingAmountForCycle } from "../modules/due-account/calculate-billing-amount";
import { createDraftBillingRunForCycle } from "../modules/due-account/create-draft-billing-run";
import { createStripeInvoiceForRun } from "../modules/due-account/create-stripe-invoice-for-run";


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


