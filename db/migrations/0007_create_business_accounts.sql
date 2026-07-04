CREATE TABLE IF NOT EXISTS business_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    clerk_user_id text NOT NULL UNIQUE,
    business_name text NOT NULL,

    contact_forenames text,
    contact_surname text NOT NULL,
    notification_email text NOT NULL,
    phone_e164 text,
    companies_house_number text,

    active boolean NOT NULL DEFAULT true,
    features_suspended_at timestamptz,
    closed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT business_accounts_contact_forenames_valid_chk
        CHECK (
            contact_forenames IS NULL
            OR (
                length(trim(contact_forenames)) > 0
                AND length(contact_forenames) <= 255
            )
        ),

    CONSTRAINT business_accounts_contact_surname_valid_chk
        CHECK (
            length(trim(contact_surname)) > 0
            AND length(contact_surname) <= 255
        ),

    CONSTRAINT business_accounts_clerk_user_id_valid_chk
        CHECK (
            length(trim(clerk_user_id)) > 0
            AND length(clerk_user_id) <= 255
        ),

    CONSTRAINT business_accounts_business_name_valid_chk
        CHECK (
            length(trim(business_name)) > 0
            AND length(business_name) <= 255
        ),

    CONSTRAINT business_accounts_notification_email_valid_chk
        CHECK (
            length(trim(notification_email)) > 0
            AND length(notification_email) <= 320
        ),

    CONSTRAINT business_accounts_phone_e164_valid_chk
        CHECK (
            phone_e164 IS NULL
            OR (
                length(trim(phone_e164)) > 0
                AND length(phone_e164) <= 32 )
        ),

    CONSTRAINT business_accounts_companies_house_number_valid_chk
        CHECK (
            companies_house_number IS NULL
            OR (
                length(trim(companies_house_number)) > 0
                AND length(companies_house_number) <= 32 )
        ),

    CONSTRAINT business_accounts_active_requires_not_closed_chk
        CHECK (
            active = false
            OR closed_at IS NULL
        )
);

CREATE OR REPLACE TRIGGER business_accounts_set_updated_at
    BEFORE UPDATE ON business_accounts
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS business_accounts_clerk_user_id_idx
    ON business_accounts (clerk_user_id);

CREATE INDEX IF NOT EXISTS business_accounts_active_idx
    ON business_accounts (active);

CREATE INDEX IF NOT EXISTS business_accounts_notification_email_idx
    ON business_accounts (notification_email);