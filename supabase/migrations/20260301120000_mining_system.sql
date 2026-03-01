
-- 20260301120000_mining_system.sql
-- Create mining_sessions table to track active mining
CREATE TABLE IF NOT EXISTS public.mining_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_reward_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  device_fingerprint TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create mining_rewards table for history
CREATE TABLE IF NOT EXISTS public.mining_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.mining_sessions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('base', 'referral_bonus')),
  referral_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_mining_sessions_user_active ON public.mining_sessions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mining_rewards_user ON public.mining_rewards(user_id);

-- Function to start mining
CREATE OR REPLACE FUNCTION public.start_mining_session(p_device_fingerprint TEXT, p_ip_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_active_session_id UUID;
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '24 hours';
BEGIN
  -- Check for existing active session
  SELECT id INTO v_active_session_id
  FROM public.mining_sessions
  WHERE user_id = v_user_id AND is_active = true AND expires_at > now();

  IF v_active_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Mining session already active', 'session_id', v_active_session_id);
  END IF;

  -- Deactivate any stale sessions
  UPDATE public.mining_sessions
  SET is_active = false
  WHERE user_id = v_user_id AND is_active = true;

  -- Start new session
  INSERT INTO public.mining_sessions (user_id, expires_at, device_fingerprint, ip_address)
  VALUES (v_user_id, v_expires_at, p_device_fingerprint, p_ip_address)
  RETURNING id INTO v_active_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_active_session_id, 'expires_at', v_expires_at);
END;
$$;

-- Function to claim mining rewards (can be called periodically or at end of session)
CREATE OR REPLACE FUNCTION public.claim_mining_rewards()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_base_reward NUMERIC := 0.10;
  v_referral_bonus_rate NUMERIC := 0.10; -- 10% per active referral
  v_max_bonus_rate NUMERIC := 1.00; -- 100% max bonus
  v_active_referrals INTEGER;
  v_total_reward NUMERIC;
  v_bonus_reward NUMERIC;
BEGIN
  -- Get active session
  SELECT * INTO v_session
  FROM public.mining_sessions
  WHERE user_id = v_user_id AND is_active = true AND expires_at > now();

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('error', 'No active mining session');
  END IF;

  -- Only allow claiming once per session or after it expires
  -- For this simple version, we'll reward the full 0.10 at the end or when they check in
  -- But the prompt says "increases gradually or at end of 24h". 
  -- Let's implement "at end of 24h" logic for simplicity, or "on check-in after 24h".
  
  -- Check if already rewarded for this session
  IF EXISTS (SELECT 1 FROM public.mining_rewards WHERE session_id = v_session.id AND reward_type = 'base') THEN
     RETURN jsonb_build_object('error', 'Reward already claimed for this session');
  END IF;

  -- Only allow claim if session has expired
  IF v_session.expires_at > now() THEN
     RETURN jsonb_build_object('error', 'Mining still in progress. Come back after 24 hours.');
  END IF;

  -- Calculate active referrals (those who have an active mining session)
  SELECT COUNT(DISTINCT r.referred_user_id) INTO v_active_referrals
  FROM public.referral_rewards r
  JOIN public.mining_sessions ms ON ms.user_id = r.referred_user_id
  WHERE r.referrer_id = v_user_id
    AND ms.is_active = true
    AND ms.expires_at > now();

  v_bonus_reward := LEAST(v_base_reward * v_active_referrals * v_referral_bonus_rate, v_base_reward * v_max_bonus_rate);
  v_total_reward := v_base_reward + v_bonus_reward;

  -- Record rewards
  INSERT INTO public.mining_rewards (user_id, session_id, amount, reward_type)
  VALUES (v_user_id, v_session.id, v_base_reward, 'base');

  IF v_bonus_reward > 0 THEN
    INSERT INTO public.mining_rewards (user_id, session_id, amount, reward_type)
    VALUES (v_user_id, v_session.id, v_bonus_reward, 'referral_bonus');
  END IF;

  -- Update wallet balance (storing off-chain as requested, but we use the wallets table)
  UPDATE public.wallets
  SET balance = balance + v_total_reward,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Deactivate session
  UPDATE public.mining_sessions
  SET is_active = false
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'success', true, 
    'base_reward', v_base_reward, 
    'bonus_reward', v_bonus_reward, 
    'total_reward', v_total_reward,
    'active_referrals', v_active_referrals
  );
END;
$$;

-- RLS Policies
ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mining sessions"
ON public.mining_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own mining rewards"
ON public.mining_rewards FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mining_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mining_rewards;
