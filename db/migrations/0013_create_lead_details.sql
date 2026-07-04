CREATE TABLE IF NOT EXISTS lead_probate_details (
    lead_id uuid PRIMARY KEY,

    has_will boolean,
    estate_value_band text,
    includes_property boolean,
    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lead_probate_details_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE RESTRICT
);

CREATE OR REPLACE TRIGGER lead_probate_details_set_updated_at
    BEFORE UPDATE ON lead_probate_details
    FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS lead_self_assessment_tax_details (
    lead_id uuid PRIMARY KEY,

    client_type text,
    tax_years_in_scope text,
    income_sources_summary text,
    urgency_rating text,
    has_hmrc_deadline_issue boolean,
    deadline_date date,
    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lead_self_assessment_tax_details_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE RESTRICT
);

CREATE OR REPLACE TRIGGER lead_self_assessment_tax_details_set_updated_at
    BEFORE UPDATE ON lead_self_assessment_tax_details
    FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS lead_capital_gains_tax_details (
    lead_id uuid PRIMARY KEY,

    asset_type text,
    disposal_completed boolean,
    has_hmrc_deadline_issue boolean NOT NULL DEFAULT false,
    deadline_date date,
    urgency_rating text,
    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lead_capital_gains_tax_details_lead_fk
        FOREIGN KEY (lead_id)
        REFERENCES leads (id)
        ON DELETE RESTRICT
);

CREATE OR REPLACE TRIGGER lead_capital_gains_tax_details_set_updated_at
    BEFORE UPDATE ON lead_capital_gains_tax_details
    FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();