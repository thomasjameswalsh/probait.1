CREATE TABLE IF NOT EXISTS business_billing_cycles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL UNIQUE,

    active boolean NOT NULL DEFAULT true,

    billing_state text NOT NULL DEFAULT 'ACTIVE',

    billing_anchor_day integer NOT NULL,

    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,

    last_billed_at timestamptz,
    last_billing_run_id uuid,

    past_due_since timestamptz,

    cancellation_requested_at timestamptz,
    ends_at timestamptz,
    ended_at timestamptz,

    stripe_customer_id text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT business_billing_cycle_business_account_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT business_billing_cycles_id_business_account_unique
        UNIQUE (id, business_account_id),

    CONSTRAINT business_billing_cycles_last_billing_run_fk
        FOREIGN KEY (id, last_billing_run_id)
        REFERENCES business_billing_runs (business_billing_cycle_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT business_billing_cycles_billing_state_chk
        CHECK (billing_state IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'ENDED')),

    CONSTRAINT business_billing_cycles_billing_anchor_day_chk
        CHECK (billing_anchor_day BETWEEN 1 AND 31),

    CONSTRAINT business_billing_cycles_current_period_order_chk
        CHECK (current_period_start < current_period_end),

    CONSTRAINT business_billing_cycles_past_due_state_chk
        CHECK (
            (
                billing_state <> 'PAST_DUE'
                OR past_due_since IS NOT NULL
            )
            AND (
                past_due_since IS NULL
                OR billing_state IN ('PAST_DUE', 'ENDED')
            )
        ),

    CONSTRAINT business_billing_cycles_cancelled_state_chk
        CHECK (
            billing_state <> 'CANCELLED'
            OR (
                cancellation_requested_at IS NOT NULL
                AND ends_at IS NOT NULL
            )
        ),

    CONSTRAINT business_billing_cycles_cancellation_requested_at_state_chk
        CHECK (
            cancellation_requested_at IS NULL
            OR billing_state IN ('CANCELLED', 'ENDED')
        ),

    CONSTRAINT business_billing_cycles_ends_requires_cancellation_chk
        CHECK (
            ends_at IS NULL
            OR cancellation_requested_at IS NOT NULL
        ),

    CONSTRAINT business_billing_cycles_ended_state_chk
        CHECK (
            (
                billing_state <> 'ENDED'
                OR (
                    active = false
                    AND ended_at IS NOT NULL
                )
            )
            AND (
                ended_at IS NULL
                OR billing_state = 'ENDED'
            )
        ),

    CONSTRAINT business_billing_cycles_active_state_chk
        CHECK (
            billing_state <> 'ACTIVE'
            OR (
                active = true
                AND past_due_since IS NULL
                AND cancellation_requested_at IS NULL
                AND ends_at IS NULL
                AND ended_at IS NULL
            )
        ),

    CONSTRAINT business_billing_cycles_stripe_customer_id_valid_chk
        CHECK (
            stripe_customer_id IS NULL
            OR (
                length(trim(stripe_customer_id)) > 0
                AND length(stripe_customer_id) <= 255
            )
        )
);

CREATE OR REPLACE TRIGGER business_billing_cycles_set_updated_at
    BEFORE UPDATE ON business_billing_cycles
    FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS business_billing_cycles_active_idx
    ON business_billing_cycles (active);

CREATE INDEX IF NOT EXISTS business_billing_cycles_billing_state_idx
    ON business_billing_cycles (billing_state);

CREATE INDEX IF NOT EXISTS business_billing_cycles_current_period_end_idx
    ON business_billing_cycles (current_period_end)
    WHERE active = true
    AND billing_state = 'ACTIVE';

CREATE INDEX IF NOT EXISTS business_billing_cycles_past_due_idx
    ON business_billing_cycles (past_due_since)
    WHERE active = true
    AND billing_state = 'PAST_DUE';

CREATE UNIQUE INDEX IF NOT EXISTS business_billing_cycles_stripe_customer_id_uidx
    ON business_billing_cycles (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;