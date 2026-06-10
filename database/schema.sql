-- ============================================================
-- NexTim Banking — SCHEMA
-- Tables, sequences, indexes, GRANTs and RLS policies
-- (mirrors supabase/migrations/*.sql; do not run directly)
-- ============================================================

-- pgcrypto in the extensions schema, used for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------- PROFILES ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  pin_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ---------- ACCOUNTS ----------
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
CREATE INDEX idx_accounts_number   ON public.accounts(account_number);
GRANT SELECT, INSERT ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts select" ON public.accounts FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

-- ---------- TRANSACTIONS ----------
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','transfer_in','transfer_out','loan_disbursement','loan_repayment','bill_payment')),
  amount        NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(18,2) NOT NULL,
  reference   TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','pending')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_account_date  ON public.transactions(account_id, created_at DESC);
CREATE INDEX idx_tx_customer_date ON public.transactions(customer_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx select" ON public.transactions FOR SELECT TO authenticated USING (customer_id = auth.uid());

-- ---------- TRANSFERS ----------
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account  UUID NOT NULL REFERENCES public.accounts(id),
  to_account    UUID NOT NULL REFERENCES public.accounts(id),
  from_customer UUID NOT NULL,
  to_customer   UUID NOT NULL,
  amount        NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  reference     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'success',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_from ON public.transfers(from_customer, created_at DESC);
GRANT SELECT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transfers" ON public.transfers FOR SELECT TO authenticated
  USING (from_customer = auth.uid() OR to_customer = auth.uid());

-- ---------- LOANS ----------
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES public.accounts(id),
  principal     NUMERIC(18,2) NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  outstanding   NUMERIC(18,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','active','repaid','rejected')),
  purpose       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ
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
  loan_id     UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  amount      NUMERIC(18,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_payments TO authenticated;
GRANT ALL ON public.loan_payments TO service_role;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loan payments" ON public.loan_payments FOR SELECT TO authenticated USING (customer_id = auth.uid());

-- ---------- BILL PAYMENTS ----------
CREATE TABLE public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   UUID NOT NULL REFERENCES public.accounts(id),
  category     TEXT NOT NULL CHECK (category IN ('airtime','data','electricity','cable_tv','betting')),
  provider     TEXT NOT NULL,
  customer_ref TEXT NOT NULL,
  amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  reference    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'success',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bill payments" ON public.bill_payments FOR SELECT TO authenticated USING (customer_id = auth.uid());

-- ---------- AUDIT LOGS ----------
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  record_id  TEXT,
  user_id    UUID,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user_date ON public.audit_logs(user_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------- FRAUD ALERTS ----------
CREATE TABLE public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  reason      TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fraud_alerts TO authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fraud alerts" ON public.fraud_alerts FOR SELECT TO authenticated USING (customer_id = auth.uid());
