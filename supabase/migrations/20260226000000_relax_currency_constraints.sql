-- Relax currency constraints to allow 2-10 character currency codes (OUSD, USDT, etc.)
DO $$
BEGIN
    -- Update merchant_profiles
    ALTER TABLE public.merchant_profiles DROP CONSTRAINT IF EXISTS merchant_profiles_default_currency_check;
    ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_default_currency_check CHECK (char_length(default_currency) >= 2 AND char_length(default_currency) <= 10);

    -- Update merchant_products
    ALTER TABLE public.merchant_products DROP CONSTRAINT IF EXISTS merchant_products_currency_check;
    ALTER TABLE public.merchant_products ADD CONSTRAINT merchant_products_currency_check CHECK (char_length(currency) >= 2 AND char_length(currency) <= 10);

    -- Update merchant_checkout_sessions
    ALTER TABLE public.merchant_checkout_sessions DROP CONSTRAINT IF EXISTS merchant_checkout_sessions_currency_check;
    ALTER TABLE public.merchant_checkout_sessions ADD CONSTRAINT merchant_checkout_sessions_currency_check CHECK (char_length(currency) >= 2 AND char_length(currency) <= 10);

    -- Update merchant_payments
    ALTER TABLE public.merchant_payments DROP CONSTRAINT IF EXISTS merchant_payments_currency_check;
    ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_currency_check CHECK (char_length(currency) >= 2 AND char_length(currency) <= 10);

    -- Update merchant_payment_links
    ALTER TABLE public.merchant_payment_links DROP CONSTRAINT IF EXISTS merchant_payment_links_currency_check;
    ALTER TABLE public.merchant_payment_links ADD CONSTRAINT merchant_payment_links_currency_check CHECK (char_length(currency) >= 2 AND char_length(currency) <= 10);
END $$;

-- Drop all versions of functions to ensure clean replacement
DROP FUNCTION IF EXISTS public.create_my_pos_checkout_session(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_my_pos_checkout_session(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.create_merchant_checkout_session(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER);
DROP FUNCTION IF EXISTS public.create_merchant_payment_link(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_merchant_pos_terminal_session(UUID, NUMERIC, TEXT, TEXT);

-- 1. create_my_pos_checkout_session
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

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    RAISE EXCEPTION 'Currency must be between 2 and 10 characters';
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
      AND (mak.secret_key_hash = md5(p_secret_key) OR mak.secret_key_hash = encode(digest(p_secret_key, 'sha256'), 'hex'))
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
    jsonb_build_object(
      'pos_checkout', true,
      'pos_reference', p_reference,
      'customer_name', p_customer_name,
      'customer_email', p_customer_email,
      'qr_style', v_qr_style
    ),
    now() + (v_expires_minutes || ' minutes')::INTERVAL
  )
  RETURNING * INTO v_session;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.session_token,
    v_session.total_amount,
    v_session.currency,
    v_session.status,
    v_session.expires_at,
    CASE
      WHEN v_qr_style = 'static' THEN 'openpay-pos-static:' || v_user_id::TEXT || ':' || v_api_key_id::TEXT
      ELSE 'openpay-checkout:' || v_session.session_token
    END;
END;
$$;

-- 2. create_merchant_checkout_session
CREATE OR REPLACE FUNCTION public.create_merchant_checkout_session(
  p_secret_key TEXT,
  p_mode TEXT,
  p_currency TEXT,
  p_items JSONB,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_success_url TEXT DEFAULT NULL,
  p_cancel_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_in_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, '')));
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_merchant_user_id UUID;
  v_api_key_id UUID;
  v_session public.merchant_checkout_sessions;
  v_item JSONB;
  v_product public.merchant_products;
  v_quantity INTEGER;
  v_line_total NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_expires_minutes INTEGER := GREATEST(5, LEAST(COALESCE(p_expires_in_minutes, 60), 10080));
