CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    reference_code text NOT NULL UNIQUE,

    lead_type text NOT NULL,

    active boolean NOT NULL DEFAULT true,

    postcode_full text NOT NULL,
    district_norm text NOT NULL,

    customer_forenames text,
    customer_surname text NOT NULL,
    customer title text,

    phone_e164 text NOT NULL,
    email text,

    activated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,

    priority_ends_at timestamptz,

    purchase_count integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT leads_reference_code_length_chk
    CHECK (
        length(trim(reference_code)) > 0
        AND length(reference_code) <= 255
    ),

    CONSTRAINT leads_lead_type_valid_chk
    CHECK (
        lead_type IN (
            'PROBATE',
            'SELF_ASSESSMENT_TAX',
            'CAPITAL_GAINS_TAX'
        )
    ),

    CONSTRAINT leads_customer_first_name_valid_chk
        CHECK (
            customer_forenames IS NULL
            OR (
                length(trim(customer_forenames)) > 0
                AND length(customer_forenames) <= 255
            )
        ),

    CONSTRAINT leads_customer_last_name_valid_chk
        CHECK (
            length(trim(customer_surname)) > 0
            AND length(customer_surname) <= 255
        ),

    CONSTRAINT leads_customer_title_valid_chk
        CHECK (
            customer_title IS NULL
            OR (
                length(trim(customer_title)) > 0
                AND length(customer_title) <= 32
            )
        )

    CONSTRAINT leads_postcode_full_length_chk
    CHECK (
        length(trim(postcode_full)) > 0
        AND length(postcode_full) <= 16
    ),

    CONSTRAINT leads_district_norm_length_chk
    CHECK (
        length(trim(district_norm)) > 0
        AND length(district_norm) <= 16
    ),

    CONSTRAINT leads_phone_e164_length_chk
    CHECK (
        length(trim(phone_e164)) > 0
        AND length(phone_e164) <= 32
    ),

    CONSTRAINT leads_email_length_chk
    CHECK (
        email IS NULL
        OR (
            length(trim(email)) > 0
            AND length(email) <= 255
        )
    ),

    CONSTRAINT leads_expires_after_activated_chk
    CHECK (expires_at > activated_at),

    CONSTRAINT leads_priority_after_activated_chk
    CHECK (
        priority_ends_at IS NULL
        OR priority_ends_at >= activated_at
    ),

    CONSTRAINT leads_purchase_count_non_negative_chk
    CHECK (purchase_count >= 0)
);

CREATE OR REPLACE TRIGGER leads_set_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS leads_active_priority_pool_idx
    ON leads (district_norm, priority_ends_at)
    WHERE active = true
    AND priority_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_lead_type_idx
    ON leads (lead_type);

CREATE INDEX IF NOT EXISTS leads_expires_at_idx
    ON leads (expires_at);