ALTER TABLE business_account
	ADD COLUMN stripe_customer_id text;

ALTER TABLE business_accounts
	ADD CONSTRAINT business_accounts_stripe_customer_id_valid_chk
	CHECK (
		stripe_customer_id IS NULL
		OR (
			length(trim(stripe_customer_id)) > 0
			AND length(stripe_customer_id) <= 255
		)
	);

CREATE UNIQUE INDEX business_accounts_stripe_customer_id_uidx
	ON business_accounts (stripe_customer_id)
	WHERE stripe_customer_id IS NOT NULL;
