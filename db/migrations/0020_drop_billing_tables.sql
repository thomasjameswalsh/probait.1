ALTER TABLE business_billing_runs
    DROP CONSTRAINT IF EXISTS business_billing_runs_business_billing_cycle_fk;

ALTER TABLE business_billing_cycles
    DROP CONSTRAINT IF EXISTS business_billing_cycles_last_billing_run_fk;

DROP TABLE business_billing_runs;
DROP TABLE business_billing_cycles;