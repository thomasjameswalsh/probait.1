CREATE TABLE IF NOT EXISTS prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    version integer NOT NULL UNIQUE,
    active boolean NOT NULL DEFAULT true,

    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_to timestamptz,

    base_subscription_minor integer NOT NULL DEFAULT 3200,
    postcode_subscription_minor integer NOT NULL DEFAULT 2400,
    lock_minor integer NOT NULL DEFAULT 1200,
    lead_minor integer NOT NULL DEFAULT 1600,

    currency text NOT NULL DEFAULT 'GBP',

    CONSTRAINT prices_currency_gbp_chk
        CHECK (currency = 'GBP'),

    CONSTRAINT prices_version_positive_chk
        CHECK (version > 0),

    CONSTRAINT prices_base_subscription_non_negative_chk
        CHECK (base_subscription_minor >= 0),

    CONSTRAINT prices_priority_subscription_non_negative_chk
        CHECK (priority_subscription_minor >= 0),

    CONSTRAINT prices_lock_non_negative_chk
        CHECK (lock_minor >= 0),

    CONSTRAINT prices_lead_non_negative_chk
        CHECK (lead_minor >= 0),

    CONSTRAINT prices_currency_uppercase_chk
        CHECK (currency = upper(currency)),

    CONSTRAINT prices_effective_range_chk
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS prices_one_active_idx
    ON prices (active)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS prices_effective_from_idx
    ON prices (effective_from);