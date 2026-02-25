-- Fix PostgREST RPC resolution for admin review actions in production.
-- Recreate functions using parameter order currently requested by client/runtime.

DROP FUNCTION IF EXISTS public.admin_review_topup_request(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_review_swap_withdrawal(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_review_topup_request(
  p_admin_note TEXT DEFAULT '',
  p_decision TEXT DEFAULT '',
  p_request_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id UUID := auth.uid();
  v_decision TEXT := LOWER(TRIM(COALESCE(p_decision, '')));
  v_row public.user_topup_requests;
  v_openpay_user_id UUID;
  v_openpay_balance NUMERIC(12,2);
  v_user_balance NUMERIC(12,2);
  v_tx_id UUID;
  v_settlement_account TEXT := 'OPEA68BB7A9F964994A199A15786D680FA';
BEGIN
  IF public.is_openpay_core_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  IF v_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject';
  END IF;

  SELECT * INTO v_row
  FROM public.user_topup_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Top up request already processed';
  END IF;

  IF v_decision = 'approve' THEN
    SELECT ua.user_id INTO v_openpay_user_id
    FROM public.user_accounts ua
    WHERE ua.account_number = v_settlement_account
    LIMIT 1;

    IF v_openpay_user_id IS NULL THEN
      RAISE EXCEPTION 'Settlement account not found';
    END IF;

    SELECT balance INTO v_openpay_balance
    FROM public.wallets
    WHERE user_id = v_openpay_user_id
    FOR UPDATE;

    IF v_openpay_balance IS NULL THEN
      RAISE EXCEPTION 'Settlement wallet not found';
    END IF;

    IF v_openpay_balance < v_row.amount THEN
      RAISE EXCEPTION 'Settlement wallet balance insufficient for top up';
    END IF;

    SELECT balance INTO v_user_balance
    FROM public.wallets
    WHERE user_id = v_row.user_id
    FOR UPDATE;

    IF v_user_balance IS NULL THEN
      RAISE EXCEPTION 'User wallet not found';
    END IF;

    UPDATE public.wallets
    SET balance = v_openpay_balance - v_row.amount,
        updated_at = now()
    WHERE user_id = v_openpay_user_id;

    UPDATE public.wallets
    SET balance = v_user_balance + v_row.amount,
        updated_at = now()
    WHERE user_id = v_row.user_id;

    INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
    VALUES (
      v_openpay_user_id,
      v_row.user_id,
      v_row.amount,
      CONCAT('Top up approved | ', v_row.provider, ' | Request ', v_row.id::TEXT),
      'completed'
    )
    RETURNING id INTO v_tx_id;
  END IF;

  UPDATE public.user_topup_requests
  SET status = CASE WHEN v_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
      admin_note = COALESCE(p_admin_note, ''),
      reviewed_by = v_admin_user_id,
      reviewed_at = now(),
      transfer_transaction_id = v_tx_id
  WHERE id = v_row.id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_swap_withdrawal(
  p_admin_note TEXT DEFAULT '',
  p_decision TEXT DEFAULT '',
  p_withdrawal_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id UUID := auth.uid();
  v_decision TEXT := LOWER(TRIM(COALESCE(p_decision, '')));
  v_row public.user_swap_withdrawals;
  v_openpay_user_id UUID;
  v_openpay_balance NUMERIC(12,2);
  v_user_balance NUMERIC(12,2);
  v_refund_tx UUID;
  v_settlement_account TEXT := 'OPEA68BB7A9F964994A199A15786D680FA';
BEGIN
  IF public.is_openpay_core_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_withdrawal_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal id is required';
  END IF;

  IF v_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject';
  END IF;

  SELECT * INTO v_row
  FROM public.user_swap_withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;

  IF v_decision = 'reject' THEN
    SELECT ua.user_id INTO v_openpay_user_id
    FROM public.user_accounts ua
    WHERE ua.account_number = v_settlement_account
    LIMIT 1;

    IF v_openpay_user_id IS NULL THEN
      RAISE EXCEPTION 'Settlement account not found';
    END IF;

    SELECT balance INTO v_openpay_balance
    FROM public.wallets
    WHERE user_id = v_openpay_user_id
    FOR UPDATE;

    IF v_openpay_balance IS NULL THEN
      RAISE EXCEPTION 'Settlement wallet not found';
    END IF;

    IF v_openpay_balance < v_row.amount THEN
      RAISE EXCEPTION 'Settlement wallet balance insufficient for refund';
    END IF;

    SELECT balance INTO v_user_balance
    FROM public.wallets
    WHERE user_id = v_row.user_id
    FOR UPDATE;

    IF v_user_balance IS NULL THEN
      RAISE EXCEPTION 'User wallet not found';
    END IF;

    UPDATE public.wallets
    SET balance = v_openpay_balance - v_row.amount,
        updated_at = now()
    WHERE user_id = v_openpay_user_id;

    UPDATE public.wallets
    SET balance = v_user_balance + v_row.amount,
        updated_at = now()
    WHERE user_id = v_row.user_id;

    INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
    VALUES (
      v_openpay_user_id,
      v_row.user_id,
      v_row.amount,
      CONCAT('Swap withdrawal rejected refund | Request ', v_row.id::TEXT),
      'refunded'
    )
    RETURNING id INTO v_refund_tx;
  END IF;

  UPDATE public.user_swap_withdrawals
  SET status = CASE WHEN v_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
      admin_note = COALESCE(p_admin_note, ''),
      reviewed_by = v_admin_user_id,
      reviewed_at = now(),
      refund_transaction_id = v_refund_tx
  WHERE id = v_row.id;

  RETURN v_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_topup_request(TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_swap_withdrawal(TEXT, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_review_topup_request(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_swap_withdrawal(TEXT, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
