
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PIN column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash text;

-- 2. Verify helper (internal)
CREATE OR REPLACE FUNCTION public.verify_pin(p_uid uuid, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;
  SELECT pin_hash INTO v_hash FROM public.profiles WHERE id = p_uid;
  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'No transaction PIN set. Please set up your PIN in Settings.';
  END IF;
  IF v_hash <> crypt(p_pin, v_hash) THEN
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_pin(uuid, text) FROM PUBLIC, anon, authenticated;

-- 3. Has-PIN check
CREATE OR REPLACE FUNCTION public.sp_has_pin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT pin_hash IS NOT NULL FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE EXECUTE ON FUNCTION public.sp_has_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_has_pin() TO authenticated;

-- 4. Set / change PIN
CREATE OR REPLACE FUNCTION public.sp_set_pin(p_new text, p_current text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_hash text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_new IS NULL OR p_new !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;
  SELECT pin_hash INTO v_hash FROM public.profiles WHERE id = v_uid;
  IF v_hash IS NOT NULL THEN
    IF p_current IS NULL OR v_hash <> crypt(p_current, v_hash) THEN
      RAISE EXCEPTION 'Current PIN is incorrect';
    END IF;
  END IF;
  UPDATE public.profiles SET pin_hash = crypt(p_new, gen_salt('bf', 8)) WHERE id = v_uid;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_set_pin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_set_pin(text, text) TO authenticated;

-- 5. Expand transactions.type constraint to include bill_payment
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (
  type IN ('deposit','withdrawal','transfer_in','transfer_out','loan_disbursement','loan_repayment','bill_payment')
);

-- 6. Replace money-moving sp_* functions with PIN-gated versions
DROP FUNCTION IF EXISTS public.sp_deposit(uuid, numeric, text);
CREATE FUNCTION public.sp_deposit(p_account uuid, p_amount numeric, p_pin text, p_description text DEFAULT 'Deposit')
RETURNS public.transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_acct public.accounts%ROWTYPE; v_tx public.transactions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.verify_pin(v_uid, p_pin);
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_acct.status <> 'active' THEN RAISE EXCEPTION 'Account not active'; END IF;
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_account RETURNING * INTO v_acct;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'deposit', p_amount, v_acct.balance, p_description, 'DEP-' || to_char(now(),'YYYYMMDDHH24MISS'))
    RETURNING * INTO v_tx;
  RETURN v_tx;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_deposit(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_deposit(uuid, numeric, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.sp_withdraw(uuid, numeric, text);
CREATE FUNCTION public.sp_withdraw(p_account uuid, p_amount numeric, p_pin text, p_description text DEFAULT 'Withdrawal')
RETURNS public.transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_acct public.accounts%ROWTYPE; v_tx public.transactions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.verify_pin(v_uid, p_pin);
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_acct.status <> 'active' THEN RAISE EXCEPTION 'Account not active'; END IF;
  IF v_acct.balance < p_amount THEN
    INSERT INTO public.audit_logs(table_name, action, user_id, new_data)
      VALUES ('transactions','FAILED_WITHDRAW', v_uid, jsonb_build_object('account_id', p_account, 'amount', p_amount, 'reason','insufficient funds'));
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_account RETURNING * INTO v_acct;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'withdrawal', p_amount, v_acct.balance, p_description, 'WDR-' || to_char(now(),'YYYYMMDDHH24MISS'))
    RETURNING * INTO v_tx;
  RETURN v_tx;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_withdraw(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_withdraw(uuid, numeric, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.sp_transfer(uuid, text, numeric, text);
CREATE FUNCTION public.sp_transfer(p_from uuid, p_to_account_number text, p_amount numeric, p_pin text, p_description text DEFAULT 'Transfer')
RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_from public.accounts%ROWTYPE; v_to public.accounts%ROWTYPE; v_ref text; v_transfer public.transfers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.verify_pin(v_uid, p_pin);
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT * INTO v_from FROM public.accounts WHERE id = p_from FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source account not found'; END IF;
  IF v_from.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_from.status <> 'active' THEN RAISE EXCEPTION 'Source account not active'; END IF;
  SELECT * INTO v_to FROM public.accounts WHERE account_number = p_to_account_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination account not found'; END IF;
  IF v_to.status <> 'active' THEN RAISE EXCEPTION 'Destination account not active'; END IF;
  IF v_to.id = v_from.id THEN RAISE EXCEPTION 'Cannot transfer to same account'; END IF;
  IF v_from.balance < p_amount THEN
    INSERT INTO public.audit_logs(table_name, action, user_id, new_data)
      VALUES ('transfers','FAILED_TRANSFER', v_uid, jsonb_build_object('from', p_from, 'to', p_to_account_number, 'amount', p_amount, 'reason','insufficient funds'));
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  v_ref := 'TRF-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text,1,6);
  UPDATE public.accounts SET balance = balance - p_amount WHERE id = v_from.id RETURNING * INTO v_from;
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = v_to.id RETURNING * INTO v_to;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (v_from.id, v_from.customer_id, 'transfer_out', p_amount, v_from.balance, p_description || ' to ' || v_to.account_number, v_ref);
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (v_to.id, v_to.customer_id, 'transfer_in', p_amount, v_to.balance, p_description || ' from ' || v_from.account_number, v_ref);
  INSERT INTO public.transfers(from_account, to_account, from_customer, to_customer, amount, reference)
    VALUES (v_from.id, v_to.id, v_from.customer_id, v_to.customer_id, p_amount, v_ref)
    RETURNING * INTO v_transfer;
  RETURN v_transfer;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_transfer(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_transfer(uuid, text, numeric, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.sp_apply_loan(uuid, numeric, text);
CREATE FUNCTION public.sp_apply_loan(p_account uuid, p_principal numeric, p_purpose text, p_pin text)
RETURNS public.loans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_acct public.accounts%ROWTYPE; v_loan public.loans%ROWTYPE; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.verify_pin(v_uid, p_pin);
  IF p_principal <= 0 THEN RAISE EXCEPTION 'Principal must be positive'; END IF;
  IF p_principal > 1000000 THEN RAISE EXCEPTION 'Loan exceeds maximum'; END IF;
  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  v_total := p_principal * 1.10;
  INSERT INTO public.loans(customer_id, account_id, principal, interest_rate, outstanding, status, purpose, approved_at)
    VALUES (v_uid, p_account, p_principal, 10.00, v_total, 'active', p_purpose, now())
    RETURNING * INTO v_loan;
  UPDATE public.accounts SET balance = balance + p_principal WHERE id = p_account RETURNING * INTO v_acct;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'loan_disbursement', p_principal, v_acct.balance, 'Loan disbursed: '||p_purpose, 'LDB-'||to_char(now(),'YYYYMMDDHH24MISS'));
  RETURN v_loan;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_apply_loan(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_apply_loan(uuid, numeric, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.sp_repay_loan(uuid, uuid, numeric);
CREATE FUNCTION public.sp_repay_loan(p_loan uuid, p_account uuid, p_amount numeric, p_pin text)
RETURNS public.loans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_loan public.loans%ROWTYPE; v_acct public.accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.verify_pin(v_uid, p_pin);
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan FOR UPDATE;
  IF v_loan.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your loan'; END IF;
  IF v_loan.status <> 'active' THEN RAISE EXCEPTION 'Loan not active'; END IF;
  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_acct.balance < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_account RETURNING * INTO v_acct;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'loan_repayment', p_amount, v_acct.balance, 'Loan repayment', 'LRP-'||to_char(now(),'YYYYMMDDHH24MISS'));
  INSERT INTO public.loan_payments(loan_id, customer_id, amount) VALUES (p_loan, v_uid, p_amount);
  UPDATE public.loans
    SET outstanding = GREATEST(outstanding - p_amount, 0),
        status = CASE WHEN outstanding - p_amount <= 0 THEN 'repaid' ELSE status END
    WHERE id = p_loan
    RETURNING * INTO v_loan;
  RETURN v_loan;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_repay_loan(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_repay_loan(uuid, uuid, numeric, text) TO authenticated;

-- 7. Bill payments
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('airtime','data','electricity','cable_tv','betting')),
  provider text NOT NULL,
  customer_ref text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own bill select" ON public.bill_payments;
CREATE POLICY "own bill select" ON public.bill_payments
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_bill_customer_date ON public.bill_payments(customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sp_pay_bill(
  p_account uuid, p_amount numeric, p_category text, p_provider text,
  p_customer_ref text, p_pin text
) RETURNS public.transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_acct public.accounts%ROWTYPE; v_tx public.transactions%ROWTYPE; v_ref text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.verify_pin(v_uid, p_pin);
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_category NOT IN ('airtime','data','electricity','cable_tv','betting') THEN
    RAISE EXCEPTION 'Unknown bill category';
  END IF;
  IF length(coalesce(trim(p_customer_ref),'')) < 3 THEN
    RAISE EXCEPTION 'Customer reference is required';
  END IF;
  IF length(coalesce(trim(p_provider),'')) < 2 THEN
    RAISE EXCEPTION 'Provider is required';
  END IF;
  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_acct.status <> 'active' THEN RAISE EXCEPTION 'Account not active'; END IF;
  IF v_acct.balance < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  v_ref := 'BILL-' || upper(p_category) || '-' || to_char(now(),'YYYYMMDDHH24MISS');
  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_account RETURNING * INTO v_acct;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'bill_payment', p_amount, v_acct.balance,
            p_provider || ' · ' || p_customer_ref, v_ref)
    RETURNING * INTO v_tx;
  INSERT INTO public.bill_payments(customer_id, account_id, category, provider, customer_ref, amount, reference)
    VALUES (v_uid, p_account, p_category, p_provider, p_customer_ref, p_amount, v_ref);
  RETURN v_tx;
END $$;
REVOKE EXECUTE ON FUNCTION public.sp_pay_bill(uuid, numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_pay_bill(uuid, numeric, text, text, text, text) TO authenticated;
