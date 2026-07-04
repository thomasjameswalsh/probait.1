CREATE TABLE IF NOT EXISTS business_billing_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_billing_cycle_id uuid NOT NULL,
    business_account_id uuid NOT NULL,

    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,

    amount_minor integer NOT NULL,
    currency text NOT NULL DEFAULT 'GBP',

    status text NOT NULL DEFAULT 'DRAFT',

    finalized_at timestamptz,
    paid_at timestamptz,
    marked_uncollectible_at timestamptz,
    voided_at timestamptz,

    last_payment_failed_at timestamptz,
    last_payment_failure_reason text,

    stripe_attempt_count integer NOT NULL DEFAULT 0,
    stripe_next_payment_attempt_at timestamptz,

    stripe_invoice_id text UNIQUE,
    stripe_payment_intent_id text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT business_billing_runs_business_account_id_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT business_billing_runs_cycle_id_run_id_unique
        UNIQUE (business_billing_cycle_id, id),

    CONSTRAINT business_billing_runs_period_order_chk
        CHECK (period_end > period_start),

    CONSTRAINT business_billing_runs_amount_non_negative_chk
        CHECK (amount_minor >= 0),

    CONSTRAINT business_billing_runs_currency_chk
        CHECK (
            length(trim(currency)) > 0
            AND currency = upper(currency)
            AND length(currency) = 3
        ),

    CONSTRAINT business_billing_runs_status_chk
        CHECK (status IN ('DRAFT', 'OPEN', 'PAID', 'UNCOLLECTIBLE', 'VOID')),

    CONSTRAINT business_billing_runs_finalized_status_chk
        CHECK (
            status = 'DRAFT'
            OR finalized_at IS NOT NULL
        ),

    CONSTRAINT business_billing_runs_paid_status_chk
        CHECK (
            (status = 'PAID' AND paid_at IS NOT NULL)
            OR (status <> 'PAID' AND paid_at IS NULL)
        ),

    CONSTRAINT business_billing_runs_uncollectible_status_chk
        CHECK (
            (status = 'UNCOLLECTIBLE' AND marked_uncollectible_at IS NOT NULL)
            OR (status <> 'UNCOLLECTIBLE' AND marked_uncollectible_at IS NULL)
        ),

    CONSTRAINT business_billing_runs_void_status_chk
        CHECK (
            (status = 'VOID' AND voided_at IS NOT NULL)
            OR (status <> 'VOID' AND voided_at IS NULL)
        ),

    CONSTRAINT business_billing_runs_terminal_status_exclusive_chk
        CHECK (
            num_nonnulls(paid_at, marked_uncollectible_at, voided_at) <= 1
        ),

    CONSTRAINT business_billing_runs_stripe_attempt_count_non_negative_chk
        CHECK ( stripe_attempt_count >= 0 ),

    CONSTRAINT business_billing_runs_last_payment_failure_reason_valid_chk
        CHECK (
            last_payment_failure_reason IS NULL
            OR (
                length(trim(last_payment_failure_reason)) > 0
                AND length(last_payment_failure_reason) <= 1000
            )
        ),

    CONSTRAINT business_billing_runs_stripe_invoice_id_valid_chk
        CHECK (
            stripe_invoice_id IS NULL
            OR (
                length(trim(stripe_invoice_id)) > 0
                AND length(stripe_invoice_id) <= 255
            )
        ),

    CONSTRAINT business_billing_runs_stripe_payment_intent_id_valid_chk
        CHECK (
            stripe_payment_intent_id IS NULL
            OR (
                length(trim(stripe_payment_intent_id)) > 0
                AND length(stripe_payment_intent_id) <= 255
            )
        )
);

CREATE OR REPLACE TRIGGER business_billing_runs_set_updated_at
    BEFORE UPDATE ON business_billing_runs
    FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS business_billing_runs_cycle_idx
    ON business_billing_runs (business_billing_cycle_id);

CREATE INDEX IF NOT EXISTS business_billing_runs_business_account_idx
    ON business_billing_runs (business_account_id);

CREATE INDEX IF NOT EXISTS business_billing_runs_status_idx
    ON business_billing_runs (status);

CREATE INDEX IF NOT EXISTS business_billing_runs_cycle_open_idx
    ON business_billing_runs (business_billing_cycle_id, status)
    WHERE status in ('DRAFT', 'OPEN');

CREATE UNIQUE INDEX IF NOT EXISTS business_billing_runs_cycle_period_uidx
    ON business_billing_runs (business_billing_cycle_id, period_start, period_end);