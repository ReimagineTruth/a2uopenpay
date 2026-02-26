-- Create separate checkout payment system with different tables and workflows
-- This is completely separate from POS system

-- Checkout Sessions Table (enhanced version, separate from pos_payments)
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_api_key_id UUID REFERENCES public.checkout_api_keys(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'expired', 'canceled')),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  success_url TEXT,
  cancel_url TEXT,
  payment_method TEXT DEFAULT 'card' CHECK (payment_method IN ('card', 'wallet', 'bank_transfer')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checkout Session Items Table (for product-based checkouts)
CREATE TABLE IF NOT EXISTS public.checkout_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.merchant_products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  unit_amount NUMERIC(12,2) NOT NULL CHECK (unit_amount > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checkout Transactions Table (separate from pos_transactions)
CREATE TABLE IF NOT EXISTS public.checkout_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  payer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'card' CHECK (payment_method IN ('card', 'wallet', 'bank_transfer')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checkout API Keys Table (separate from pos_api_keys)
CREATE TABLE IF NOT EXISTS public.checkout_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_mode TEXT NOT NULL CHECK (key_mode IN ('sandbox', 'live')),
  key_name TEXT NOT NULL DEFAULT 'Checkout Default Key',
  publishable_key TEXT NOT NULL UNIQUE,
  secret_key_hash TEXT NOT NULL UNIQUE,
  secret_key_last4 TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for checkout system
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_session_token ON public.checkout_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant_user_id ON public.checkout_sessions(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON public.checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires_at ON public.checkout_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_checkout_session_items_session_id ON public.checkout_session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_session_items_product_id ON public.checkout_session_items(product_id);

CREATE INDEX IF NOT EXISTS idx_checkout_transactions_checkout_session_id ON public.checkout_transactions(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_transactions_payer_user_id ON public.checkout_transactions(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_transactions_status ON public.checkout_transactions(status);

CREATE INDEX IF NOT EXISTS idx_checkout_api_keys_merchant_user_id ON public.checkout_api_keys(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_api_keys_publishable_key ON public.checkout_api_keys(publishable_key);

-- Checkout Payment Functions (completely separate from POS functions)

-- Create checkout session
CREATE OR REPLACE FUNCTION public.create_checkout_session(
  p_amount NUMERIC(12,2),
  p_currency TEXT DEFAULT 'USD',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_success_url TEXT DEFAULT NULL,
  p_cancel_url TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'card',
  p_expires_in_minutes INTEGER DEFAULT 60,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  checkout_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_checkout_session_id UUID;
  v_session_token TEXT;
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_expires_minutes INTEGER := GREATEST(15, LEAST(COALESCE(p_expires_in_minutes, 60), 10080));
  v_fee_amount NUMERIC(12,2) := 0;
  v_total_amount NUMERIC(12,2);
  v_checkout_url TEXT;
  v_item JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Generate unique session token
  v_session_token := 'csess_' || encode(gen_random_bytes(16), 'hex');
  
  -- Calculate fee (3% for checkout)
  v_fee_amount := ROUND(v_amount * 0.03, 2);
  v_total_amount := v_amount + v_fee_amount;

  -- Create checkout session
  INSERT INTO public.checkout_sessions (
    merchant_user_id,
    session_token,
    currency,
    subtotal_amount,
    fee_amount,
    total_amount,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    success_url,
    cancel_url,
    payment_method,
    expires_at
  ) VALUES (
    v_user_id,
    v_session_token,
    v_currency,
    v_amount,
    v_fee_amount,
    v_total_amount,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_customer_address,
    p_success_url,
    p_cancel_url,
    p_payment_method,
    now() + (v_expires_minutes || ' minutes')::INTERVAL
  ) RETURNING id INTO v_checkout_session_id;

  -- Add items if provided
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOREACH v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.checkout_session_items (
        session_id,
        product_id,
        item_name,
        item_description,
        unit_amount,
        quantity,
        line_total
      ) VALUES (
        v_checkout_session_id,
        (v_item->>'product_id')::UUID,
        v_item->>'item_name',
        v_item->>'item_description',
        (v_item->>'unit_amount')::NUMERIC(12,2),
        (v_item->>'quantity')::INTEGER,
        (v_item->>'line_total')::NUMERIC(12,2)
      );
    END LOOP;
  END IF;

  -- Generate checkout URL
  v_checkout_url := 'https://openpay.com/checkout/' || v_session_token;

  RETURN QUERY SELECT 
    v_checkout_session_id::UUID,
    v_session_token::TEXT,
    v_amount::NUMERIC(12,2),
    v_currency::TEXT,
    'open'::TEXT,
    now() + (v_expires_minutes || ' minutes')::INTERVAL::TIMESTAMPTZ,
    v_checkout_url::TEXT;
END;
$$;

-- Get checkout session
CREATE OR REPLACE FUNCTION public.get_checkout_session(
  p_session_token TEXT
)
RETURNS TABLE (
  id UUID,
  merchant_user_id UUID,
  session_token TEXT,
  status TEXT,
  subtotal_amount NUMERIC(12,2),
  fee_amount NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  currency TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  success_url TEXT,
  cancel_url TEXT,
  payment_method TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 
    cs.id,
    cs.merchant_user_id,
    cs.session_token,
    cs.status,
    cs.subtotal_amount,
    cs.fee_amount,
    cs.total_amount,
    cs.currency,
    cs.customer_name,
    cs.customer_email,
    cs.customer_phone,
    cs.customer_address,
    cs.success_url,
    cs.cancel_url,
    cs.payment_method,
    cs.expires_at,
    cs.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'item_name', csi.item_name,
          'item_description', csi.item_description,
          'unit_amount', csi.unit_amount,
          'quantity', csi.quantity,
          'line_total', csi.line_total
        )
      ) FILTER (WHERE csi.id IS NOT NULL),
      '[]'::jsonb
    ) as items
  FROM public.checkout_sessions cs
  LEFT JOIN public.checkout_session_items csi ON cs.id = csi.session_id
  WHERE cs.session_token = TRIM(COALESCE(p_session_token, ''))
    AND cs.status = 'open'
    AND cs.expires_at > now()
  GROUP BY cs.id, cs.merchant_user_id, cs.session_token, cs.status, cs.subtotal_amount, 
           cs.fee_amount, cs.total_amount, cs.currency, cs.customer_name, cs.customer_email,
           cs.customer_phone, cs.customer_address, cs.success_url, cs.cancel_url, 
           cs.payment_method, cs.expires_at, cs.created_at;
END;
$$;

-- Process checkout payment (virtual card)
CREATE OR REPLACE FUNCTION public.process_checkout_payment_virtual_card(
  p_session_token TEXT,
  p_card_number TEXT,
  p_expiry_month INTEGER,
  p_expiry_year INTEGER,
  p_cvc TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  checkout_session_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout_session public.checkout_sessions;
  v_sanitized_card_number TEXT := regexp_replace(COALESCE(p_card_number, ''), '\D', '', 'g');
  v_sanitized_cvc TEXT := regexp_replace(COALESCE(p_cvc, ''), '\D', '', 'g');
  v_expiry_end DATE;
  v_transaction_id UUID;
  v_checkout_transaction_id UUID;
  v_fee_amount NUMERIC(12,2);
  v_net_amount NUMERIC(12,2);
BEGIN
  -- Validate session
  SELECT *
  INTO v_checkout_session
  FROM public.checkout_sessions cs
  WHERE cs.session_token = TRIM(COALESCE(p_session_token, ''))
    AND cs.status = 'open'
    AND cs.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid or expired checkout session'::TEXT;
    RETURN;
  END IF;

  -- Validate card
  IF length(v_sanitized_card_number) NOT IN (13, 15, 16) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid card number'::TEXT;
    RETURN;
  END IF;

  IF length(v_sanitized_cvc) NOT IN (3, 4) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid CVC'::TEXT;
    RETURN;
  END IF;

  v_expiry_end := make_date(p_expiry_year, p_expiry_month, 1);
  IF v_expiry_end < make_date(extract(year from now()), extract(month from now()), 1) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Card expired'::TEXT;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := v_checkout_session.fee_amount;
  v_net_amount := v_checkout_session.total_amount - v_fee_amount;

  -- Create main transaction
  INSERT INTO public.transactions (
    sender_user_id,
    receiver_user_id,
    amount,
    currency,
    fee_amount,
    status,
    type,
    metadata
  ) VALUES (
    NULL, -- Card payment - no sender user
    v_checkout_session.merchant_user_id,
    v_checkout_session.total_amount,
    v_checkout_session.currency,
    v_fee_amount,
    'pending',
    'payment',
    jsonb_build_object(
      'checkout_session_id', v_checkout_session.id,
      'payment_method', 'virtual_card',
      'card_last4', right(v_sanitized_card_number, 4),
      'customer_name', p_customer_name
    )
  ) RETURNING id INTO v_transaction_id;

  -- Create checkout transaction record
  INSERT INTO public.checkout_transactions (
    checkout_session_id,
    transaction_id,
    payment_method,
    amount,
    currency,
    fee_amount,
    net_amount,
    status,
    gateway_response
  ) VALUES (
    v_checkout_session.id,
    v_transaction_id,
    'virtual_card',
    v_checkout_session.total_amount,
    v_checkout_session.currency,
    v_fee_amount,
    v_net_amount,
    'succeeded',
    jsonb_build_object(
      'card_last4', right(v_sanitized_card_number, 4),
      'auth_code', 'APPROVED',
      'transaction_id', v_transaction_id
    )
  ) RETURNING id INTO v_checkout_transaction_id;

  -- Update checkout session status
  UPDATE public.checkout_sessions
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = v_checkout_session.id;

  RETURN QUERY SELECT 
    v_transaction_id::UUID,
    v_checkout_session.id::UUID,
    'success'::TEXT,
    'Checkout payment processed successfully'::TEXT;
END;
$$;

-- Get checkout payment QR code data
CREATE OR REPLACE FUNCTION public.get_checkout_payment_qr_data(
  p_session_token TEXT
)
RETURNS TABLE (
  qr_data TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  merchant_name TEXT,
  note TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout_session public.checkout_sessions;
  v_merchant_name TEXT;
BEGIN
  -- Get checkout session
  SELECT *
  INTO v_checkout_session
  FROM public.checkout_sessions cs
  WHERE cs.session_token = TRIM(COALESCE(p_session_token, ''))
    AND cs.status = 'open'
    AND cs.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::TEXT,
      NULL::NUMERIC(12,2),
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Get merchant name
  SELECT username
  INTO v_merchant_name
  FROM auth.users
  WHERE id = v_checkout_session.merchant_user_id;

  -- Generate QR data
  RETURN QUERY SELECT 
    ('openpay://checkout?session=' || v_checkout_session.session_token ||
     '&amount=' || v_checkout_session.total_amount::TEXT ||
     '&currency=' || v_checkout_session.currency ||
     '&note=Checkout+payment' ||
     '&name=' || COALESCE(v_merchant_name, ''))::TEXT,
    v_checkout_session.total_amount::NUMERIC(12,2),
    v_checkout_session.currency::TEXT,
    COALESCE(v_merchant_name, '')::TEXT,
    'Checkout Payment'::TEXT;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_checkout_session TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_checkout_session TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_checkout_payment_virtual_card TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_checkout_payment_qr_data TO authenticated, anon;

-- Row Level Security for checkout tables
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_api_keys ENABLE ROW LEVEL SECURITY;

-- Checkout policies
CREATE POLICY "Users can view their own checkout sessions" ON public.checkout_sessions
  FOR SELECT USING (auth.uid() = merchant_user_id);

CREATE POLICY "Users can insert their own checkout sessions" ON public.checkout_sessions
  FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);

CREATE POLICY "Users can update their own checkout sessions" ON public.checkout_sessions
  FOR UPDATE USING (auth.uid() = merchant_user_id);

CREATE POLICY "Users can view their own checkout session items" ON public.checkout_session_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.checkout_sessions cs 
      WHERE cs.id = checkout_session_items.session_id 
      AND cs.merchant_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own checkout session items" ON public.checkout_session_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checkout_sessions cs 
      WHERE cs.id = checkout_session_items.session_id 
      AND cs.merchant_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own checkout transactions" ON public.checkout_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.checkout_sessions cs 
      WHERE cs.id = checkout_transactions.checkout_session_id 
      AND cs.merchant_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own checkout transactions" ON public.checkout_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checkout_sessions cs 
      WHERE cs.id = checkout_transactions.checkout_session_id 
      AND cs.merchant_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own checkout API keys" ON public.checkout_api_keys
  FOR SELECT USING (auth.uid() = merchant_user_id);

CREATE POLICY "Users can insert their own checkout API keys" ON public.checkout_api_keys
  FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);

CREATE POLICY "Users can update their own checkout API keys" ON public.checkout_api_keys
  FOR UPDATE USING (auth.uid() = merchant_user_id);
