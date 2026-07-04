CREATE TABLE IF NOT EXISTS postcode_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL,

    district_norm text NOT NULL,

    started_at timestamptz NOT NULL,
    first_billing_at timestamptz NOT NULL,

    removal_requested_at timestamptz,
    removal_effective_at timestamptz,

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT business_postcode_subscriptions_business_account_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT business_postcode_subscriptions_district_norm_valid_chk
        CHECK (
            length(trim(district_norm)) > 0
            AND length(district_norm) <= 16
        ),

    CONSTRAINT business_postcode_subscriptions_removal_dates_chk
        CHECK (
            removal_effective_at IS NULL
            OR removal_requested_at IS NOT NULL
        )
);

CREATE OR REPLACE TRIGGER postcode_subscriptions_set_updated_at
BEFORE UPDATE ON postcode_subscriptions
FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS postcode_subscriptions_business_district_uidx
    ON postcode_subscriptions (business_account_id, district_norm)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS postcode_subscriptions_active_business_idx
    ON postcode_subscriptions (business_account_id)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS postcode_subscriptions_removal_effective_idx
    ON postcode_subscriptions (removal_effective_at)
    WHERE active = true
    AND removal_effective_at IS NOT NULL;