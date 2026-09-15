ALTER TABLE prices 
    ADD COLUMN lead_and_lock_minor INTEGER NOT NULL DEFAULT 2400;

ALTER TABLE prices
    ADD CONSTRAINT prices_lead_and_lock_nonnegative_chk
    CHECK (lead_and_lock_minor >= 0);

ALTER TABLE prices
    ADD COLUMN lead_and_lock_stripe_price_id text;

ALTER TABLE prices
    ADD CONSTRAINT prices_lead_and_lock_stripe_price_id_valid_chk
    CHECK (
        lead_and_lock_stripe_price_id IS NULL
        OR (
            length(trim(lead_and_lock_stripe_price_id)) > 0
            AND length(lead_and_lock_stripe_price_id) <= 255
        )
    );

CREATE UNIQUE INDEX prices_lead_and_lock_stripe_price_id_uidx
    ON prices (lead_and_lock_stripe_price_id)
    WHERE lead_and_lock_stripe_price_id IS NOT NULL;