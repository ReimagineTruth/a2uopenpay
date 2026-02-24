CREATE TABLE IF NOT EXISTS public.user_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 1),
  openpay_account_name TEXT NOT NULL DEFAULT '',
  openpay_account_username TEXT NOT NULL DEFAULT '',
  openpay_account_number TEXT NOT NULL DEFAULT '',
  reference_code TEXT NOT NULL DEFAULT '',
  proof_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  transfer_transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_topup_requests_user_created
  ON public.user_topup_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_topup_requests_status_created
  ON public.user_topup_requests(status, created_at DESC);

ALTER TABLE public.user_topup_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_topup_requests' AND policyname = 'Users can view own topup requests'
  ) THEN
    CREATE POLICY "Users can view own topup requests"
      ON public.user_topup_requests
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_topup_requests_updated_at ON public.user_topup_requests;
CREATE TRIGGER trg_user_topup_requests_updated_at
BEFORE UPDATE ON public.user_topup_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

CREATE OR REPLACE FUNCTION public.submit_topup_request(
  p_amount NUMERIC,
  p_provider TEXT,
  p_openpay_account_name TEXT,
  p_openpay_account_username TEXT,
  p_openpay_account_number TEXT,
  p_reference_code TEXT,
  p_proof_url TEXT
)
RETURNS public.user_topup_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_provider TEXT := LEFT(TRIM(COALESCE(p_provider, '')), 80);
  v_name TEXT := LEFT(TRIM(COALESCE(p_openpay_account_name, '')), 160);
  v_username TEXT := LEFT(TRIM(COALESCE(p_openpay_account_username, '')), 120);
  v_account TEXT := UPPER(TRIM(COALESCE(p_openpay_account_number, '')));
  v_reference TEXT := LEFT(TRIM(COALESCE(p_reference_code, '')), 160);
  v_proof_url TEXT := LEFT(TRIM(COALESCE(p_proof_url, '')), 400);
  v_row public.user_topup_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_amount < 1 THEN
    RAISE EXCEPTION 'Minimum top up is 1 OPEN USD';
  END IF;

  IF v_provider = '' THEN
    RAISE EXCEPTION 'Top up provider is required';
  END IF;

  IF v_name = '' OR v_username = '' OR v_account = '' THEN
    RAISE EXCEPTION 'Complete all required top up fields';
  END IF;
  IF v_reference = '' THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;
  IF v_proof_url = '' THEN
    RAISE EXCEPTION 'Payment proof is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_accounts ua
    WHERE ua.user_id = v_user_id
      AND UPPER(ua.account_number) = v_account
  ) THEN
    RAISE EXCEPTION 'OpenPay account number does not match your profile';
  END IF;

  INSERT INTO public.user_topup_requests (
    user_id,
    provider,
    amount,
    openpay_account_name,
    openpay_account_username,
    openpay_account_number,
    reference_code,
    proof_url,
    status
  )
  VALUES (
    v_user_id,
    v_provider,
    v_amount,
    v_name,
    v_username,
    v_account,
    v_reference,
    v_proof_url,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_topup_requests(
  p_status TEXT DEFAULT 'pending',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  provider TEXT,
  amount NUMERIC,
  openpay_account_name TEXT,
  openpay_account_username TEXT,
  openpay_account_number TEXT,
  reference_code TEXT,
  proof_url TEXT,
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
    utr.id,
    utr.user_id,
    utr.provider,
    utr.amount,
    utr.openpay_account_name,
    utr.openpay_account_username,
    utr.openpay_account_number,
    utr.reference_code,
    utr.proof_url,
    utr.status,
    utr.admin_note,
    utr.reviewed_at,
    utr.created_at,
    COALESCE(NULLIF(p.full_name, ''), CONCAT('@', NULLIF(p.username, '')), LEFT(utr.user_id::TEXT, 8))
  FROM public.user_topup_requests utr
  LEFT JOIN public.profiles p ON p.id = utr.user_id
  WHERE (v_status = 'all' OR utr.status = v_status)
  ORDER BY utr.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_topup_request(
  p_request_id UUID,
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

REVOKE ALL ON FUNCTION public.submit_topup_request(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_topup_requests(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_topup_request(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_topup_request(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Storage bucket for top up proof uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('topup-proof', 'topup-proof', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Topup proof read'
  ) THEN
    CREATE POLICY "Topup proof read"
      ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'topup-proof');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Topup proof insert'
  ) THEN
    CREATE POLICY "Topup proof insert"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'topup-proof');
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_topup_requests(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_topup_request(UUID, TEXT, TEXT) TO authenticated;
