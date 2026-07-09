import type { Client } from "pg";
import type Stripe  from "stripe";

import { stripe } from "./stripe-client";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export type OpenBillingRunInvoice = {
    billing_run_id: string;
    stripeInvoiceId: string;
    stripePaymentIntentId: string | null;
    status: "OPEN";
};

type DraftRunForStripe = {
    billing_run_id: string;
    billing_cycle_id: string;
    business_account_id: string;
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
        r.id AS "billing_run_id",
        r.business_billing_cycle_id AS "billing_cycle_id",
        r.amount_minor AS "amountMinor",
        r.currency,
        r.period_start AS "periodStart",
        r.period_end AS "periodEnd",
        c.business_account_id,
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
    billing_run_id: string,
    billing_cycle_id: string,
    business_account_id: string
): Promise<DraftRunForStripe> {
    const result = await client.query<DraftRunForStripe>(
        QUERY_BILLING_RUN_AND_CYCLE_INFORMATION_FOR_STRIPE,
        [billing_run_id, billing_cycle_id, business_account_id]
    );

    const run = result.rows[0];
    if ( ! run ) {
        throw new Error(`Draft billing run not found: ${billing_run_id}`);
    }

    if ( ! run.stripeCustomerId ) {
        throw new Error(`Billing run ${billing_run_id} has no Stripe customer reference.`);
    }

    return run;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function createStripeInvoiceForRun(
    client: Client,
    billing_run_id: string,
    billing_cycle_id: string,
    billing_account_id: string
): Promise<OpenBillingRunInvoice> {

    const run: DraftRunForStripe = await getDraftRunForStripe(
        client,
        billing_run_id,
        billing_cycle_id,
        billing_account_id);

    const invoiceDescription: string =
        `Monthly subscription ${formatDate(run.periodStart)} to ${formatDate(run.periodEnd)}.`;
    const invoice = await stripe.invoices.create(
        {
            customer: run.stripeCustomerId,
            collection_method: "charge_automatically",
            auto_advance: false,
            metadata: {
                billing_run_id: run.billing_run_id,
                billing_cycle_id: run.billing_cycle_id,
                business_account_id: run.business_account_id
            },
            description: invoiceDescription,
        },
        {
            idempotencyKey: `create-invoice${run.billing_run_id}`
        },
    );

    await stripe.invoiceItems.create(
        {
            customer:run.stripeCustomerId,
            invoice: invoice.id,
            amount: run.amountMinor,
            currency: run.currency.toLowerCase(),
            description: "Probait monthly subscription",
            metadata: {
                billing_run_id: run.billing_run_id,
                billing_cycle_id: run.billing_cycle_id,
                business_account_id: run.business_account_id
            }
        },
        {
            idempotencyKey: `create-invoice-item:${run.billing_run_id}`
        },
    );

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        {
            auto_advance: true,
            expand: ["payments.data.payment.payment_intent"],
        },
        {
            idempotencyKey: `finalize-invoice:${run.billing_run_id}`,
        },
    );

    const stripePaymentIntentId = getPaymentIntentIdFromInvoice(finalizedInvoice);

    const billingRunUpdateResult = await client.query<{ billing_run_id: string}>(
        QUERY_UPDATE_BUSINESS_BILLING_RUNS_WITH_FINALIZED_INVOICE,
        [finalizedInvoice.id, stripePaymentIntentId, run.billing_run_id]
    );

    if ( ! billingRunUpdateResult.rows[0] ) {
        throw new Error(
            `Could not mark billing run as OPEN: ${run.billing_run_id}`
        );
    }

    return {
        billing_run_id: run.billing_run_id,
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

