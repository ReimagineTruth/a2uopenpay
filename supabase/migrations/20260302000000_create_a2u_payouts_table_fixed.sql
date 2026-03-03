-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own A2U payouts" ON public.a2u_payouts;
DROP POLICY IF EXISTS "Users can create own A2U payouts" ON public.a2u_payouts;
DROP POLICY IF EXISTS "Service role can update A2U payouts" ON public.a2u_payouts;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_a2u_payouts_updated_at ON public.a2u_payouts;
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Create A2U Payouts Table (or use existing)
CREATE TABLE IF NOT EXISTS public.a2u_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pi_username TEXT NOT NULL,
  amount NUMERIC(20,8) NOT NULL CHECK (amount > 0),
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  pi_payment_id TEXT,
  pi_txid TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance (ignore if they exist)
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_user_id ON public.a2u_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_status ON public.a2u_payouts(status);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_created_at ON public.a2u_payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_pi_payment_id ON public.a2u_payouts(pi_payment_id);

-- Enable Row Level Security
ALTER TABLE public.a2u_payouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own A2U payouts" ON public.a2u_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own A2U payouts" ON public.a2u_payouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update A2U payouts" ON public.a2u_payouts
  FOR UPDATE USING (true);

-- Grant permissions
GRANT ALL ON public.a2u_payouts TO authenticated;
GRANT ALL ON public.a2u_payouts TO service_role;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_a2u_payouts_updated_at
  BEFORE UPDATE ON public.a2u_payouts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add table comment
COMMENT ON TABLE public.a2u_payouts IS 'Tracks A2U (app-to-user) payouts from app wallet to user blockchain wallets via Pi Network';
