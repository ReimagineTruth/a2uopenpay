-- Complete POS SQL system with additional missing functions
-- This migration completes the POS system with additional utilities and functions

-- Additional POS functions for complete functionality

-- Create POS API key
CREATE OR REPLACE FUNCTION public.create_pos_api_key(
  p_pos_terminal_id UUID DEFAULT NULL,
  p_key_name TEXT DEFAULT 'POS Default Key',
  p_key_mode TEXT DEFAULT 'live'
)
RETURNS TABLE (
  api_key_id UUID,
  publishable_key TEXT,
  secret_key TEXT,
  secret_key_last4 TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_api_key_id UUID;
  v_publishable_key TEXT;
  v_secret_key TEXT;
  v_secret_key_hash TEXT;
  v_secret_key_last4 TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_key_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Key mode must be sandbox or live';
  END IF;

  -- Generate keys
  v_publishable_key := 'pos_pk_' || encode(gen_random_bytes(24), 'hex');
  v_secret_key := 'pos_sk_' || encode(gen_random_bytes(32), 'hex');
  v_secret_key_hash := encode(digest(v_secret_key, 'sha256'), 'hex');
  v_secret_key_last4 := RIGHT(v_secret_key, 4);

  -- Create POS API key
  INSERT INTO public.pos_api_keys (
    merchant_user_id,
    pos_terminal_id,
    key_mode,
    key_name,
    publishable_key,
    secret_key_hash,
    secret_key_last4
  ) VALUES (
    v_user_id,
    p_pos_terminal_id,
    p_key_mode,
    p_key_name,
    v_publishable_key,
    v_secret_key_hash,
    v_secret_key_last4
  ) RETURNING id INTO v_api_key_id;

  RETURN QUERY SELECT 
    v_api_key_id::UUID,
    v_publishable_key::TEXT,
    v_secret_key::TEXT,
    v_secret_key_last4::TEXT;
END;
$$;

-- Get POS API keys
CREATE OR REPLACE FUNCTION public.get_pos_api_keys(
  p_key_mode TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  key_name TEXT,
  key_mode TEXT,
  publishable_key TEXT,
  secret_key_last4 TEXT,
  is_active BOOLEAN,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 
    pak.id,
    pak.key_name,
    pak.key_mode,
    pak.publishable_key,
    pak.secret_key_last4,
    pak.is_active,
    pak.last_used_at,
    pak.created_at
  FROM public.pos_api_keys pak
  WHERE pak.merchant_user_id = auth.uid()
    AND (p_key_mode IS NULL OR pak.key_mode = p_key_mode)
    AND pak.revoked_at IS NULL
  ORDER BY pak.created_at DESC;
END;
$$;

-- Revoke POS API key
CREATE OR REPLACE FUNCTION public.revoke_pos_api_key(
  p_api_key_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_updated_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_api_keys
  SET is_active = false,
      revoked_at = now(),
      updated_at = now()
  WHERE id = p_api_key_id
    AND merchant_user_id = v_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT true::BOOLEAN, 'POS API key revoked successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false::BOOLEAN, 'POS API key not found or already revoked'::TEXT;
  END IF;
END;
$$;

-- Get POS payment history
CREATE OR REPLACE FUNCTION public.get_pos_payment_history(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  session_token TEXT,
  status TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  fee_amount NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  customer_name TEXT,
  customer_email TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 
    pp.id,
    pp.session_token,
    pp.status,
    pp.amount,
    pp.currency,
    pp.fee_amount,
    pp.total_amount,
    pp.customer_name,
    pp.customer_email,
    pp.payment_method,
    pp.created_at,
    pp.paid_at,
    pp.expires_at
  FROM public.pos_payments pp
  WHERE pp.merchant_user_id = auth.uid()
    AND (p_status IS NULL OR pp.status = p_status)
  ORDER BY pp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Get POS payment statistics
CREATE OR REPLACE FUNCTION public.get_pos_payment_statistics(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  total_payments BIGINT,
  total_amount NUMERIC(12,2),
  total_fees NUMERIC(12,2),
  successful_payments BIGINT,
  pending_payments BIGINT,
  expired_payments BIGINT,
  average_amount NUMERIC(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 
    COUNT(*)::BIGINT,
    COALESCE(SUM(total_amount), 0)::NUMERIC(12,2),
    COALESCE(SUM(fee_amount), 0)::NUMERIC(12,2),
    COUNT(CASE WHEN status = 'paid' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN status = 'expired' THEN 1 END)::BIGINT,
    COALESCE(AVG(amount), 0)::NUMERIC(12,2)
  FROM public.pos_payments
  WHERE merchant_user_id = auth.uid()
    AND (p_date_from IS NULL OR DATE(created_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(created_at) <= p_date_to);
END;
$$;

-- Cancel POS payment
CREATE OR REPLACE FUNCTION public.cancel_pos_payment(
  p_session_token TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pos_payment public.pos_payments;
  v_updated_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get POS payment
  SELECT *
  INTO v_pos_payment
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.merchant_user_id = v_user_id
    AND pp.status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, 'POS payment not found or cannot be canceled'::TEXT;
    RETURN;
  END IF;

  -- Update status to canceled
  UPDATE public.pos_payments
  SET status = 'canceled',
      updated_at = now()
  WHERE id = v_pos_payment.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT true::BOOLEAN, 'POS payment canceled successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false::BOOLEAN, 'Failed to cancel POS payment'::TEXT;
  END IF;
END;
$$;

-- Validate POS API key
CREATE OR REPLACE FUNCTION public.validate_pos_api_key(
  p_publishable_key TEXT,
  p_secret_key TEXT
)
RETURNS TABLE (
  valid BOOLEAN,
  merchant_user_id UUID,
  key_mode TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key public.pos_api_keys;
  v_secret_hash TEXT;
BEGIN
  IF p_publishable_key IS NULL OR p_secret_key IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, NULL::TEXT, 'Both keys are required'::TEXT;
    RETURN;
  END IF;

  v_secret_hash := encode(digest(p_secret_key, 'sha256'), 'hex');

  -- Get API key
  SELECT *
  INTO v_api_key
  FROM public.pos_api_keys pak
  WHERE pak.publishable_key = TRIM(p_publishable_key)
    AND pak.secret_key_hash = v_secret_hash
    AND pak.is_active = true
    AND pak.revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, NULL::TEXT, 'Invalid POS API key'::TEXT;
    RETURN;
  END IF;

  -- Update last used at
  UPDATE public.pos_api_keys
  SET last_used_at = now(),
      updated_at = now()
  WHERE id = v_api_key.id;

  RETURN QUERY SELECT 
    true::BOOLEAN,
    v_api_key.merchant_user_id::UUID,
    v_api_key.key_mode::TEXT,
    'POS API key is valid'::TEXT;
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION public.create_pos_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_api_keys TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_pos_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_payment_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_payment_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pos_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_pos_api_key TO authenticated, anon;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_payments_created_at ON public.pos_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_payments_merchant_status ON public.pos_payments(merchant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created_at ON public.pos_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_api_keys_key_mode ON public.pos_api_keys(key_mode, is_active);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pos_payments_updated_at 
    BEFORE UPDATE ON public.pos_payments 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_transactions_updated_at 
    BEFORE UPDATE ON public.pos_transactions 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_api_keys_updated_at 
    BEFORE UPDATE ON public.pos_api_keys 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
