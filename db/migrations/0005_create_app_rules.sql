CREATE TABLE IF NOT EXISTS app_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    version integer NOT NULL UNIQUE,
    active boolean NOT NULL DEFAULT true,

    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_to timestamptz,

    max_purchases integer NOT NULL DEFAULT 4,
    default_expiry_days integer NOT NULL DEFAULT 7,
    lock_duration_minutes integer NOT NULL DEFAULT 120,
    priority_duration_hours integer NOT NULL DEFAULT 24,

    CONSTRAINT app_rules_version_positive_chk
        CHECK (version > 0),

    CONSTRAINT app_rules_max_purchases_positive_chk
        CHECK (max_purchases > 0),

    CONSTRAINT app_rules_default_expiry_days_positive_chk
        CHECK (default_expiry_days > 0),

    CONSTRAINT app_rules_lock_duration_minutes_positive_chk
        CHECK (lock_duration_minutes > 0),

    CONSTRAINT app_rules_priority_duration_hours_non_negative_chk
        CHECK (priority_duration_hours >= 0),

    CONSTRAINT app_rules_effective_range_chk
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_rules_one_active_idx
    ON app_rules (active)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS app_rules_effective_from_idx
    ON app_rules (effective_from);