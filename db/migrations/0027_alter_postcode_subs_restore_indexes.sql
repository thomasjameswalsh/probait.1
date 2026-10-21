DROP INDEX IF EXISTS postcode_subscriptions_business_district_uidx;
DROP INDEX IF EXISTS postcode_subscriptions_active_business_idx;
DROP INDEX IF EXISTS postcode_subscriptions_removal_effective_idx;

ALTER TABLE postcode_subscriptions
ADD CONSTRAINT postcode_subscriptions_period_valid_chk
    CHECK (
        removal_effective_at IS NULL
        OR removal_effective_at >= started_at
    );

ALTER TABLE postcode_subscriptions
ADD CONSTRAINT postcode_subscriptions_no_overlap_excl
    EXCLUDE USING gist (
        business_account_id WITH =,
        district_norm WITH =,
        tstzrange(
            started_at,
            removal_effective_at,
            '[)'
        ) WITH &&
    );

CREATE INDEX IF NOT EXISTS postcode_subscriptions_business_district_idx
    ON postcode_subscriptions (business_account_id, district_norm);