ALTER TABLE business_billing_runs
    ADD CONSTRAINT business_billing_runs_business_billing_cycle_fk
        FOREIGN KEY (business_billing_cycle_id, business_account_id)
        REFERENCES business_billing_cycles (id, business_account_id)
        ON DELETE RESTRICT;