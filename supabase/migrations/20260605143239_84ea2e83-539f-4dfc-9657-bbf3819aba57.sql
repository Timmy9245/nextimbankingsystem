-- Restrict direct write access to financial tables; force writes through SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.accounts FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.transfers FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.loans FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.loan_payments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.fraud_alerts FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- Tighten loans insert policy: require account ownership.
DROP POLICY IF EXISTS "own loans insert" ON public.loans;
CREATE POLICY "own loans insert" ON public.loans
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND status = 'pending'
    AND account_id IN (SELECT id FROM public.accounts WHERE customer_id = auth.uid())
  );

-- Revoke EXECUTE on internal trigger / definer functions from public callers.
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_fraud() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_account_number() FROM PUBLIC, anon, authenticated;

-- Fix mutable search_path on set_account_number.
CREATE OR REPLACE FUNCTION public.set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := 'VMB' || LPAD(nextval('public.account_number_seq')::text, 10, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure user-callable RPCs remain executable by authenticated users only.
REVOKE EXECUTE ON FUNCTION public.sp_deposit(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sp_withdraw(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sp_transfer(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sp_apply_loan(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sp_repay_loan(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_deposit(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_withdraw(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_transfer(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_apply_loan(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_repay_loan(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_receipt(uuid) TO authenticated;