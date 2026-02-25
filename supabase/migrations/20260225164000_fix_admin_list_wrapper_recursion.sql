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
    p_status,
    p_limit,
    p_offset
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
    p_status,
    p_limit,
    p_offset
  );
$$;

REVOKE ALL ON FUNCTION public.admin_list_topup_requests(INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_swap_withdrawals(INTEGER, INTEGER, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_topup_requests(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_swap_withdrawals(INTEGER, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
