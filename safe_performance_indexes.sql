-- Safe, additive indexes for high-frequency list and reporting queries.
-- Review and run once through the normal Supabase migration process.
-- No table data is updated, deleted, or recreated by this migration.

CREATE INDEX IF NOT EXISTS idx_inbound_transactions_inbound_date
  ON inbound_transactions (inbound_date DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_transactions_outbound_date
  ON outbound_transactions (outbound_date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_order_date
  ON orders (order_date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_pending_approved_product
  ON orders (product_id)
  WHERE status IN ('pending', 'approved');
