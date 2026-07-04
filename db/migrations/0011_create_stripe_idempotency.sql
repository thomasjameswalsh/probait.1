CREATE TABLE IF NOT EXISTS stripe_idempotency_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    stripe_event_id text NOT NULL UNIQUE,

    received_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT stripe_idempotency_events_stripe_event_id_valid_chk
    CHECK (
        length(trim(stripe_event_id)) > 0
        AND length(stripe_event_id) <= 255
    )
);