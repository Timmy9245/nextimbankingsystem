-- ============================================================
-- COMMON QUERIES — analytics and reporting helpers.
-- ============================================================

-- Current balance per account for the signed-in user
SELECT account_number, account_type, balance, status
FROM public.accounts
WHERE customer_id = auth.uid()
ORDER BY created_at;

-- Last 25 transactions for the signed-in user
SELECT created_at, type, amount, balance_after, description, reference
FROM public.transactions
WHERE customer_id = auth.uid()
ORDER BY created_at DESC
LIMIT 25;

-- Monthly spend (debits) for the signed-in user
SELECT date_trunc('month', created_at) AS month,
       SUM(amount) AS total_debits,
       COUNT(*)    AS tx_count
FROM public.transactions
WHERE customer_id = auth.uid()
  AND type IN ('withdrawal','transfer_out','bill_payment','loan_repayment')
GROUP BY 1
ORDER BY 1 DESC;

-- Outstanding loan exposure per customer (admin view; needs service_role)
SELECT customer_id, SUM(outstanding) AS total_outstanding, COUNT(*) AS active_loans
FROM public.loans
WHERE status = 'active'
GROUP BY customer_id
ORDER BY total_outstanding DESC;

-- Recent fraud alerts (admin view; needs service_role)
SELECT created_at, customer_id, reason, details
FROM public.fraud_alerts
ORDER BY created_at DESC
LIMIT 50;

-- Bill payments by category for the signed-in user
SELECT category, COUNT(*) AS payments, SUM(amount) AS total
FROM public.bill_payments
WHERE customer_id = auth.uid()
GROUP BY category
ORDER BY total DESC;
