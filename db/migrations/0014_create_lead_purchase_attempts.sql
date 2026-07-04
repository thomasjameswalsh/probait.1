CREATE TABLE IF NOT EXISTS lead_purchase_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL,
    lead_id uuid NOT NULL,

    purchase_type text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING_PAYMENT',

    amount_minor integer NOT NULL,
    currency text NOT NULL DEFAULT 'GBP',

    price_version integer,

    stripe_payment_intent_id text UNIQUE,
    stripe_checkout_session_id text UNIQUE,

    expires_at timestamptz,

    succeeded_at timestamptz,
    failed_at timestamptz,
    cancelled_at timestamptz,
    expired_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lead_purchase_attempts_business_account_fk
        FOREIGN KEY (business_account_id)
            REFERENCES business_accounts (id)
            ON DELETE RESTRICT,

    CONSTRAINT lead_purchase_attempts_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
            ON DELETE RESTRICT,

    CONSTRAINT lead_purchase_attempts_price_version_fk
        FOREIGN KEY (price_version)
        REFERENCES prices (version)
            ON DELETE RESTRICT,

    CONSTRAINT lead_purchase_attempts_purchase_type_chk
    CHECK (
        purchase_type IN (
        'LEAD',
        'LOCK',
        'LEAD_AND_LOCK'
        )
    ),

    CONSTRAINT lead_purchase_attempts_status_chk
    CHECK (
        status IN (
        'PENDING_PAYMENT',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
        'EXPIRED'
        )
    ),

    CONSTRAINT lead_purchase_attempts_amount_non_negative_chk
    CHECK (amount_minor >= 0),

    CONSTRAINT lead_purchase_attempts_currency_gbp_chk
    CHECK (currency = 'GBP'),

    CONSTRAINT lead_purchase_attempts_succeeded_at_chk
    CHECK (
        status <> 'SUCCEEDED'
        OR succeeded_at IS NOT NULL
    ),

    CONSTRAINT lead_purchase_attempts_failed_at_chk
    CHECK (
        status <> 'FAILED'
        OR failed_at IS NOT NULL
    ),

    CONSTRAINT lead_purchase_attempts_cancelled_at_chk
    CHECK (
        status <> 'CANCELLED'
        OR cancelled_at IS NOT NULL
    ),

    CONSTRAINT lead_purchase_attempts_expired_at_chk
    CHECK (
        status <> 'EXPIRED'
        OR expired_at IS NOT NULL
    ),

    CONSTRAINT lead_purchase_attempts_single_terminal_event_chk
    CHECK (
        num_nonnulls(
        succeeded_at,
        failed_at,
        cancelled_at,
        expired_at) <= 1
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_purchase_attempts_one_pending_lock_per_lead_idx
    ON lead_purchase_attempts (lead_id)
    WHERE status = 'PENDING_PAYMENT'
    AND purchase_type IN ('LOCK', 'LEAD_AND_LOCK');

CREATE INDEX IF NOT EXISTS lead_purchase_attempts_business_account_idx
    ON lead_purchase_attempts (business_account_id);

CREATE INDEX IF NOT EXISTS lead_purchase_attempts_lead_idx
    ON lead_purchase_attempts (lead_id);

CREATE INDEX IF NOT EXISTS lead_purchase_attempts_status_expires_idx
    ON lead_purchase_attempts (status, expires_at);

CREATE OR REPLACE TRIGGER lead_purchase_attempts_set_updated_at
    BEFORE UPDATE ON lead_purchase_attempts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();