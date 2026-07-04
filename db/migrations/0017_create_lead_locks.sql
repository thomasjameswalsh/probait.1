CREATE TABLE IF NOT EXISTS lead_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    business_account_id uuid NOT NULL,
    lead_id uuid NOT NULL,

    lead_access_grant_id uuid NOT NULL UNIQUE,

    locked_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,

    CONSTRAINT lead_locks_business_account_fk
        FOREIGN KEY (business_account_id)
        REFERENCES business_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_locks_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_locks_purchase_fk
        FOREIGN KEY (lead_purchase_id)
        REFERENCES lead_purchases (id)
        ON DELETE RESTRICT,

    CONSTRAINT lead_locks_expires_after_locked_chk
        CHECK (expires_at > locked_at),

    CONSTRAINT lead_locks_no_overlapping_lock_per_lead_excl
        EXCLUDE USING gist (
            lead_id WITH =,
            tstzrange(locked_at, expires_at, '[)') WITH &&
        )
);

CREATE INDEX IF NOT EXISTS lead_locks_lead_expires_at_idx
    ON lead_locks (lead_id, expires_at);

CREATE INDEX IF NOT EXISTS lead_locks_business_lead_expires_at_idx
    ON lead_locks (business_account_id, lead_id, expires_at);