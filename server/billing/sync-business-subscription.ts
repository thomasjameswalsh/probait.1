const QUERY_UPSERT_BUSINESS_SUBSCRIPTION =
    `
    INSERT INTO business_subscriptions(
        business_account_id,
        stripe_subscription_id,
        stripe_base_subscription_item_id,
        stripe_postcode_subscription_item_id,
        stripe_status,
        postcode_quantity,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        cancel_at,
        canceled_at,
        ended_at,
    ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
    )
    ON CONFLICT (business_account_id)
    DO UPDATE SET
        stripe_base_subscription_item_id =
            EXCLUDED.stripe_base_subscription_item_id,
        stripe_postcode_subscription_item_id =
            EXCLUDED.stripe_postcode_subscription_item_id,
        stripe_status = EXCLUDED.stripe_status,
        postcode_quantity = EXCLUDED.postcode_quantity,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        cancel_at = EXCLUDED.cancel_at,
        ended_at = EXCLUDED.ended_at
    WHERE
        business_subscriptions.stripe_subscription_id =
            EXCLUDED.stripe_subscription_id
    RETURNING id;
    `;

type BusinessSubscriptionStateRow = {
    business_account_id: string,
    stripe_subscription_id: string | null,
    stripe_status: string | null,
    past_due_since: Date
};

