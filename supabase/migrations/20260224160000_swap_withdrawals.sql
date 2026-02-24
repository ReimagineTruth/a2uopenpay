CREATE TABLE IF NOT EXISTS public.user_swap_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 1),
  fee_rate NUMERIC(6,4) NOT NULL DEFAULT 0.02 CHECK (fee_rate >= 0 AND fee_rate <= 0.2),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  openpay_account_name TEXT NOT NULL DEFAULT '',
  openpay_account_username TEXT NOT NULL DEFAULT '',
  openpay_account_number TEXT NOT NULL DEFAULT '',
  pi_wallet_address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  transfer_transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  refund_transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_swap_withdrawals_user_created
  ON public.user_swap_withdrawals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_swap_withdrawals_status_created
  ON public.user_swap_withdrawals(status, created_at DESC);

ALTER TABLE public.user_swap_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_swap_withdrawals' AND policyname = 'Users can view own swap withdrawals'
  ) THEN
    CREATE POLICY "Users can view own swap withdrawals"
      ON public.user_swap_withdrawals
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_swap_withdrawals_updated_at ON public.user_swap_withdrawals;
CREATE TRIGGER trg_user_swap_withdrawals_updated_at
BEFORE UPDATE ON public.user_swap_withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

-- Parameter name changes require dropping existing function signature.
DROP FUNCTION IF EXISTS public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_swap_withdrawal(
  p_amount NUMERIC,
  p_openpay_account_name TEXT,
  p_openpay_account_number TEXT,
  p_openpay_account_username TEXT,
  p_pi_wallet_address TEXT
)
RETURNS public.user_swap_withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_fee_rate NUMERIC(6,4) := 0.02;
  v_fee_amount NUMERIC(12,2);
  v_payout_amount NUMERIC(12,2);
  v_openpay_user_id UUID;
  v_wallet_balance NUMERIC(12,2);
  v_openpay_balance NUMERIC(12,2);
  v_tx_id UUID;
  v_row public.user_swap_withdrawals;
  v_settlement_account TEXT := 'OPEA68BB7A9F964994A199A15786D680FA';
  v_name TEXT := LEFT(TRIM(COALESCE(p_openpay_account_name, '')), 160);
  v_account TEXT := UPPER(TRIM(COALESCE(p_openpay_account_number, '')));
  v_username TEXT := LEFT(TRIM(COALESCE(p_openpay_account_username, '')), 120);
  v_wallet TEXT := LEFT(TRIM(COALESCE(p_pi_wallet_address, '')), 240);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_amount < 1 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 1 OPEN USD';
  END IF;

  v_fee_amount := ROUND(v_amount * v_fee_rate, 2);
  v_payout_amount := ROUND(v_amount - v_fee_amount, 2);
  IF v_payout_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount too low after fees';
  END IF;

  IF v_name = '' OR v_username = '' OR v_account = '' OR v_wallet = '' THEN
    RAISE EXCEPTION 'Complete all required withdrawal fields';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_accounts ua
    WHERE ua.user_id = v_user_id
      AND UPPER(ua.account_number) = v_account
  ) THEN
    RAISE EXCEPTION 'OpenPay account number does not match your profile';
  END IF;

  SELECT ua.user_id INTO v_openpay_user_id
  FROM public.user_accounts ua
  WHERE ua.account_number = v_settlement_account
  LIMIT 1;

  IF v_openpay_user_id IS NULL THEN
    RAISE EXCEPTION 'Settlement account not found';
  END IF;

  IF v_openpay_user_id = v_user_id THEN
    RAISE EXCEPTION 'Settlement account invalid';
  END IF;

  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  SELECT balance INTO v_openpay_balance
  FROM public.wallets
  WHERE user_id = v_openpay_user_id
  FOR UPDATE;

  IF v_openpay_balance IS NULL THEN
    RAISE EXCEPTION 'Settlement wallet not found';
  END IF;

  UPDATE public.wallets
  SET balance = v_wallet_balance - v_amount,
      updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE public.wallets
  SET balance = v_openpay_balance + v_amount,
      updated_at = now()
  WHERE user_id = v_openpay_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_user_id,
    v_openpay_user_id,
    v_amount,
    CONCAT(
      'Swap withdrawal request to PI | Wallet ',
      LEFT(v_wallet, 80),
      ' | OpenPay ',
      LEFT(v_username, 40),
      ' ',
      LEFT(v_account, 60)
    ),
    'completed'
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.user_swap_withdrawals (
    user_id,
    amount,
    fee_rate,
    fee_amount,
    payout_amount,
    openpay_account_name,
    openpay_account_username,
    openpay_account_number,
    pi_wallet_address,
    status,
    transfer_transaction_id
  )
  VALUES (
    v_user_id,
    v_amount,
    v_fee_rate,
    v_fee_amount,
    v_payout_amount,
    v_name,
    v_username,
    v_account,
    v_wallet,
    'pending',
    v_tx_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_swap_withdrawals(
  p_status TEXT DEFAULT 'pending',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  amount NUMERIC,
  openpay_account_name TEXT,
  openpay_account_username TEXT,
  openpay_account_number TEXT,
  pi_wallet_address TEXT,
  status TEXT,
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  applicant_display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := LOWER(TRIM(COALESCE(p_status, 'pending')));
BEGIN
  IF public.is_openpay_core_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    usw.id,
    usw.user_id,
    usw.amount,
    usw.openpay_account_name,
    usw.openpay_account_username,
    usw.openpay_account_number,
    usw.pi_wallet_address,
    usw.status,
    usw.admin_note,
    usw.reviewed_at,
    usw.created_at,
    COALESCE(NULLIF(p.full_name, ''), CONCAT('@', NULLIF(p.username, '')), LEFT(usw.user_id::TEXT, 8))
  FROM public.user_swap_withdrawals usw
  LEFT JOIN public.profiles p ON p.id = usw.user_id
  WHERE (v_status = 'all' OR usw.status = v_status)
  ORDER BY usw.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_swap_withdrawal(
  p_withdrawal_id UUID,
  p_decision TEXT,
  p_admin_note TEXT DEFAULT ''
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

REVOKE ALL ON FUNCTION public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_swap_withdrawals(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_swap_withdrawal(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_swap_withdrawals(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_swap_withdrawal(UUID, TEXT, TEXT) TO authenticated;
