-- ============================================================
-- STORED PROCEDURES (RPC) — called from the frontend via supabase.rpc(...)
-- All money-movement procedures require a valid 4-digit transaction PIN.
-- ============================================================

-- ----- PIN management -----
CREATE OR REPLACE FUNCTION public.sp_has_pin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT pin_hash IS NOT NULL FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.sp_set_pin(p_new TEXT, p_current TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid := auth.uid(); v_hash text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_new IS NULL OR p_new !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;
  SELECT pin_hash INTO v_hash FROM public.profiles WHERE id = v_uid;
  IF v_hash IS NOT NULL THEN
    IF p_current IS NULL OR v_hash <> extensions.crypt(p_current, v_hash) THEN
      RAISE EXCEPTION 'Current PIN is incorrect';
    END IF;
  END IF;
  UPDATE public.profiles SET pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)) WHERE id = v_uid;
END $$;

CREATE OR REPLACE FUNCTION public.sp_reset_pin(p_new TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_new IS NULL OR p_new !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;
  UPDATE public.profiles SET pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)) WHERE id = v_uid;
END $$;

-- Helper: raises if the supplied PIN does not match the user's stored hash
CREATE OR REPLACE FUNCTION public.verify_pin(p_uid UUID, p_pin TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_hash text;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;
  SELECT pin_hash INTO v_hash FROM public.profiles WHERE id = p_uid;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'No transaction PIN set. Please set up your PIN in Settings.'; END IF;
  IF v_hash <> extensions.crypt(p_pin, v_hash) THEN RAISE EXCEPTION 'Incorrect PIN'; END IF;
END $$;

-- ----- Money movement -----
-- sp_deposit, sp_withdraw, sp_transfer, sp_pay_bill, sp_apply_loan, sp_repay_loan
-- (see the matching CREATE FUNCTION bodies in supabase/migrations/*.sql)
-- Each procedure:
--   1. Asserts auth.uid() is set
--   2. Calls verify_pin() with the user-supplied PIN
--   3. Locks the affected account row(s) FOR UPDATE
--   4. Mutates balance(s)
--   5. Inserts the matching transaction(s) + a domain row (transfer / bill / loan)
--   6. Returns the inserted row

-- ----- Receipt lookup (used by the Receipt dialog in the UI) -----
CREATE OR REPLACE FUNCTION public.get_receipt(p_tx UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tx public.transactions%ROWTYPE;
  v_acct public.accounts%ROWTYPE;
  v_owner_name TEXT;
  v_counter_acct TEXT;
  v_counter_name TEXT;
  v_counter_label TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx;
  IF NOT FOUND OR v_tx.customer_id <> v_uid THEN RAISE EXCEPTION 'Not found'; END IF;
  SELECT * INTO v_acct FROM public.accounts WHERE id = v_tx.account_id;
  SELECT full_name INTO v_owner_name FROM public.profiles WHERE id = v_tx.customer_id;
  -- Counterparty resolution for transfers
  IF v_tx.type = 'transfer_out' THEN
    SELECT a.account_number, p.full_name INTO v_counter_acct, v_counter_name
      FROM public.transfers t
      JOIN public.accounts a ON a.id = t.to_account
      LEFT JOIN public.profiles p ON p.id = t.to_customer
      WHERE t.reference = v_tx.reference LIMIT 1;
    v_counter_label := 'beneficiary';
  ELSIF v_tx.type = 'transfer_in' THEN
    SELECT a.account_number, p.full_name INTO v_counter_acct, v_counter_name
      FROM public.transfers t
      JOIN public.accounts a ON a.id = t.from_account
      LEFT JOIN public.profiles p ON p.id = t.from_customer
      WHERE t.reference = v_tx.reference LIMIT 1;
    v_counter_label := 'sender';
  END IF;
  RETURN jsonb_build_object(
    'id', v_tx.id, 'type', v_tx.type, 'amount', v_tx.amount,
    'balance_after', v_tx.balance_after, 'reference', v_tx.reference,
    'description', v_tx.description, 'status', v_tx.status, 'created_at', v_tx.created_at,
    'account_number', v_acct.account_number, 'account_type', v_acct.account_type,
    'owner_name', v_owner_name, 'counterparty_label', v_counter_label,
    'counterparty_account', v_counter_acct, 'counterparty_name', v_counter_name);
END $$;