BEGIN
  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    RAISE EXCEPTION 'Currency must be between 2 and 10 characters';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  SELECT mak.merchant_user_id, mak.id
  INTO v_merchant_user_id, v_api_key_id
  FROM public.merchant_api_keys mak
  WHERE (mak.secret_key_hash = md5(p_secret_key) OR mak.secret_key_hash = encode(digest(p_secret_key, 'sha256'), 'hex'))
    AND mak.key_mode = v_mode
    AND mak.is_active = true
  LIMIT 1;

  IF v_merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid merchant API key for mode %', v_mode;
  END IF;

  INSERT INTO public.merchant_checkout_sessions (
    merchant_user_id,
    key_mode,
    session_token,
    status,
    currency,
    subtotal_amount,
    fee_amount,
    total_amount,
    customer_email,
    customer_name,
    success_url,
    cancel_url,
    metadata,
    expires_at
  )
  VALUES (
    v_merchant_user_id,
    v_mode,
    'opsess_' || public.random_token_hex(24),
    'open',
    v_currency,
    0,
    0,
    0,
    NULLIF(TRIM(COALESCE(p_customer_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_customer_name, '')), ''),
    NULLIF(TRIM(COALESCE(p_success_url, '')), ''),
    NULLIF(TRIM(COALESCE(p_cancel_url, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    now() + (v_expires_minutes || ' minutes')::INTERVAL
  )
  RETURNING * INTO v_session;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT *
    INTO v_product
    FROM public.merchant_products mp
    WHERE mp.id = (v_item->>'product_id')::UUID
      AND mp.merchant_user_id = v_merchant_user_id
      AND mp.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid product_id in items payload';
    END IF;

    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    IF v_quantity < 1 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'Quantity must be between 1 and 1000';
    END IF;

    IF UPPER(v_product.currency) <> v_currency THEN
      RAISE EXCEPTION 'Product currency mismatch for product %', v_product.id;
    END IF;

    v_line_total := ROUND(v_product.unit_amount * v_quantity, 2);

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
      v_product.id,
      v_product.product_name,
      v_product.unit_amount,
      v_quantity,
      v_line_total
    );

    v_total := v_total + v_line_total;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Session total must be positive';
  END IF;

  UPDATE public.merchant_checkout_sessions
  SET subtotal_amount = v_total,
      total_amount = v_total
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  UPDATE public.merchant_api_keys
  SET last_used_at = now()
  WHERE id = v_api_key_id;

  RETURN QUERY
  SELECT v_session.id, v_session.session_token, v_session.total_amount, v_session.currency, v_session.expires_at;
END;
$$;

-- 3. create_merchant_payment_link
CREATE OR REPLACE FUNCTION public.create_merchant_payment_link(
  p_secret_key TEXT,
  p_mode TEXT,
  p_link_type TEXT,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'USD',
  p_custom_amount NUMERIC DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_collect_customer_name BOOLEAN DEFAULT true,
  p_collect_customer_email BOOLEAN DEFAULT true,
  p_collect_phone BOOLEAN DEFAULT false,
  p_collect_address BOOLEAN DEFAULT false,
  p_after_payment_type TEXT DEFAULT 'confirmation',
  p_confirmation_message TEXT DEFAULT NULL,
  p_redirect_url TEXT DEFAULT NULL,
  p_call_to_action TEXT DEFAULT 'Pay',
  p_expires_in_minutes INTEGER DEFAULT NULL
)
RETURNS TABLE (
  link_id UUID,
  link_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  key_mode TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, '')));
  v_link_type TEXT := LOWER(TRIM(COALESCE(p_link_type, '')));
  v_after_payment_type TEXT := LOWER(TRIM(COALESCE(p_after_payment_type, 'confirmation')));
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_merchant_user_id UUID;
  v_api_key_id UUID;
  v_link public.merchant_payment_links;
  v_item JSONB;
  v_product public.merchant_products;
  v_quantity INTEGER;
  v_line_total NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF v_link_type NOT IN ('products', 'custom_amount') THEN
    RAISE EXCEPTION 'Link type must be products or custom_amount';
  END IF;

  IF v_after_payment_type NOT IN ('confirmation', 'redirect') THEN
    RAISE EXCEPTION 'After payment type must be confirmation or redirect';
  END IF;

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    RAISE EXCEPTION 'Currency must be between 2 and 10 characters';
  END IF;

  SELECT mak.merchant_user_id, mak.id
  INTO v_merchant_user_id, v_api_key_id
  FROM public.merchant_api_keys mak
  WHERE (mak.secret_key_hash = md5(p_secret_key) OR mak.secret_key_hash = encode(digest(p_secret_key, 'sha256'), 'hex'))
    AND mak.key_mode = v_mode
    AND mak.is_active = true
  LIMIT 1;

  IF v_merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid merchant API key for mode %', v_mode;
  END IF;

  IF p_expires_in_minutes IS NOT NULL THEN
    v_expires_at := now() + (GREATEST(5, LEAST(p_expires_in_minutes, 525600)) || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO public.merchant_payment_links (
    merchant_user_id,
    api_key_id,
    key_mode,
    link_token,
    link_type,
    title,
    description,
    currency,
    custom_amount,
    collect_customer_name,
    collect_customer_email,
    collect_phone,
    collect_address,
    after_payment_type,
    confirmation_message,
    redirect_url,
    call_to_action,
    expires_at
  )
  VALUES (
    v_merchant_user_id,
    v_api_key_id,
    v_mode,
    'oplink_' || public.random_token_hex(24),
    v_link_type,
    COALESCE(NULLIF(TRIM(p_title), ''), 'OpenPay Payment'),
    COALESCE(NULLIF(TRIM(p_description), ''), ''),
    v_currency,
    p_custom_amount,
    COALESCE(p_collect_customer_name, true),
    COALESCE(p_collect_customer_email, true),
    COALESCE(p_collect_phone, false),
    COALESCE(p_collect_address, false),
    v_after_payment_type,
    COALESCE(NULLIF(TRIM(p_confirmation_message), ''), 'Thanks for your payment.'),
    NULLIF(TRIM(COALESCE(p_redirect_url, '')), ''),
    COALESCE(NULLIF(TRIM(p_call_to_action), ''), 'Pay'),
    v_expires_at
  )
  RETURNING * INTO v_link;

  IF v_link_type = 'custom_amount' THEN
    IF p_custom_amount IS NULL OR p_custom_amount <= 0 THEN
      RAISE EXCEPTION 'Custom amount must be greater than 0';
    END IF;
    v_total := ROUND(p_custom_amount, 2);
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'At least one product item is required';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      SELECT *
      INTO v_product
      FROM public.merchant_products mp
      WHERE mp.id = (v_item->>'product_id')::UUID
        AND mp.merchant_user_id = v_merchant_user_id
        AND mp.is_active = true
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid product_id in items payload';
      END IF;

      v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
      IF v_quantity < 1 OR v_quantity > 1000 THEN
        RAISE EXCEPTION 'Quantity must be between 1 and 1000';
      END IF;

      IF UPPER(v_product.currency) <> v_currency THEN
        RAISE EXCEPTION 'Product currency mismatch for product %', v_product.id;
      END IF;

      v_line_total := ROUND(v_product.unit_amount * v_quantity, 2);

      INSERT INTO public.merchant_payment_link_items (
        link_id,
        product_id,
        item_name,
        unit_amount,
        quantity,
        line_total
      )
      VALUES (
        v_link.id,
        v_product.id,
        v_product.product_name,
        v_product.unit_amount,
        v_quantity,
        v_line_total
      );

      v_total := v_total + v_line_total;
    END LOOP;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Link total must be positive';
  END IF;

  UPDATE public.merchant_payment_links
  SET total_amount = v_total
  WHERE id = v_link.id
  RETURNING * INTO v_link;

  UPDATE public.merchant_api_keys
  SET last_used_at = now()
  WHERE id = v_api_key_id;

  RETURN QUERY
  SELECT v_link.id, v_link.link_token, v_link.total_amount, v_link.currency, v_link.key_mode, v_link.expires_at;
END;
$$;

-- 4. upsert_my_merchant_profile
CREATE OR REPLACE FUNCTION public.upsert_my_merchant_profile(
  p_merchant_name TEXT DEFAULT NULL,
  p_merchant_username TEXT DEFAULT NULL,
  p_merchant_logo_url TEXT DEFAULT NULL,
  p_default_currency TEXT DEFAULT NULL
)
RETURNS public.merchant_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_name TEXT;
  v_profile_username TEXT;
  v_profile_logo TEXT;
  v_profile public.merchant_profiles;
  v_currency TEXT := UPPER(TRIM(COALESCE(p_default_currency, 'USD')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    v_currency := 'USD';
  END IF;

  SELECT full_name, COALESCE(username, ''), avatar_url
  INTO v_profile_name, v_profile_username, v_profile_logo
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.merchant_profiles (
    user_id,
    merchant_name,
    merchant_username,
    merchant_logo_url,
    default_currency
  )
  VALUES (
    v_user_id,
    COALESCE(NULLIF(TRIM(p_merchant_name), ''), NULLIF(TRIM(v_profile_name), ''), 'OpenPay Merchant'),
    COALESCE(NULLIF(TRIM(p_merchant_username), ''), NULLIF(TRIM(v_profile_username), ''), 'openpay-merchant'),
    COALESCE(NULLIF(TRIM(p_merchant_logo_url), ''), v_profile_logo),
    v_currency
  )
  ON CONFLICT (user_id) DO UPDATE
  SET merchant_name = COALESCE(NULLIF(TRIM(p_merchant_name), ''), public.merchant_profiles.merchant_name),
      merchant_username = COALESCE(NULLIF(TRIM(p_merchant_username), ''), public.merchant_profiles.merchant_username),
      merchant_logo_url = COALESCE(NULLIF(TRIM(p_merchant_logo_url), ''), public.merchant_profiles.merchant_logo_url),
      default_currency = v_currency,
      is_active = true
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

-- 5. create_merchant_pos_terminal_session
CREATE OR REPLACE FUNCTION public.create_merchant_pos_terminal_session(
  p_terminal_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_reference TEXT DEFAULT NULL
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
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_terminal public.merchant_pos_terminals;
  v_session public.merchant_checkout_sessions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    RAISE EXCEPTION 'Currency must be between 2 and 10 characters';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_terminal
  FROM public.merchant_pos_terminals
  WHERE id = p_terminal_id AND merchant_user_id = v_user_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Terminal not found or inactive';
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
    metadata,
    expires_at
  )
  VALUES (
    v_user_id,
    v_terminal.api_key_id,
    'live',
    'opsess_' || public.random_token_hex(24),
    'open',
    v_currency,
    v_amount,
    0,
    v_amount,
    jsonb_build_object(
      'pos_checkout', true,
      'terminal_id', p_terminal_id,
      'pos_reference', p_reference
    ),
    now() + INTERVAL '30 minutes'
  )
  RETURNING * INTO v_session;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.session_token,
    v_session.total_amount,
    v_session.currency,
    v_session.status,
    v_session.expires_at,
    'openpay-checkout:' || v_session.session_token;
END;
$$;
