-- Initialize admin revenue record if it doesn't exist
INSERT INTO admin_revenue (total_revenue, withdrawn_amount, available_balance)
SELECT 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM admin_revenue);
