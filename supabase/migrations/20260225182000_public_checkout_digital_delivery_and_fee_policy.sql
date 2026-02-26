DROP FUNCTION IF EXISTS public.get_public_merchant_checkout_session(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_merchant_checkout_session(
  p_session_token TEXT
)
RETURNS TABLE (
  session_id UUID,
  status TEXT,
  mode TEXT,
  currency TEXT,
  amount NUMERIC,
  subtotal_amount NUMERIC,
  fee_amount NUMERIC,
  fee_payer TEXT,
  merchant_settlement_amount NUMERIC,
  expires_at TIMESTAMPTZ,
  merchant_user_id UUID,
  merchant_name TEXT,
  merchant_username TEXT,
  merchant_logo_url TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.merchant_checkout_sessions;
  v_fee_payer TEXT;
  v_settlement NUMERIC(12,2);
BEGIN
  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_session.status = 'open' AND v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions
    SET status = 'expired'
    WHERE id = v_session.id
      AND status = 'open';

    SELECT *
    INTO v_session
    FROM public.merchant_checkout_sessions
    WHERE id = v_session.id;
  END IF;

  v_fee_payer := LOWER(COALESCE(NULLIF(TRIM(v_session.metadata->>'fee_payer'), ''), 'customer'));
  v_settlement := COALESCE(
    NULLIF(TRIM(v_session.metadata->>'merchant_settlement_amount'), '')::NUMERIC,
    CASE
      WHEN v_fee_payer = 'merchant' THEN GREATEST(COALESCE(v_session.subtotal_amount, 0) - COALESCE(v_session.fee_amount, 0), 0)
      ELSE COALESCE(v_session.subtotal_amount, COALESCE(v_session.total_amount, 0))
    END
  );

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.status,
    v_session.key_mode,
    v_session.currency,
    v_session.total_amount,
    v_session.subtotal_amount,
    v_session.fee_amount,
    v_fee_payer,
    v_settlement,
    v_session.expires_at,
    mp.user_id,
    mp.merchant_name,
    mp.merchant_username,
    mp.merchant_logo_url,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', mcsi.product_id,
            'item_name', mcsi.item_name,
            'quantity', mcsi.quantity,
            'unit_amount', mcsi.unit_amount,
            'line_total', mcsi.line_total,
            'item_image_url', prod.image_url,
            'item_images', CASE
              WHEN jsonb_typeof(prod.metadata->'product_images') = 'array' THEN prod.metadata->'product_images'
              ELSE '[]'::jsonb
            END,
            'product_kind', LOWER(COALESCE(prod.metadata->>'product_kind', 'physical')),
            'delivery_type', LOWER(NULLIF(COALESCE(prod.metadata->>'digital_delivery_type', ''), '')),
            'delivery_file_name', NULLIF(COALESCE(prod.metadata->>'digital_file_name', ''), ''),
            'delivery_file_data_url', NULLIF(COALESCE(prod.metadata->>'digital_file_data_url', ''), ''),
            'delivery_link_url', NULLIF(COALESCE(prod.metadata->>'digital_download_link', ''), '')
          )
          ORDER BY mcsi.created_at ASC
        )
        FROM public.merchant_checkout_session_items mcsi
        LEFT JOIN public.merchant_products prod
          ON prod.id = mcsi.product_id
        WHERE mcsi.session_id = v_session.id
      ),
      '[]'::jsonb
    )
  FROM public.merchant_profiles mp
  WHERE mp.user_id = v_session.merchant_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_checkout_session_from_payment_link(
  p_link_token TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  expires_at TIMESTAMPTZ,
  after_payment_type TEXT,
  confirmation_message TEXT,
  redirect_url TEXT,
  call_to_action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.merchant_payment_links;
  v_session public.merchant_checkout_sessions;
  v_total NUMERIC(12,2) := 0;
  v_fee_payer TEXT := 'customer';
  v_fee_amount NUMERIC(12,2) := 0;
  v_total_due NUMERIC(12,2) := 0;
  v_merchant_settlement NUMERIC(12,2) := 0;
BEGIN
  SELECT *
  INTO v_link
  FROM public.merchant_payment_links mpl
  WHERE mpl.link_token = TRIM(COALESCE(p_link_token, ''))
    AND mpl.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment link not found';
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RAISE EXCEPTION 'Payment link expired';
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
    success_url,
    cancel_url,
    metadata,
    expires_at
  )
  VALUES (
    v_link.merchant_user_id,
    v_link.api_key_id,
    v_link.key_mode,
    'opsess_' || public.random_token_hex(24),
    'open',
    v_link.currency,
    0,
    0,
    0,
    NULLIF(TRIM(COALESCE(p_customer_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_customer_name, '')), ''),
    NULL,
    NULL,
    jsonb_build_object(
      'payment_link_id', v_link.id,
      'payment_link_token', v_link.link_token,
      'api_key_id', v_link.api_key_id,
      'after_payment_type', v_link.after_payment_type,
      'confirmation_message', v_link.confirmation_message,
      'redirect_url', v_link.redirect_url,
      'call_to_action', v_link.call_to_action
    ),
    now() + INTERVAL '60 minutes'
  )
  RETURNING * INTO v_session;

  IF v_link.link_type = 'custom_amount' THEN
    v_total := COALESCE(v_link.custom_amount, 0);

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
      v_link.title,
      v_total,
      1,
      v_total
    );
  ELSE
    INSERT INTO public.merchant_checkout_session_items (
      session_id,
      product_id,
      item_name,
      unit_amount,
      quantity,
      line_total
    )
    SELECT
      v_session.id,
      mpli.product_id,
      mpli.item_name,
      mpli.unit_amount,
      mpli.quantity,
      mpli.line_total
    FROM public.merchant_payment_link_items mpli
    WHERE mpli.link_id = v_link.id;

    SELECT COALESCE(SUM(mpli.line_total), 0)
    INTO v_total
    FROM public.merchant_payment_link_items mpli
    WHERE mpli.link_id = v_link.id;

    SELECT LOWER(COALESCE(NULLIF(TRIM(prod.metadata->>'fee_payer'), ''), 'customer'))
    INTO v_fee_payer
    FROM public.merchant_payment_link_items mpli
    JOIN public.merchant_products prod
      ON prod.id = mpli.product_id
    WHERE mpli.link_id = v_link.id
    ORDER BY mpli.created_at ASC
    LIMIT 1;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Payment link total must be positive';
  END IF;

  v_fee_amount := ROUND(v_total * 0.02, 2);
  v_total_due := CASE WHEN v_fee_payer = 'customer' THEN ROUND(v_total + v_fee_amount, 2) ELSE ROUND(v_total, 2) END;
  v_merchant_settlement := CASE WHEN v_fee_payer = 'merchant' THEN GREATEST(ROUND(v_total - v_fee_amount, 2), 0) ELSE ROUND(v_total, 2) END;

  UPDATE public.merchant_checkout_sessions
  SET subtotal_amount = v_total,
      fee_amount = v_fee_amount,
      total_amount = v_total_due,
      metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
        'fee_percent', 2,
        'fee_payer', v_fee_payer,
        'merchant_settlement_amount', v_merchant_settlement,
        'openpay_fee_amount', v_fee_amount
      )
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.session_token,
    v_session.total_amount,
    v_session.currency,
    v_session.expires_at,
    v_link.after_payment_type,
    v_link.confirmation_message,
    v_link.redirect_url,
    v_link.call_to_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_with_virtual_card(
  p_session_token TEXT,
  p_card_number TEXT,
  p_expiry_month INTEGER,
  p_expiry_year INTEGER,
  p_cvc TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_user_id UUID := auth.uid();
  v_session public.merchant_checkout_sessions;
  v_sender_balance NUMERIC(12,2);
  v_receiver_balance NUMERIC(12,2);
  v_openpay_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_card_number TEXT := regexp_replace(COALESCE(p_card_number, ''), '\D', '', 'g');
  v_cvc TEXT := regexp_replace(COALESCE(p_cvc, ''), '\D', '', 'g');
  v_expiry_end DATE;
  v_expiry_year INTEGER := COALESCE(p_expiry_year, 0);
  v_payment_link_id UUID;
  v_payment_link_token TEXT;
  v_card_owner_user_id UUID;
  v_currency_rate NUMERIC(20,8) := 1;
  v_wallet_amount NUMERIC(12,2) := 0;
  v_openpay_user_id UUID;
  v_fee_payer TEXT := 'customer';
  v_fee_amount NUMERIC(12,2) := 0;
  v_merchant_settlement NUMERIC(12,2) := 0;
BEGIN
  v_openpay_user_id := public.get_openpay_settlement_user_id();

  IF v_expiry_year > 0 AND v_expiry_year < 100 THEN
    v_expiry_year := 2000 + v_expiry_year;
  END IF;

  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout session not found';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Checkout session is not open';
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions
    SET status = 'expired'
    WHERE id = v_session.id;
    RAISE EXCEPTION 'Checkout session expired';
  END IF;

  IF char_length(v_card_number) <> 16 THEN
    RAISE EXCEPTION 'Card number must be 16 digits';
  END IF;

  IF p_expiry_month IS NULL OR p_expiry_month < 1 OR p_expiry_month > 12 THEN
    RAISE EXCEPTION 'Invalid expiry month';
  END IF;

  IF v_expiry_year < 2026 THEN
    RAISE EXCEPTION 'Invalid expiry year';
  END IF;

  IF char_length(v_cvc) <> 3 THEN
    RAISE EXCEPTION 'Invalid CVC';
  END IF;

  v_expiry_end := (make_date(v_expiry_year, p_expiry_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  IF v_expiry_end < CURRENT_DATE THEN
    RAISE EXCEPTION 'Card expired';
  END IF;

  SELECT vc.user_id
  INTO v_card_owner_user_id
  FROM public.virtual_cards vc
  WHERE vc.card_number = v_card_number
    AND vc.expiry_month = p_expiry_month
    AND vc.expiry_year = v_expiry_year
    AND vc.cvc = v_cvc
    AND vc.is_active = true
    AND COALESCE(vc.is_locked, false) = false
    AND COALESCE((vc.card_settings ->> 'allow_checkout')::BOOLEAN, true) = true
  FOR UPDATE;

  IF v_card_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid virtual card details';
  END IF;

  IF v_buyer_user_id IS NULL THEN
    v_buyer_user_id := v_card_owner_user_id;
  END IF;

  IF v_card_owner_user_id <> v_buyer_user_id THEN
    RAISE EXCEPTION 'Card owner does not match authenticated customer';
  END IF;

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

  v_fee_payer := LOWER(COALESCE(NULLIF(TRIM(v_session.metadata->>'fee_payer'), ''), 'customer'));
  v_fee_amount := COALESCE(v_session.fee_amount, ROUND(COALESCE(v_session.subtotal_amount, 0) * 0.02, 2));
  v_merchant_settlement := COALESCE(
    NULLIF(TRIM(v_session.metadata->>'merchant_settlement_amount'), '')::NUMERIC,
    CASE
      WHEN v_fee_payer = 'merchant' THEN GREATEST(COALESCE(v_session.subtotal_amount, 0) - v_fee_amount, 0)
      ELSE COALESCE(v_session.subtotal_amount, COALESCE(v_session.total_amount, 0))
    END
  );

  SELECT sc.usd_rate
  INTO v_currency_rate
  FROM public.supported_currencies sc
  WHERE sc.iso_code = UPPER(COALESCE(v_session.currency, 'USD'))
    AND sc.is_active = true
  LIMIT 1;

  v_currency_rate := COALESCE(NULLIF(v_currency_rate, 0), 1);
  v_wallet_amount := ROUND(COALESCE(v_session.total_amount, 0) / v_currency_rate, 2);

  IF v_wallet_amount <= 0 THEN
    RAISE EXCEPTION 'Checkout amount must be greater than zero';
  END IF;

  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = v_card_owner_user_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Buyer wallet not found';
  END IF;

  SELECT balance INTO v_receiver_balance
  FROM public.wallets
  WHERE user_id = v_session.merchant_user_id
  FOR UPDATE;

  IF v_receiver_balance IS NULL THEN
    RAISE EXCEPTION 'Merchant wallet not found';
  END IF;

  SELECT balance INTO v_openpay_balance
  FROM public.wallets
  WHERE user_id = v_openpay_user_id
  FOR UPDATE;

  IF v_openpay_balance IS NULL THEN
    RAISE EXCEPTION 'OpenPay settlement wallet not found';
  END IF;

  IF v_sender_balance < v_wallet_amount THEN
    RAISE EXCEPTION 'Insufficient virtual card balance';
  END IF;

  UPDATE public.wallets
  SET balance = v_sender_balance - v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_card_owner_user_id;

  UPDATE public.wallets
  SET balance = v_receiver_balance + v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  UPDATE public.wallets
  SET balance = balance - v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  UPDATE public.wallets
  SET balance = v_openpay_balance + v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_openpay_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_card_owner_user_id,
    v_session.merchant_user_id,
    v_wallet_amount,
    CONCAT(
      'Merchant checkout ',
      v_session.session_token,
      ' | Card ****',
      RIGHT(v_card_number, 4),
      ' | Held in merchant available balance',
      CASE WHEN COALESCE(TRIM(p_note), '') <> '' THEN CONCAT(' | ', TRIM(p_note)) ELSE '' END
    ),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  v_payment_link_id := NULLIF((v_session.metadata->>'payment_link_id')::UUID, NULL);
  v_payment_link_token := NULLIF(TRIM(COALESCE(v_session.metadata->>'payment_link_token', '')), '');

  INSERT INTO public.merchant_payments (
    session_id,
    merchant_user_id,
    buyer_user_id,
    transaction_id,
    amount,
    currency,
    api_key_id,
    key_mode,
    payment_link_id,
    payment_link_token,
    status
  )
  VALUES (
    v_session.id,
    v_session.merchant_user_id,
    v_buyer_user_id,
    v_transaction_id,
    v_merchant_settlement,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    v_payment_link_id,
    v_payment_link_token,
    'succeeded'
  );

  UPDATE public.merchant_checkout_sessions
  SET status = 'paid',
      paid_at = now(),
      metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
        'fee_payer', v_fee_payer,
        'openpay_fee_amount', v_fee_amount,
        'merchant_settlement_amount', v_merchant_settlement
      )
  WHERE id = v_session.id;

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_merchant_checkout_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_checkout_session_from_payment_link(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_merchant_checkout_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_session_from_payment_link(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
