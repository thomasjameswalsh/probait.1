ALTER TABLE lead_purchase_attempts DROP CONSTRAINT lead_purchase_attempts_status_chk;
ALTER TABLE lead_purchase_attempts ADD CONSTRAINT lead_purchase_attempts_status_chk
    CHECK (
        status IN (
            'PENDING',
            'SUCCEEDED',
            'FAILED',
            'CANCELLED',
            'EXPIRED'
        )
    );

ALTER TABLE lead_purchase_attempts ALTER COLUMN status SET DEFAULT 'PENDING';

DROP INDEX lead_purchase_attempts_one_pending_lock_per_lead_idx;

CREATE UNIQUE INDEX lead_purchase_attempts_one_pending_lock_per_lead_idx
    ON lead_purchase_attempts (lead_id)
    WHERE status = 'PENDING'
    AND purchase_type IN ('LOCK', 'LEAD_AND_LOCK');