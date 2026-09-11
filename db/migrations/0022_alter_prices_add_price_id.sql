ALTER TABLE prices
    ADD COLUMN base_subscription_stripe_price_id text,
    ADD COLUMN postcode_subscription_stripe_price_id text,
    ADD COLUMN lock_stripe_price_id text,
    ADD COLUMN lead_stripe_price_id text;

CREATE CONSTRAINT prices_base_subscription_stripe_price_id_valid_chk
    ON prices
    CHECK (
        base_subscription_stripe_price_id IS NULL
        OR (
            length(trim(base_subscription_stripe_price_id)) > 0
            AND length(base_subscription_stripe_price_id) <= 255
        )
    );

CREATE CONSTRAINT prices_postcode_subscription_stripe_price_id_valid_chk
    ON prices
    CHECK (
        postcode_subscription_stripe_price_id IS NULL
        OR (
            length(trim(postcode_subscription_stripe_price_id)) > 0
            AND length(postcode_subscription_stripe_price_id) <= 255
        )
    );

CREATE CONSTRAINT prices_lock_stripe_price_id_valid_chk
    ON prices
    CHECK (
        lock_stripe_price_id IS NULL
        OR (
            length(trim(lock_stripe_price_id)) > 0
            AND length(lock_stripe_price_id) <= 255
        )
    );

CREATE CONSTRAINT prices_lead_stripe_price_id_valid_chk
    ON prices
    CHECK (
        lead_stripe_price_id IS NULL
        OR (
            length(trim(lead_stripe_price_id)) > 0
            AND length(lead_stripe_price_id) <= 255
        )
    );

CREATE UNIQUE INDEX prices_base_subscription_stripe_price_id_uidx
    ON prices (base_subscription_stripe_price_id)
    WHERE base_subscription_stripe_price_id IS NOT NULL;

CREATE UNIQUE INDEX prices_postcode_subscription_stripe_price_id_uidx
    ON prices (postcode_subscription_stripe_price_id)
    WHERE postcode_subscription_stripe_price_id IS NOT NULL;

CREATE UNIQUE INDEX prices_lock_stripe_price_id_uidx
    ON prices (lock_stripe_price_id)
    WHERE lock_stripe_price_id IS NOT NULL;

CREATE UNIQUE INDEX prices_lead_stripe_price_id_uidx
    ON prices (lead_stripe_price_id)
    WHERE lead_stripe_price_id IS NOT NULL;