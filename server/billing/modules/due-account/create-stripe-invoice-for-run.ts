import type { Client } from "pg";
import type Stripe  from "stripe";
import type { DraftBillingRunForCycleIdentity } from "./create-draft-billing-run";

import { stripe } from "../../stripe-client";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type OpenBillingRunInvoice = {
    businessBillingRunId: string;
    stripeInvoiceId: string;
    stripePaymentIntentId: string | null;
    status: "OPEN";
};

type DraftRunForStripe = {
    businessBillingRunId: string;
    businessBillingCycleId: string;
    businessAccountId: string;
    amountMinor: number;
    currency: "GBP";
    periodStart: Date;
    periodEnd: Date;
    stripeCustomerId: string;
};


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


const QUERY_BILLING_RUN_AND_CYCLE_INFORMATION_FOR_STRIPE =
    `
    SELECT
        r.id AS "businessBillingRunId",
        r.business_billing_cycle_id AS "businessBillingCycleId",
        r.business_account_id AS "businessAccountId",
        r.amount_minor AS "amountMinor",
        r.currency,
        r.period_start AS "periodStart",
        r.period_end AS "periodEnd",
        c.stripe_customer_id AS "stripeCustomerId"
    FROM business_billing_runs r
    JOIN business_billing_cycles c
        ON c.id = r.business_billing_cycle_id
    WHERE
        r.id = $1
        AND r.business_billing_cycle_id = $2
        AND r.business_account_id = $3
        AND c.business_account_id = $3
        AND r.status = 'DRAFT';
    `;

const QUERY_UPDATE_BUSINESS_BILLING_RUNS_WITH_FINALIZED_INVOICE =
    `
    UPDATE business_billing_runs
    SET
        stripe_invoice_id = $1,
        stripe_payment_intent_id = $2,
        status = 'OPEN',
        finalized_at = now()
    WHERE 
        id = $3
        AND status = 'DRAFT'
    RETURNING id AS "billing_run_id";
    `;

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


async function getDraftRunForStripe(
    client: Client,
    businessBillingRunId: string,
    businessBillingCycleId: string,
    businessAccountId: string
): Promise<DraftRunForStripe> {

    const result = await client.query<DraftRunForStripe>(
        QUERY_BILLING_RUN_AND_CYCLE_INFORMATION_FOR_STRIPE,
        [businessBillingRunId, businessBillingCycleId, businessAccountId]
    );

    const draftRunForStripe: DraftRunForStripe = result.rows[0];
    if ( ! draftRunForStripe ) {
        throw new Error(`Draft billing run not found: ${businessBillingRunId}`);
    }

    if ( ! draftRunForStripe.stripeCustomerId ) {
        throw new Error(`Billing run ${businessBillingRunId} has no Stripe customer reference.`);
    }

    return draftRunForStripe;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function createStripeInvoiceForRun(
    client: Client,
    {
        businessBillingRunId: businessBillingRunId,
        businessBillingCycleId: businessBillingCycleId,
        businessAccountId: businessAccountId
    }: DraftBillingRunForCycleIdentity
): Promise<OpenBillingRunInvoice> {

    const draftRunForStripe: DraftRunForStripe = await getDraftRunForStripe(
        client,
        businessBillingRunId,
        businessBillingCycleId,
        businessAccountId);

    const invoiceDescription: string =
        `Monthly subscription ${formatDate(draftRunForStripe.periodStart)} to 
        ${formatDate(draftRunForStripe.periodEnd)}.`;
    const invoice = await stripe.invoices.create(
        {
            customer: draftRunForStripe.stripeCustomerId,
            collection_method: "charge_automatically",
            auto_advance: false,
            metadata: {
                billing_run_id: draftRunForStripe.businessBillingRunId,
                billing_cycle_id: draftRunForStripe.businessBillingCycleId,
                business_account_id: draftRunForStripe.businessAccountId
            },
            description: invoiceDescription,
        },
        {
            idempotencyKey: `create-invoice${draftRunForStripe.businessBillingRunId}`
        },
    );

    await stripe.invoiceItems.create(
        {
            customer: draftRunForStripe.stripeCustomerId,
            invoice: invoice.id,
            amount: draftRunForStripe.amountMinor,
            currency: draftRunForStripe.currency.toLowerCase(),
            description: "Probait monthly subscription",
            metadata: {
                billing_run_id: draftRunForStripe.businessBillingRunId,
                billing_cycle_id: draftRunForStripe.businessBillingCycleId,
                business_account_id: draftRunForStripe.businessAccountId
            }
        },
        {
            idempotencyKey: `create-invoice-item:${draftRunForStripe.businessBillingRunId}`
        },
    );

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        {
            auto_advance: true,
            expand: ["payments.data.payment.payment_intent"],
        },
        {
            idempotencyKey: `finalize-invoice:${draftRunForStripe.businessBillingRunId}`,
        },
    );

    const stripePaymentIntentId = getPaymentIntentIdFromInvoice(finalizedInvoice);

    const billingRunUpdateResult = await client.query<{ billing_run_id: string}>(
        QUERY_UPDATE_BUSINESS_BILLING_RUNS_WITH_FINALIZED_INVOICE,
        [finalizedInvoice.id, stripePaymentIntentId, draftRunForStripe.businessBillingRunId]
    );

    if ( ! billingRunUpdateResult.rows[0] ) {
        throw new Error(
            `Could not mark billing run as OPEN: ${draftRunForStripe.businessBillingRunId}`
        );
    }

    return {
        businessBillingRunId: draftRunForStripe.businessBillingRunId,
        stripeInvoiceId: finalizedInvoice.id,
        stripePaymentIntentId,
        status: "OPEN",
    };
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


function getPaymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const invoicePayment =
        invoice.payments?.data.find((payment) => payment.is_default)
        ?? invoice.payments?.data[0];

    const paymentIntent = invoicePayment?.payment.payment_intent;

    if ( ! paymentIntent ) {
        return null;
    }

    if ( typeof paymentIntent === "string" ) {
        return paymentIntent;
    }

    return paymentIntent.id;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


