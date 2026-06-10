-- ============================================================
-- SAMPLE INSERTS — reference only.
-- Real user data is inserted by the app through RPC procedures
-- (sp_deposit, sp_transfer, sp_pay_bill, ...) and by signup triggers.
-- ============================================================

-- A new auth user automatically gets a profile via handle_new_user().
-- After that, the app inserts an account row when the user opens one:

INSERT INTO public.accounts (customer_id, account_type, account_number)
VALUES ('00000000-0000-0000-0000-000000000001', 'savings', '');
-- (account_number is auto-filled by the BEFORE INSERT trigger)

-- Sample deposit (do NOT call directly in production — use sp_deposit RPC):
INSERT INTO public.transactions
  (account_id, customer_id, type, amount, balance_after, description, reference)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000001',
   'deposit', 5000.00, 5000.00, 'Initial deposit', 'DEP-DEMO-001');

-- Sample bill payment row written by sp_pay_bill():
INSERT INTO public.bill_payments
  (customer_id, account_id, category, provider, customer_ref, amount, reference)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'airtime', 'MTN', '08012345678', 1000.00, 'BILL-AIRTIME-DEMO-001');
