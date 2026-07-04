CREATE TABLE IF NOT EXISTS lead_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    lead_purchase_attempt_id uuid NOT NULL UNIQUE,

    purchased_at timestamptz NOT NULL DEFAULT now(),
    purchase_type text NOT NULL,

    amount_minor integer NOT NULL,
    currency text NOT NULL DEFAULT 'GBP',
    price_version integer,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lead_purchases_business_account_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_purchases_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_purchases_attempt_fk
        FOREIGN KEY (lead_purchase_attempt_id)
        REFERENCES lead_purchase_attempts (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_purchases_price_version_fk
        FOREIGN KEY (price_version)
        REFERENCES prices (version)
        ON DELETE RESTRICT,

    CONSTRAINT lead_purchases_purchase_type_chk
    CHECK (
        purchase_type IN (
        'LEAD',
        'LOCK',
        'LEAD_AND_LOCK'
        )
    ),

    CONSTRAINT lead_purchases_amount_non_negative_chk
    CHECK (amount_minor >= 0),

    CONSTRAINT lead_purchases_currency_gbp_chk
    CHECK (currency = 'GBP')
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_purchases_one_access_purchase_per_lead_per_business_idx
    ON lead_purchases (business_account_id, lead_id)
    WHERE purchase_type IN ('LEAD', 'LEAD_AND_LOCK');

CREATE INDEX IF NOT EXISTS lead_purchases_business_account_idx
    ON lead_purchases (business_account_id);

CREATE INDEX IF NOT EXISTS lead_purchases_lead_idx
    ON lead_purchases (lead_id);