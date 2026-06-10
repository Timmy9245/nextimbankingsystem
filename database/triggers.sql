-- ============================================================
-- TRIGGERS — auto account numbers, audit log, fraud detection,
-- and auto-profile on signup.
-- ============================================================

-- Auto-assign account number on insert (VMB + 10-digit sequence)
CREATE OR REPLACE FUNCTION public.set_account_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := 'VMB' || LPAD(nextval('public.account_number_seq')::text, 10, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_account_number
  BEFORE INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_account_number();

-- Generic audit logger — writes inserts/updates/deletes into audit_logs
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID; v_record_id TEXT;
BEGIN
  v_user := auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::text;
    INSERT INTO public.audit_logs(table_name, action, record_id, user_id, old_data)
      VALUES (TG_TABLE_NAME, TG_OP, v_record_id,
              COALESCE(v_user, (to_jsonb(OLD)->>'customer_id')::uuid), to_jsonb(OLD));
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
END $$;
CREATE TRIGGER trg_audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Fraud detection — flag >3 large transfers (>= 50,000) within 10 minutes
CREATE OR REPLACE FUNCTION public.detect_fraud()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
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
END $$;
CREATE TRIGGER trg_detect_fraud
  AFTER INSERT ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.detect_fraud();

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
