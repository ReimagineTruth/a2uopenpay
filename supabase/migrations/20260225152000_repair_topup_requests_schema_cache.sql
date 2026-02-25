CREATE TABLE IF NOT EXISTS public.user_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 1),
  openpay_account_name TEXT NOT NULL DEFAULT '',
  openpay_account_username TEXT NOT NULL DEFAULT '',
  openpay_account_number TEXT NOT NULL DEFAULT '',
  reference_code TEXT NOT NULL DEFAULT '',
  proof_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  transfer_transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_topup_requests_user_created
  ON public.user_topup_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_topup_requests_status_created
  ON public.user_topup_requests(status, created_at DESC);

ALTER TABLE public.user_topup_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_topup_requests' AND policyname = 'Users can view own topup requests'
  ) THEN
    CREATE POLICY "Users can view own topup requests"
      ON public.user_topup_requests
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_topup_requests_updated_at ON public.user_topup_requests;
CREATE TRIGGER trg_user_topup_requests_updated_at
BEFORE UPDATE ON public.user_topup_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

CREATE OR REPLACE FUNCTION public.submit_topup_request(
  p_amount NUMERIC,
  p_openpay_account_name TEXT,
  p_openpay_account_number TEXT,
  p_openpay_account_username TEXT,
  p_proof_url TEXT,
  p_provider TEXT,
  p_reference_code TEXT
)
RETURNS public.user_topup_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_name TEXT := LEFT(TRIM(COALESCE(p_openpay_account_name, '')), 160);
  v_account TEXT := UPPER(TRIM(COALESCE(p_openpay_account_number, '')));
  v_username TEXT := LEFT(TRIM(COALESCE(p_openpay_account_username, '')), 120);
  v_proof_url TEXT := LEFT(TRIM(COALESCE(p_proof_url, '')), 400);
  v_provider TEXT := LEFT(TRIM(COALESCE(p_provider, '')), 80);
  v_reference TEXT := LEFT(TRIM(COALESCE(p_reference_code, '')), 160);
  v_row public.user_topup_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_amount < 1 THEN
    RAISE EXCEPTION 'Minimum top up is 1 OPEN USD';
  END IF;

  IF v_provider = '' THEN
    RAISE EXCEPTION 'Top up provider is required';
  END IF;

  IF v_name = '' OR v_username = '' OR v_account = '' THEN
    RAISE EXCEPTION 'Complete all required top up fields';
  END IF;

  IF v_reference = '' THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  IF v_proof_url = '' THEN
    RAISE EXCEPTION 'Payment proof is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_accounts ua
    WHERE ua.user_id = v_user_id
      AND UPPER(ua.account_number) = v_account
  ) THEN
    RAISE EXCEPTION 'OpenPay account number does not match your profile';
  END IF;

  INSERT INTO public.user_topup_requests (
    user_id,
    provider,
    amount,
    openpay_account_name,
    openpay_account_username,
    openpay_account_number,
    reference_code,
    proof_url,
    status
  )
  VALUES (
    v_user_id,
    v_provider,
    v_amount,
    v_name,
    v_username,
    v_account,
    v_reference,
    v_proof_url,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_topup_request(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_topup_request(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

GRANT SELECT ON TABLE public.user_topup_requests TO authenticated;

NOTIFY pgrst, 'reload schema';
