CREATE OR REPLACE FUNCTION public.get_openpay_settlement_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_openpay_user_id UUID;
BEGIN
  SELECT ua.user_id
  INTO v_openpay_user_id
  FROM public.user_accounts ua
  WHERE LOWER(TRIM(COALESCE(ua.account_username, ''))) = 'openpay'
  ORDER BY
    CASE
      WHEN UPPER(TRIM(COALESCE(ua.account_number, ''))) = 'OPEA68BB7A9F964994A199A15786D680FA' THEN 0
      ELSE 1
    END,
    ua.created_at ASC
  LIMIT 1;

  IF v_openpay_user_id IS NULL THEN
    RAISE EXCEPTION 'OpenPay settlement account not found';
  END IF;

  RETURN v_openpay_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_merchant_balance_overview(
  p_mode TEXT DEFAULT 'live'
)
RETURNS TABLE (
  gross_volume NUMERIC,
  refunded_total NUMERIC,
  transferred_total NUMERIC,
  available_balance NUMERIC,
  wallet_balance NUMERIC,
  savings_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_gross NUMERIC(14,2) := 0;
  v_refunded NUMERIC(14,2) := 0;
  v_transferred NUMERIC(14,2) := 0;
  v_wallet NUMERIC(14,2) := 0;
  v_savings NUMERIC(14,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mp.status = 'refunded' THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) ELSE 0 END), 0)
  INTO v_gross, v_refunded
  FROM public.merchant_payments mp
  LEFT JOIN public.supported_currencies sc
    ON sc.iso_code = UPPER(COALESCE(mp.currency, 'USD'))
  WHERE mp.merchant_user_id = v_user_id
    AND mp.key_mode = v_mode;

  SELECT COALESCE(SUM(mbt.amount), 0)
  INTO v_transferred
  FROM public.merchant_balance_transfers mbt
  WHERE mbt.merchant_user_id = v_user_id
    AND mbt.key_mode = v_mode;

  SELECT COALESCE(w.balance, 0)
  INTO v_wallet
  FROM public.wallets w
  WHERE w.user_id = v_user_id;

  PERFORM public.upsert_my_savings_account();
  SELECT COALESCE(usa.balance, 0)
  INTO v_savings
  FROM public.user_savings_accounts usa
  WHERE usa.user_id = v_user_id;

  RETURN QUERY
  SELECT
    v_gross,
    v_refunded,
    v_transferred,
    GREATEST(v_gross - v_refunded - v_transferred, 0),
    v_wallet,
    v_savings;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_my_merchant_balance(
  p_amount NUMERIC,
  p_mode TEXT DEFAULT 'live',
  p_destination TEXT DEFAULT 'wallet',
  p_note TEXT DEFAULT ''
)
RETURNS TABLE (
  transfer_id UUID,
  available_balance NUMERIC,
  wallet_balance NUMERIC,
  savings_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_destination TEXT := LOWER(TRIM(COALESCE(p_destination, 'wallet')));
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_gross NUMERIC(14,2) := 0;
  v_refunded NUMERIC(14,2) := 0;
  v_transferred NUMERIC(14,2) := 0;
  v_available NUMERIC(14,2) := 0;
  v_wallet NUMERIC(14,2) := 0;
  v_savings NUMERIC(14,2) := 0;
  v_transfer_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF v_destination NOT IN ('wallet', 'savings') THEN
    RAISE EXCEPTION 'Destination must be wallet or savings';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':' || v_mode));

  SELECT
    COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mp.status = 'refunded' THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) ELSE 0 END), 0)
  INTO v_gross, v_refunded
  FROM public.merchant_payments mp
  LEFT JOIN public.supported_currencies sc
    ON sc.iso_code = UPPER(COALESCE(mp.currency, 'USD'))
  WHERE mp.merchant_user_id = v_user_id
    AND mp.key_mode = v_mode;

  SELECT COALESCE(SUM(mbt.amount), 0)
  INTO v_transferred
  FROM public.merchant_balance_transfers mbt
  WHERE mbt.merchant_user_id = v_user_id
    AND mbt.key_mode = v_mode;

  v_available := GREATEST(v_gross - v_refunded - v_transferred, 0);
  IF v_available < v_amount THEN
    RAISE EXCEPTION 'Insufficient merchant available balance';
  END IF;

  INSERT INTO public.merchant_balance_transfers (
    merchant_user_id,
    key_mode,
    destination,
    amount,
    currency,
    note
  )
  VALUES (
    v_user_id,
    v_mode,
    v_destination,
    v_amount,
    'USD',
    COALESCE(p_note, '')
  )
  RETURNING id INTO v_transfer_id;

  SELECT COALESCE(w.balance, 0)
  INTO v_wallet
  FROM public.wallets w
  WHERE w.user_id = v_user_id
  FOR UPDATE;

  IF v_destination = 'wallet' THEN
    UPDATE public.wallets
    SET balance = v_wallet + v_amount,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_wallet;
  ELSE
    PERFORM public.upsert_my_savings_account();

    UPDATE public.user_savings_accounts
    SET balance = balance + v_amount,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_savings;

    INSERT INTO public.user_savings_transfers (user_id, direction, amount, fee_amount, note)
    VALUES (
      v_user_id,
      'wallet_to_savings',
      v_amount,
      0,
      CONCAT('Merchant balance transfer (', v_mode, ')')
    );
  END IF;

  IF v_destination <> 'savings' THEN
    PERFORM public.upsert_my_savings_account();
    SELECT COALESCE(usa.balance, 0)
    INTO v_savings
    FROM public.user_savings_accounts usa
    WHERE usa.user_id = v_user_id;
  END IF;

  RETURN QUERY
  SELECT
    v_transfer_id,
    GREATEST(v_available - v_amount, 0),
    COALESCE(v_wallet, 0),
    COALESCE(v_savings, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_with_wallet(
  p_session_token TEXT,
  p_note TEXT DEFAULT '',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_user_id UUID := auth.uid();
  v_openpay_user_id UUID;
  v_session public.merchant_checkout_sessions;
  v_existing_tx UUID;
  v_tx_id UUID;
  v_sender_balance NUMERIC(12,2);
  v_merchant_balance NUMERIC(12,2);
  v_openpay_balance NUMERIC(12,2);
  v_currency_rate NUMERIC(20,8) := 1;
  v_wallet_amount NUMERIC(12,2) := 0;
  v_customer_name TEXT := NULLIF(TRIM(COALESCE(p_customer_name, '')), '');
  v_customer_email TEXT := NULLIF(TRIM(COALESCE(p_customer_email, '')), '');
  v_customer_phone TEXT := NULLIF(TRIM(COALESCE(p_customer_phone, '')), '');
  v_customer_address TEXT := NULLIF(TRIM(COALESCE(p_customer_address, '')), '');
  v_buyer_email TEXT;
  v_payment_link_id UUID;
  v_payment_link_token TEXT;
BEGIN
  IF v_buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT email INTO v_buyer_email
  FROM auth.users
  WHERE id = v_buyer_user_id;

  v_openpay_user_id := public.get_openpay_settlement_user_id();

  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout session not found';
  END IF;

  IF v_session.status = 'paid' THEN
    SELECT mp.transaction_id
    INTO v_existing_tx
    FROM public.merchant_payments mp
    WHERE mp.session_id = v_session.id
    LIMIT 1;

    RETURN v_existing_tx;
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

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

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
  WHERE user_id = v_buyer_user_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Buyer wallet not found';
  END IF;

  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_session.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
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
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
  SET balance = v_sender_balance - v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_buyer_user_id;

  UPDATE public.wallets
  SET balance = v_merchant_balance + v_wallet_amount,
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
    v_buyer_user_id,
    v_session.merchant_user_id,
    v_wallet_amount,
    CONCAT(
      'Merchant checkout ',
      v_session.session_token,
      ' | Held in merchant available balance',
      CASE WHEN COALESCE(TRIM(p_note), '') <> '' THEN CONCAT(' | ', TRIM(p_note)) ELSE '' END
    ),
    'completed'
  )
  RETURNING id INTO v_tx_id;

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
    v_tx_id,
    v_session.total_amount,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    v_payment_link_id,
    v_payment_link_token,
    'succeeded'
  )
  ON CONFLICT (session_id) DO NOTHING;

  UPDATE public.merchant_checkout_sessions mcs
  SET status = 'paid',
      paid_at = now(),
      customer_name = COALESCE(v_customer_name, mcs.customer_name),
      customer_email = COALESCE(v_customer_email, v_buyer_email, mcs.customer_email),
      metadata = COALESCE(mcs.metadata, '{}'::jsonb) || jsonb_strip_nulls(
        jsonb_build_object(
          'customer_phone', v_customer_phone,
          'customer_address', v_customer_address
        )
      ),
      updated_at = now()
  WHERE mcs.id = v_session.id;

  RETURN v_tx_id;
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
BEGIN
  IF v_buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
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

  IF v_card_owner_user_id <> v_buyer_user_id THEN
    RAISE EXCEPTION 'Card owner does not match authenticated customer';
  END IF;

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
    v_session.total_amount,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    v_payment_link_id,
    v_payment_link_token,
    'succeeded'
  );

  UPDATE public.merchant_checkout_sessions
  SET status = 'paid',
      paid_at = now()
  WHERE id = v_session.id;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_my_pos_transaction(
  p_payment_id UUID,
  p_reason TEXT DEFAULT ''
)
RETURNS TABLE (
  refund_transaction_id UUID,
  new_status TEXT,
  refunded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_openpay_user_id UUID;
  v_payment public.merchant_payments;
  v_session public.merchant_checkout_sessions;
  v_openpay_balance NUMERIC(12,2);
  v_buyer_balance NUMERIC(12,2);
  v_refund_tx_id UUID;
  v_currency_rate NUMERIC(20,8) := 1;
  v_wallet_amount NUMERIC(12,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment ID is required';
  END IF;

  v_openpay_user_id := public.get_openpay_settlement_user_id();

  SELECT *
  INTO v_payment
  FROM public.merchant_payments
  WHERE id = p_payment_id
    AND merchant_user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.status = 'refunded' THEN
    RAISE EXCEPTION 'Payment already refunded';
  END IF;

  IF v_payment.status <> 'succeeded' THEN
    RAISE EXCEPTION 'Only succeeded payments can be refunded';
  END IF;

  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions
  WHERE id = v_payment.session_id
  FOR UPDATE;

  SELECT sc.usd_rate
  INTO v_currency_rate
  FROM public.supported_currencies sc
  WHERE sc.iso_code = UPPER(COALESCE(v_payment.currency, 'USD'))
    AND sc.is_active = true
  LIMIT 1;

  v_currency_rate := COALESCE(NULLIF(v_currency_rate, 0), 1);
  v_wallet_amount := ROUND(COALESCE(v_payment.amount, 0) / v_currency_rate, 2);

  SELECT w.balance
  INTO v_openpay_balance
  FROM public.wallets w
  WHERE w.user_id = v_openpay_user_id
  FOR UPDATE;

  SELECT w.balance
  INTO v_buyer_balance
  FROM public.wallets w
  WHERE w.user_id = v_payment.buyer_user_id
  FOR UPDATE;

  IF v_openpay_balance IS NULL OR v_buyer_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_openpay_balance < v_wallet_amount THEN
    RAISE EXCEPTION 'Insufficient settlement balance for refund';
  END IF;

  UPDATE public.wallets
  SET balance = v_openpay_balance - v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_openpay_user_id;

  UPDATE public.wallets
  SET balance = v_buyer_balance + v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_payment.buyer_user_id;

  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status
  )
  VALUES (
    v_user_id,
    v_payment.buyer_user_id,
    v_wallet_amount,
    CONCAT(
      'POS refund for payment ',
      v_payment.id::TEXT,
      ' | Refunded from merchant available balance',
      CASE WHEN NULLIF(TRIM(COALESCE(p_reason, '')), '') IS NULL THEN '' ELSE ' | ' || TRIM(p_reason) END
    ),
    'refunded'
  )
  RETURNING id INTO v_refund_tx_id;

  UPDATE public.merchant_payments
  SET status = 'refunded'
  WHERE id = v_payment.id;

  UPDATE public.merchant_checkout_sessions
  SET metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
    'refunded_at', now(),
    'refund_transaction_id', v_refund_tx_id::TEXT
  ),
      updated_at = now()
  WHERE id = v_session.id;

  RETURN QUERY
  SELECT
    v_refund_tx_id,
    'refunded'::TEXT,
    now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_openpay_settlement_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_merchant_checkout_with_wallet(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_openpay_settlement_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_wallet(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
