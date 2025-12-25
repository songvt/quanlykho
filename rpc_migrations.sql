-- =============================================
-- 1. Dashboard Statistics Function (RPC)
-- =============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    total_products_count INT;
    total_inventory_quantity INT;
    low_stock_count INT;
    out_of_stock_count INT;
    recent_transactions JSON;
    weekly_stats JSON;
    category_stats JSON;
BEGIN
    -- 1. Total Products
    SELECT COUNT(*) INTO total_products_count FROM products;

    -- 2. Inventory Stats (Total Quantity, Low Stock, Out of Stock)
    -- We'll use a temporary result set for inventory by product
    WITH stock_summary AS (
        SELECT 
            p.id,
            COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(o.quantity), 0) as current_stock
        FROM products p
        LEFT JOIN inbound_transactions i ON p.id = i.product_id
        LEFT JOIN outbound_transactions o ON p.id = o.product_id
        GROUP BY p.id
    )
    SELECT 
        COALESCE(SUM(current_stock), 0),
        COUNT(*) FILTER (WHERE current_stock > 0 AND current_stock < 10), -- Low stock threshold < 10
        COUNT(*) FILTER (WHERE current_stock <= 0)
    INTO 
        total_inventory_quantity,
        low_stock_count,
        out_of_stock_count
    FROM stock_summary;

    -- 3. Recent Transactions (Last 5)
    SELECT json_agg(t) INTO recent_transactions
    FROM (
        (
            SELECT 
                i.id,
                i.inbound_date as date, 
                i.quantity, 
                'inbound' as type, 
                p.name as product_name
            FROM inbound_transactions i
            JOIN products p ON i.product_id = p.id
            ORDER BY i.inbound_date DESC
            LIMIT 5
        )
        UNION ALL
        (
            SELECT 
                o.id,
                o.outbound_date as date, 
                o.quantity, 
                'outbound' as type, 
                p.name as product_name
            FROM outbound_transactions o
            JOIN products p ON o.product_id = p.id
            ORDER BY o.outbound_date DESC
            LIMIT 5
        )
        ORDER BY date DESC
        LIMIT 5
    ) t;

    -- 4. Weekly Stats (Last 7 days)
    SELECT json_agg(ws) INTO weekly_stats
    FROM (
        SELECT
            to_char(d.day, 'YYYY-MM-DD') as date,
            COALESCE(SUM(i.quantity), 0) as inbound,
            COALESCE(SUM(o.quantity), 0) as outbound
        FROM (SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date as day) d
        LEFT JOIN inbound_transactions i ON date_trunc('day', i.inbound_date) = d.day
        LEFT JOIN outbound_transactions o ON date_trunc('day', o.outbound_date) = d.day
        GROUP BY d.day
        ORDER BY d.day
    ) ws;
    
    -- 5. Category Distribution
    SELECT json_agg(cs) INTO category_stats
    FROM (
        SELECT category as name, COUNT(*) as value
        FROM products
        WHERE category IS NOT NULL
        GROUP BY category
    ) cs;

    -- Return Consolidated JSON
    RETURN json_build_object(
        'total_products', total_products_count,
        'total_inventory', total_inventory_quantity,
        'low_stock_items', low_stock_count,
        'out_of_stock_items', out_of_stock_count,
        'recent_transactions', COALESCE(recent_transactions, '[]'::json),
        'weekly_stats', COALESCE(weekly_stats, '[]'::json),
        'category_stats', COALESCE(category_stats, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- 2. FIFO Inventory Aging Function (RPC)
-- =============================================
CREATE OR REPLACE FUNCTION get_fifo_inventory_aging()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(item) INTO result
    FROM (
        WITH product_outbound AS (
            SELECT product_id, SUM(quantity) as total_out
            FROM outbound_transactions
            GROUP BY product_id
        ),
        product_inbound AS (
            SELECT 
                i.id,
                i.product_id,
                p.name as product_name,
                p.item_code,
                i.quantity,
                i.inbound_date,
                i.serial_code,
                COALESCE(po.total_out, 0) as total_out_for_product,
                SUM(i.quantity) OVER (PARTITION BY i.product_id ORDER BY i.inbound_date ASC) as cum_inbound
            FROM inbound_transactions i
            JOIN products p ON i.product_id = p.id
            LEFT JOIN product_outbound po ON i.product_id = po.product_id
        )
        SELECT 
            id,
            product_name,
            item_code,
            inbound_date,
            serial_code,
            -- Logic:
            -- If (cum_inbound - quantity) >= total_out, then this whole batch is available.
            -- If (cum_inbound > total_out) AND (cum_inbound - quantity < total_out), then partial batch available.
            -- If cum_inbound <= total_out, then this batch is fully consumed.
            CASE 
                WHEN (cum_inbound - quantity) >= total_out_for_product THEN quantity
                ELSE cum_inbound - total_out_for_product
            END as quantity_remaining,
            EXTRACT(DAY FROM (NOW() - inbound_date)) as days_in_stock
        FROM product_inbound
        WHERE cum_inbound > total_out_for_product -- Only keep items that haven't been fully consumed
        ORDER BY days_in_stock DESC
    ) item;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql;
