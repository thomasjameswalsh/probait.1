CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT schema_migrations_version_not_empty_chk
       CHECK (length(trim(version)) > 0),

    CONSTRAINT schema_migrations_name_not_empty_chk
       CHECK (length(trim(name)) > 0),

    CONSTRAINT schema_migrations_checksum_not_empty_chk
       CHECK (length(trim(checksum)) > 0)
);