
CREATE OR REPLACE FUNCTION public.get_receipt(p_tx UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF v_tx.type IN ('transfer_out','transfer_in') THEN
    IF v_tx.type = 'transfer_out' THEN
      SELECT a.account_number, p.full_name
        INTO v_counter_acct, v_counter_name
        FROM public.transfers t
        JOIN public.accounts a ON a.id = t.to_account
        LEFT JOIN public.profiles p ON p.id = t.to_customer
        WHERE t.reference = v_tx.reference LIMIT 1;
      v_counter_label := 'beneficiary';
    ELSE
      SELECT a.account_number, p.full_name
        INTO v_counter_acct, v_counter_name
        FROM public.transfers t
        JOIN public.accounts a ON a.id = t.from_account
        LEFT JOIN public.profiles p ON p.id = t.from_customer
        WHERE t.reference = v_tx.reference LIMIT 1;
      v_counter_label := 'sender';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_tx.id,
    'type', v_tx.type,
    'amount', v_tx.amount,
    'balance_after', v_tx.balance_after,
    'reference', v_tx.reference,
    'description', v_tx.description,
    'status', v_tx.status,
    'created_at', v_tx.created_at,
    'account_number', v_acct.account_number,
    'account_type', v_acct.account_type,
    'owner_name', v_owner_name,
    'counterparty_label', v_counter_label,
    'counterparty_account', v_counter_acct,
    'counterparty_name', v_counter_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_receipt(UUID) TO authenticated;
