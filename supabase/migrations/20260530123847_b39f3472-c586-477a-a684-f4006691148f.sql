
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- =========================
-- ACCOUNTS
-- =========================
CREATE SEQUENCE public.account_number_seq START 1000000001;

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('savings','current')),
  balance NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_customer ON public.accounts(customer_id);
CREATE INDEX idx_accounts_number ON public.accounts(account_number);
GRANT SELECT, INSERT ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts select" ON public.accounts FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

-- Auto-assign account_number
CREATE OR REPLACE FUNCTION public.set_account_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := 'VMB' || LPAD(nextval('public.account_number_seq')::text, 10, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_account_number BEFORE INSERT ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.set_account_number();

-- =========================
-- TRANSACTIONS
-- =========================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','transfer_in','transfer_out','loan_disbursement','loan_repayment')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(18,2) NOT NULL,
  reference TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_account_date ON public.transactions(account_id, created_at DESC);
CREATE INDEX idx_tx_customer_date ON public.transactions(customer_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx select" ON public.transactions FOR SELECT TO authenticated USING (customer_id = auth.uid());

-- =========================
-- TRANSFERS
-- =========================
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account UUID NOT NULL REFERENCES public.accounts(id),
  to_account UUID NOT NULL REFERENCES public.accounts(id),
  from_customer UUID NOT NULL,
  to_customer UUID NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_from ON public.transfers(from_customer, created_at DESC);
GRANT SELECT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transfers" ON public.transfers FOR SELECT TO authenticated
  USING (from_customer = auth.uid() OR to_customer = auth.uid());

-- =========================
-- LOANS
-- =========================
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  principal NUMERIC(18,2) NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  outstanding NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','active','repaid','rejected')),
  purpose TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX idx_loans_customer ON public.loans(customer_id);
GRANT SELECT, INSERT ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loans select" ON public.loans FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "own loans insert" ON public.loans FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND status = 'pending');

CREATE TABLE public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_payments TO authenticated;
GRANT ALL ON public.loan_payments TO service_role;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loan payments" ON public.loan_payments FOR SELECT TO authenticated USING (customer_id = auth.uid());

-- =========================
-- AUDIT LOGS
-- =========================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user_date ON public.audit_logs(user_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
  v_record_id TEXT;
BEGIN
  v_user := auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::text;
    INSERT INTO public.audit_logs(table_name, action, record_id, user_id, old_data)
      VALUES (TG_TABLE_NAME, TG_OP, v_record_id, COALESCE(v_user, (to_jsonb(OLD)->>'customer_id')::uuid), to_jsonb(OLD));
    RETURN OLD;
  ELSE
    v_record_id := NEW.id::text;
    INSERT INTO public.audit_logs(table_name, action, record_id, user_id, old_data, new_data)
      VALUES (TG_TABLE_NAME, TG_OP, v_record_id,
              COALESCE(v_user, (to_jsonb(NEW)->>'customer_id')::uuid),
              CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
              to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_audit_accounts AFTER INSERT OR UPDATE OR DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =========================
-- FRAUD ALERTS
-- =========================
CREATE TABLE public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fraud_alerts TO authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fraud alerts" ON public.fraud_alerts FOR SELECT TO authenticated USING (customer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.detect_fraud()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.amount >= 50000 THEN
    SELECT COUNT(*) INTO v_count
    FROM public.transfers
    WHERE from_customer = NEW.from_customer
      AND amount >= 50000
      AND created_at >= now() - INTERVAL '10 minutes';
    IF v_count > 3 THEN
      INSERT INTO public.fraud_alerts(customer_id, reason, details)
      VALUES (NEW.from_customer, 'More than 3 large transfers in 10 minutes',
              jsonb_build_object('transfer_id', NEW.id, 'amount', NEW.amount, 'count', v_count));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_detect_fraud AFTER INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.detect_fraud();

-- =========================
-- AUTO PROFILE ON SIGNUP
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- BANKING PROCEDURES (RPC)
-- =========================
CREATE OR REPLACE FUNCTION public.sp_deposit(p_account UUID, p_amount NUMERIC, p_description TEXT DEFAULT 'Deposit')
RETURNS public.transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_acct public.accounts%ROWTYPE;
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_acct.status <> 'active' THEN RAISE EXCEPTION 'Account not active'; END IF;

  UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_account
    RETURNING * INTO v_acct;

  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'deposit', p_amount, v_acct.balance, p_description,
            'DEP-' || to_char(now(),'YYYYMMDDHH24MISS'))
    RETURNING * INTO v_tx;
  RETURN v_tx;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_withdraw(p_account UUID, p_amount NUMERIC, p_description TEXT DEFAULT 'Withdrawal')
RETURNS public.transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_acct public.accounts%ROWTYPE;
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF v_acct.status <> 'active' THEN RAISE EXCEPTION 'Account not active'; END IF;
  IF v_acct.balance < p_amount THEN
    INSERT INTO public.audit_logs(table_name, action, user_id, new_data)
      VALUES ('transactions','FAILED_WITHDRAW', v_uid,
              jsonb_build_object('account_id', p_account, 'amount', p_amount, 'reason','insufficient funds'));
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_account
    RETURNING * INTO v_acct;

  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'withdrawal', p_amount, v_acct.balance, p_description,
            'WDR-' || to_char(now(),'YYYYMMDDHH24MISS'))
    RETURNING * INTO v_tx;
  RETURN v_tx;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_transfer(p_from UUID, p_to_account_number TEXT, p_amount NUMERIC, p_description TEXT DEFAULT 'Transfer')
RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_from public.accounts%ROWTYPE;
  v_to public.accounts%ROWTYPE;
  v_ref TEXT;
  v_transfer public.transfers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- Lock both in deterministic order to prevent deadlock
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
      VALUES ('transfers','FAILED_TRANSFER', v_uid,
              jsonb_build_object('from', p_from, 'to', p_to_account_number, 'amount', p_amount, 'reason','insufficient funds'));
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  v_ref := 'TRF-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text,1,6);

  UPDATE public.accounts SET balance = balance - p_amount WHERE id = v_from.id RETURNING * INTO v_from;
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = v_to.id RETURNING * INTO v_to;

  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (v_from.id, v_from.customer_id, 'transfer_out', p_amount, v_from.balance,
            p_description || ' to ' || v_to.account_number, v_ref);
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (v_to.id, v_to.customer_id, 'transfer_in', p_amount, v_to.balance,
            p_description || ' from ' || v_from.account_number, v_ref);

  INSERT INTO public.transfers(from_account, to_account, from_customer, to_customer, amount, reference)
    VALUES (v_from.id, v_to.id, v_from.customer_id, v_to.customer_id, p_amount, v_ref)
    RETURNING * INTO v_transfer;

  RETURN v_transfer;
END;
$$;

-- Loan repayment RPC
CREATE OR REPLACE FUNCTION public.sp_repay_loan(p_loan UUID, p_account UUID, p_amount NUMERIC)
RETURNS public.loans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_loan public.loans%ROWTYPE;
  v_acct public.accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
END;
$$;

-- Loan auto-approve + disburse (simple: instant approval, deposits to account)
CREATE OR REPLACE FUNCTION public.sp_apply_loan(p_account UUID, p_principal NUMERIC, p_purpose TEXT)
RETURNS public.loans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_acct public.accounts%ROWTYPE;
  v_loan public.loans%ROWTYPE;
  v_total NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_principal <= 0 THEN RAISE EXCEPTION 'Principal must be positive'; END IF;
  IF p_principal > 1000000 THEN RAISE EXCEPTION 'Loan exceeds maximum'; END IF;

  SELECT * INTO v_acct FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF v_acct.customer_id <> v_uid THEN RAISE EXCEPTION 'Not your account'; END IF;

  v_total := p_principal * 1.10; -- 10% interest

  INSERT INTO public.loans(customer_id, account_id, principal, interest_rate, outstanding, status, purpose, approved_at)
    VALUES (v_uid, p_account, p_principal, 10.00, v_total, 'active', p_purpose, now())
    RETURNING * INTO v_loan;

  UPDATE public.accounts SET balance = balance + p_principal WHERE id = p_account RETURNING * INTO v_acct;
  INSERT INTO public.transactions(account_id, customer_id, type, amount, balance_after, description, reference)
    VALUES (p_account, v_uid, 'loan_disbursement', p_principal, v_acct.balance, 'Loan disbursed: '||p_purpose, 'LDB-'||to_char(now(),'YYYYMMDDHH24MISS'));

  RETURN v_loan;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sp_deposit(UUID,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_withdraw(UUID,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_transfer(UUID,TEXT,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_repay_loan(UUID,UUID,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_apply_loan(UUID,NUMERIC,TEXT) TO authenticated;
