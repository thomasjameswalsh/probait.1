CREATE TABLE IF NOT EXISTS lead_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL,
    lead_id uuid NOT NULL,

    lead_purchase_id uuid NOT NULL UNIQUE,

    granted_at timestamptz NOT NULL DEFAULT now(),

    lock_owned boolean NOT NULL DEFAULT false,

    active boolean NOT NULL DEFAULT true,

    CONSTRAINT lead_access_grants_business_account_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_access_grants_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_access_grants_purchase_fk
        FOREIGN KEY (lead_purchase_id)
        REFERENCES lead_purchases (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_access_grants_business_lead_unique
        UNIQUE (business_account_id, lead_id)
);

CREATE INDEX IF NOT EXISTS lead_access_grants_lead_idx
    ON lead_access_grants (lead_id);