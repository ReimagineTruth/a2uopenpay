-- Basic Analytics - Simplified version without complex joins
CREATE OR REPLACE FUNCTION public.get_user_analytics_summary(p_user_id UUID)
RETURNS TABLE (
  total_sent NUMERIC,
  total_received NUMERIC,
  net_balance NUMERIC,
  transaction_count BIGINT,
  payment_requests_sent BIGINT,
  payment_requests_received BIGINT,
  topup_count BIGINT,
  topup_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE sender_id = p_user_id), 0) as total_sent,
    COALESCE((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE receiver_id = p_user_id), 0) as total_received,
    COALESCE((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE receiver_id = p_user_id), 0) - 
    COALESCE((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE sender_id = p_user_id), 0) as net_balance,
    COALESCE((SELECT COUNT(*) FROM public.transactions WHERE sender_id = p_user_id OR receiver_id = p_user_id), 0) as transaction_count,
    COALESCE((SELECT COUNT(*) FROM public.payment_requests WHERE requester_id = p_user_id), 0) as payment_requests_sent,
    COALESCE((SELECT COUNT(*) FROM public.payment_requests WHERE payer_id = p_user_id), 0) as payment_requests_received,
    COALESCE((SELECT COUNT(*) FROM public.pi_payment_credits WHERE user_id = p_user_id), 0) as topup_count,
    COALESCE((SELECT COALESCE(SUM(amount), 0) FROM public.pi_payment_credits WHERE user_id = p_user_id), 0) as topup_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_analytics_summary TO authenticated;
