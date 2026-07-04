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

    CONSTRAINT lead_locks_lead_access_grant_fk
        FOREIGN KEY (lead_access_grant_id)
        REFERENCES lead_access_grants (id)
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

CREATE OR REPLACE FUNCTION enforce_lead_lock_grant_owns_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM lead_access_grants
        WHERE
            id = NEW.lead_access_grant_id
            AND lock_owned = true
    ) THEN
        RAISE EXCEPTION
            'lead_locks.lead_access_grant_id must reference a lead_access_grant with lock_owned = true';
    END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER lead_locks_enforce_grant_owns_lock
    BEFORE INSERT OR UPDATE OF lead_access_grant_id
    ON lead_locks
        FOR EACH ROW
            EXECUTE FUNCTION enforce_lead_lock_grant_owns_lock();