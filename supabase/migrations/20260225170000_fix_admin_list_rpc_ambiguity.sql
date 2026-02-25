-- Resolve PostgREST function overload ambiguity for admin list RPCs.
-- Keep only the canonical signature:
--   (p_status TEXT DEFAULT 'pending', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
-- and remove compatibility overload:
--   (p_limit INTEGER, p_offset INTEGER, p_status TEXT)

DROP FUNCTION IF EXISTS public.admin_list_topup_requests(INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.admin_list_swap_withdrawals(INTEGER, INTEGER, TEXT);

REVOKE ALL ON FUNCTION public.admin_list_topup_requests(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_swap_withdrawals(TEXT, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_topup_requests(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_swap_withdrawals(TEXT, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
