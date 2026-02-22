CREATE OR REPLACE FUNCTION public.create_my_pos_checkout_session(
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_mode TEXT DEFAULT 'live',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_qr_style TEXT DEFAULT 'dynamic',
  p_expires_in_minutes INTEGER DEFAULT 30,
  p_secret_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  qr_payload TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_qr_style TEXT := LOWER(TRIM(COALESCE(p_qr_style, 'dynamic')));
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_expires_minutes INTEGER := GREATEST(5, LEAST(COALESCE(p_expires_in_minutes, 30), 10080));
  v_secret_hash TEXT := md5(COALESCE(p_secret_key, ''));
  v_api_key_id UUID;
  v_api_key_ok BOOLEAN := false;
  v_session public.merchant_checkout_sessions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 3 THEN
    RAISE EXCEPTION 'Currency must be 2 or 3 letters';
  END IF;

  IF v_qr_style NOT IN ('dynamic', 'static') THEN
    RAISE EXCEPTION 'QR style must be dynamic or static';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF NULLIF(TRIM(COALESCE(p_secret_key, '')), '') IS NOT NULL THEN
    SELECT mak.id
    INTO v_api_key_id
    FROM public.merchant_api_keys mak
    WHERE mak.merchant_user_id = v_user_id
      AND mak.key_mode = v_mode
      AND mak.is_active = true
      AND mak.secret_key_hash = v_secret_hash
    LIMIT 1;
  ELSE
    SELECT
      CASE
        WHEN v_mode = 'sandbox' THEN s.sandbox_api_key_id
        ELSE s.live_api_key_id
      END
    INTO v_api_key_id
    FROM public.merchant_pos_api_settings s
    WHERE s.merchant_user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_api_key_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.merchant_api_keys mak
      WHERE mak.id = v_api_key_id
        AND mak.merchant_user_id = v_user_id
        AND mak.key_mode = v_mode
        AND mak.is_active = true
    )
    INTO v_api_key_ok;
  END IF;

  IF NOT v_api_key_ok THEN
    RAISE EXCEPTION 'Set your % POS API key in Settings first (from Merchant Portal / API keys)', v_mode;
  END IF;

  PERFORM public.upsert_my_merchant_profile(NULL, NULL, NULL, v_currency);

  IF v_qr_style = 'static' THEN
    v_expires_minutes := GREATEST(v_expires_minutes, 1440);
  END IF;

  INSERT INTO public.merchant_checkout_sessions (
    merchant_user_id,
    api_key_id,
    key_mode,
    session_token,
    status,
    currency,
    subtotal_amount,
    fee_amount,
    total_amount,
    customer_email,
    customer_name,
    metadata,
    expires_at
  )
  VALUES (
    v_user_id,
    v_api_key_id,
    v_mode,
    'opsess_' || public.random_token_hex(24),
    'open',
    v_currency,
    v_amount,
    0,
    v_amount,
    NULLIF(TRIM(COALESCE(p_customer_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_customer_name, '')), ''),
    jsonb_strip_nulls(
      jsonb_build_object(
        'channel', 'pos',
        'source', 'merchant_pos',
        'api_key_id', v_api_key_id::TEXT,
        'qr_style', v_qr_style,
        'reference', NULLIF(TRIM(COALESCE(p_reference, '')), '')
      )
    ),
    now() + make_interval(mins => v_expires_minutes)
  )
  RETURNING * INTO v_session;

  INSERT INTO public.merchant_checkout_session_items (
    session_id,
    product_id,
    item_name,
    unit_amount,
    quantity,
    line_total
  )
  VALUES (
    v_session.id,
    NULL,
    'POS Payment',
    v_amount,
    1,
    v_amount
  );

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.session_token,
    v_session.total_amount,
    v_session.currency,
    v_session.status,
    v_session.expires_at,
    'openpay-pos://checkout/' || v_session.session_token;
END;
$$;
