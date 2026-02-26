-- Create separate POS payment system with different tables and workflows
-- This is completely separate from checkout system

-- POS Payments Table (completely separate from merchant_checkout_sessions)
CREATE TABLE IF NOT EXISTS public.pos_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pos_terminal_id UUID REFERENCES public.merchant_pos_terminals(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'canceled')),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  payment_method TEXT DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'card', 'cash')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Transactions Table (separate from merchant_payments)
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_payment_id UUID NOT NULL REFERENCES public.pos_payments(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  payer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'card', 'cash')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS API Keys Table (separate from merchant_api_keys)
CREATE TABLE IF NOT EXISTS public.pos_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pos_terminal_id UUID REFERENCES public.merchant_pos_terminals(id) ON DELETE SET NULL,
  key_mode TEXT NOT NULL CHECK (key_mode IN ('sandbox', 'live')),
  key_name TEXT NOT NULL DEFAULT 'POS Default Key',
  publishable_key TEXT NOT NULL UNIQUE,
  secret_key_hash TEXT NOT NULL UNIQUE,
  secret_key_last4 TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for POS system
CREATE INDEX IF NOT EXISTS idx_pos_payments_session_token ON public.pos_payments(session_token);
CREATE INDEX IF NOT EXISTS idx_pos_payments_merchant_user_id ON public.pos_payments(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_payments_status ON public.pos_payments(status);
CREATE INDEX IF NOT EXISTS idx_pos_payments_expires_at ON public.pos_payments(expires_at);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_pos_payment_id ON public.pos_transactions(pos_payment_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_payer_user_id ON public.pos_transactions(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_status ON public.pos_transactions(status);

CREATE INDEX IF NOT EXISTS idx_pos_api_keys_merchant_user_id ON public.pos_api_keys(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_api_keys_publishable_key ON public.pos_api_keys(publishable_key);

-- POS Payment Functions (completely separate from checkout functions)

-- Create POS payment session
CREATE OR REPLACE FUNCTION public.create_pos_payment_session(
  p_amount NUMERIC(12,2),
  p_currency TEXT DEFAULT 'USD',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'wallet',
  p_expires_in_minutes INTEGER DEFAULT 30,
  p_pos_terminal_id UUID DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pos_payment_id UUID;
  v_session_token TEXT;
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_expires_minutes INTEGER := GREATEST(5, LEAST(COALESCE(p_expires_in_minutes, 30), 10080));
  v_fee_amount NUMERIC(12,2) := 0;
  v_total_amount NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Generate unique session token
  v_session_token := 'opsess_' || encode(gen_random_bytes(16), 'hex');
  
  -- Calculate fee (2% for POS)
  v_fee_amount := ROUND(v_amount * 0.02, 2);
  v_total_amount := v_amount + v_fee_amount;

  -- Create POS payment session
  INSERT INTO public.pos_payments (
    merchant_user_id,
    pos_terminal_id,
    session_token,
    currency,
    amount,
    fee_amount,
    total_amount,
    customer_name,
    customer_email,
    customer_phone,
    payment_method,
    expires_at
  ) VALUES (
    v_user_id,
    p_pos_terminal_id,
    v_session_token,
    v_currency,
    v_amount,
    v_fee_amount,
    v_total_amount,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_payment_method,
    now() + (v_expires_minutes || ' minutes')::INTERVAL
  ) RETURNING id INTO v_pos_payment_id;

  RETURN QUERY SELECT 
    v_pos_payment_id::UUID,
    v_session_token::TEXT,
    v_amount::NUMERIC(12,2),
    v_currency::TEXT,
    'pending'::TEXT,
    now() + (v_expires_minutes || ' minutes')::INTERVAL::TIMESTAMPTZ;
END;
$$;

-- Get POS payment session
CREATE OR REPLACE FUNCTION public.get_pos_payment_session(
  p_session_token TEXT
)
RETURNS TABLE (
  id UUID,
  merchant_user_id UUID,
  session_token TEXT,
  status TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  fee_amount NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  payment_method TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 
    pp.id,
    pp.merchant_user_id,
    pp.session_token,
    pp.status,
    pp.amount,
    pp.currency,
    pp.fee_amount,
    pp.total_amount,
    pp.customer_name,
    pp.customer_email,
    pp.customer_phone,
    pp.payment_method,
    pp.expires_at,
    pp.created_at
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.status = 'pending'
    AND pp.expires_at > now();
END;
$$;

-- Process POS payment (wallet payment)
CREATE OR REPLACE FUNCTION public.process_pos_payment_wallet(
  p_session_token TEXT,
  p_payer_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  pos_payment_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_payment public.pos_payments;
  v_payer_balance NUMERIC(12,2);
  v_merchant_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_pos_transaction_id UUID;
  v_fee_amount NUMERIC(12,2);
  v_net_amount NUMERIC(12,2);
BEGIN
  -- Get POS payment session
  SELECT *
  INTO v_pos_payment
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.status = 'pending'
    AND pp.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid or expired POS payment session'::TEXT;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := v_pos_payment.fee_amount;
  v_net_amount := v_pos_payment.total_amount - v_fee_amount;

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
    p_payer_user_id,
    v_pos_payment.merchant_user_id,
    v_pos_payment.total_amount,
    v_pos_payment.currency,
    v_fee_amount,
    'pending',
    'payment',
    jsonb_build_object('pos_payment_id', v_pos_payment.id, 'payment_method', 'wallet')
  ) RETURNING id INTO v_transaction_id;

  -- Create POS transaction record
  INSERT INTO public.pos_transactions (
    pos_payment_id,
    transaction_id,
    payer_user_id,
    payment_method,
    amount,
    currency,
    fee_amount,
    net_amount,
    status
  ) VALUES (
    v_pos_payment.id,
    v_transaction_id,
    p_payer_user_id,
    'wallet',
    v_pos_payment.total_amount,
    v_pos_payment.currency,
    v_fee_amount,
    v_net_amount,
    'succeeded'
  ) RETURNING id INTO v_pos_transaction_id;

  -- Update POS payment status
  UPDATE public.pos_payments
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = v_pos_payment.id;

  RETURN QUERY SELECT 
    v_transaction_id::UUID,
    v_pos_payment.id::UUID,
    'success'::TEXT,
    'POS payment processed successfully'::TEXT;
END;
$$;

-- Get POS payment QR code data
CREATE OR REPLACE FUNCTION public.get_pos_payment_qr_data(
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
  v_pos_payment public.pos_payments;
  v_merchant_name TEXT;
BEGIN
  -- Get POS payment session
  SELECT *
  INTO v_pos_payment
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.status = 'pending'
    AND pp.expires_at > now()
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
  WHERE id = v_pos_payment.merchant_user_id;

  -- Generate QR data
  RETURN QUERY SELECT 
    ('openpay://pay?uid=' || v_pos_payment.merchant_user_id::TEXT || 
     '&amount=' || v_pos_payment.amount::TEXT ||
     '&currency=' || v_pos_payment.currency ||
     '&note=POS+payment' ||
     '&name=' || COALESCE(v_merchant_name, ''))::TEXT,
    v_pos_payment.amount::NUMERIC(12,2),
    v_pos_payment.currency::TEXT,
    COALESCE(v_merchant_name, '')::TEXT,
    'POS Payment'::TEXT;
END;
$$;

-- Grant permissions (only for authenticated users)
GRANT EXECUTE ON FUNCTION public.create_pos_payment_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_payment_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_pos_payment_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_payment_qr_data TO authenticated;

-- Row Level Security for POS tables
ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_api_keys ENABLE ROW LEVEL SECURITY;

-- POS policies
CREATE POLICY "Users can view their own POS payments" ON public.pos_payments
  FOR SELECT USING (auth.uid() = merchant_user_id);

CREATE POLICY "Users can insert their own POS payments" ON public.pos_payments
  FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);

CREATE POLICY "Users can update their own POS payments" ON public.pos_payments
  FOR UPDATE USING (auth.uid() = merchant_user_id);

CREATE POLICY "Users can view their own POS transactions" ON public.pos_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pos_payments pp 
      WHERE pp.id = pos_transactions.pos_payment_id 
      AND pp.merchant_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own POS transactions" ON public.pos_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pos_payments pp 
      WHERE pp.id = pos_transactions.pos_payment_id 
      AND pp.merchant_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own POS API keys" ON public.pos_api_keys
  FOR SELECT USING (auth.uid() = merchant_user_id);

CREATE POLICY "Users can insert their own POS API keys" ON public.pos_api_keys
  FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);

CREATE POLICY "Users can update their own POS API keys" ON public.pos_api_keys
  FOR UPDATE USING (auth.uid() = merchant_user_id);
