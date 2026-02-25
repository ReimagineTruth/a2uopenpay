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

CREATE OR REPLACE FUNCTION public.admin_list_topup_requests(
  p_limit INTEGER,
  p_offset INTEGER,
  p_status TEXT
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.admin_list_topup_requests(
    p_status::TEXT,
    p_limit::INTEGER,
    p_offset::INTEGER
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_swap_withdrawals(
  p_limit INTEGER,
  p_offset INTEGER,
  p_status TEXT
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.admin_list_swap_withdrawals(
    p_status::TEXT,
    p_limit::INTEGER,
    p_offset::INTEGER
  );
$$;

REVOKE ALL ON FUNCTION public.admin_list_topup_requests(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_topup_requests(INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_swap_withdrawals(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_swap_withdrawals(INTEGER, INTEGER, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_topup_requests(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_topup_requests(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_swap_withdrawals(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_swap_withdrawals(INTEGER, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
