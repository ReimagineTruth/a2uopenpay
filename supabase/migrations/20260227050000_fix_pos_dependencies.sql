-- Fix POS system dependencies and ensure tables exist
-- This migration fixes the "type does not exist" error by ensuring proper order

-- First, ensure the tables exist (create them if they don't)
-- This handles the case where the previous migration failed or wasn't applied

-- POS Payments Table (ensure it exists)
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

-- POS Transactions Table (ensure it exists)
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

-- POS API Keys Table (ensure it exists)
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_pos_payments_session_token ON public.pos_payments(session_token);
CREATE INDEX IF NOT EXISTS idx_pos_payments_merchant_user_id ON public.pos_payments(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_payments_status ON public.pos_payments(status);
CREATE INDEX IF NOT EXISTS idx_pos_payments_expires_at ON public.pos_payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_pos_payments_created_at ON public.pos_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_payments_merchant_status ON public.pos_payments(merchant_user_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_pos_payment_id ON public.pos_transactions(pos_payment_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_payer_user_id ON public.pos_transactions(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_status ON public.pos_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created_at ON public.pos_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_pos_api_keys_merchant_user_id ON public.pos_api_keys(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_api_keys_publishable_key ON public.pos_api_keys(publishable_key);
CREATE INDEX IF NOT EXISTS idx_pos_api_keys_key_mode ON public.pos_api_keys(key_mode, is_active);

-- Enable RLS if not already enabled
ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own POS payments" ON public.pos_payments;
CREATE POLICY "Users can view their own POS payments" ON public.pos_payments
  FOR SELECT USING (auth.uid() = merchant_user_id);

DROP POLICY IF EXISTS "Users can insert their own POS payments" ON public.pos_payments;
CREATE POLICY "Users can insert their own POS payments" ON public.pos_payments
  FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);

DROP POLICY IF EXISTS "Users can update their own POS payments" ON public.pos_payments;
CREATE POLICY "Users can update their own POS payments" ON public.pos_payments
  FOR UPDATE USING (auth.uid() = merchant_user_id);

DROP POLICY IF EXISTS "Users can view their own POS transactions" ON public.pos_transactions;
CREATE POLICY "Users can view their own POS transactions" ON public.pos_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pos_payments pp 
      WHERE pp.id = pos_transactions.pos_payment_id 
      AND pp.merchant_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own POS transactions" ON public.pos_transactions;
CREATE POLICY "Users can insert their own POS transactions" ON public.pos_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pos_payments pp 
      WHERE pp.id = pos_transactions.pos_payment_id 
      AND pp.merchant_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own POS API keys" ON public.pos_api_keys;
CREATE POLICY "Users can view their own POS API keys" ON public.pos_api_keys
  FOR SELECT USING (auth.uid() = merchant_user_id);

DROP POLICY IF EXISTS "Users can insert their own POS API keys" ON public.pos_api_keys;
CREATE POLICY "Users can insert their own POS API keys" ON public.pos_api_keys
  FOR INSERT WITH CHECK (auth.uid() = merchant_user_id);

DROP POLICY IF EXISTS "Users can update their own POS API keys" ON public.pos_api_keys;
CREATE POLICY "Users can update their own POS API keys" ON public.pos_api_keys
  FOR UPDATE USING (auth.uid() = merchant_user_id);

-- Now recreate the core POS functions with proper error handling
-- Drop functions first to avoid conflicts
DROP FUNCTION IF EXISTS public.create_pos_payment_session(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, UUID);
DROP FUNCTION IF EXISTS public.get_pos_payment_session(TEXT);
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_pos_payment_qr_data(TEXT);

-- Create POS payment session (recreated)
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

-- Grant permissions (only for authenticated users)
GRANT EXECUTE ON FUNCTION public.create_pos_payment_session TO authenticated;
