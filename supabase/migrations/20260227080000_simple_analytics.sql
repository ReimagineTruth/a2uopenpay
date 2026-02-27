-- Simple Analytics Fix
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
    COALESCE(SUM(CASE WHEN t.sender_id = p_user_id THEN t.amount ELSE 0 END), 0) as total_sent,
    COALESCE(SUM(CASE WHEN t.receiver_id = p_user_id THEN t.amount ELSE 0 END), 0) as total_received,
    COALESCE(SUM(CASE WHEN t.receiver_id = p_user_id THEN t.amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN t.sender_id = p_user_id THEN t.amount ELSE 0 END), 0) as net_balance,
    COUNT(t.id) as transaction_count,
    COUNT(CASE WHEN pr.requester_id = p_user_id THEN 1 END) as payment_requests_sent,
    COUNT(CASE WHEN pr.payer_id = p_user_id THEN 1 END) as payment_requests_received,
    COUNT(pc.id) as topup_count,
    COALESCE(SUM(pc.amount), 0) as topup_amount
  FROM auth.users u
  LEFT JOIN public.transactions t ON (t.sender_id = p_user_id OR t.receiver_id = p_user_id)
  LEFT JOIN public.payment_requests pr ON (pr.requester_id = p_user_id OR pr.payer_id = p_user_id)
  LEFT JOIN public.pi_payment_credits pc ON pc.user_id = p_user_id
  WHERE u.id = p_user_id
  GROUP BY u.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_analytics_summary TO authenticated;
