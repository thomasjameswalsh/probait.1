CREATE TABLE business_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL UNIQUE,

    stripe_subscription_id text NOT NULL UNIQUE,
    stripe_base_subscription_item_id text NOT NULL UNIQUE,
    stripe_postcode_subscription_item_id text UNIQUE,

    stripe_status text NOT NULL,
    postcode_quantity integer NOT NULL DEFAULT 0,

    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,

    cancel_at_period_end boolean NOT NULL DEFAULT false,
    cancel_at timestamptz,
    canceled_at timestamptz,
    ended_at timestamptz,

    past_due_since timestamptz,
    grace_ends_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT business_subscriptions_business_account_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT business_subscriptions_status_chk
        CHECK (
            stripe_status IN (
                'incomplete',
                'incomplete_expired',
                'trialing',
                'active',
                'past_due',
                'canceled',
                'unpaid',
                'paused'
            )
        ),

    CONSTRAINT business_subscriptions_postcode_quantity_chk
        CHECK (postcode_quantity >= 0),

    CONSTRAINT business_subscriptions_postcode_item_chk
        CHECK (
            postcode_quantity = 0
            OR stripe_postcode_subscription_item_id IS NOT NULL
        ),

    CONSTRAINT business_subscriptions_period_chk
        CHECK (current_period_end > current_period_start),

    CONSTRAINT business_subscriptions_grace_period_chk
        CHECK (
            grace_ends_at IS NULL
            OR (
                past_due_since IS NOT NULL
                AND grace_ends_at > past_due_since
            )
        ),

    CONSTRAINT business_subscriptions_stripe_subscription_id_valid_chk
        CHECK (
            length(trim(stripe_subscription_id)) > 0
            AND length(stripe_subscription_id) <= 255
        ),

    CONSTRAINT business_subscriptions_base_item_id_valid_chk
        CHECK (
            length(trim(stripe_base_subscription_item_id)) > 0
            AND length(stripe_base_subscription_item_id) <= 255
        ),

    CONSTRAINT business_subscriptions_postcode_item_id_valid_chk
        CHECK (
            stripe_postcode_subscription_item_id IS NULL
            OR (
                length(trim(stripe_postcode_subscription_item_id)) > 0
                AND length(stripe_postcode_subscription_item_id) <= 255
            )
        )
);

CREATE OR REPLACE TRIGGER business_subscriptions_set_updated_at
    BEFORE UPDATE ON business_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE INDEX business_subscriptions_status_idx
    ON business_subscriptions (stripe_status);

CREATE INDEX business_subscriptions_period_end_idx
    ON business_subscriptions (current_period_end);

CREATE INDEX business_subscriptions_past_due_idx
    ON business_subscriptions (past_due_since)
    WHERE past_due_since IS NOT NULL;