CREATE OR REPLACE FUNCTION public.calculate_user_activity_credit_score(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup_count INTEGER := 0;
  v_send_count INTEGER := 0;
  v_receive_count INTEGER := 0;
  v_invoice_count INTEGER := 0;
  v_request_count INTEGER := 0;
  v_paid_invoice_count INTEGER := 0;
  v_paid_request_count INTEGER := 0;
  v_checkout_buyer_count INTEGER := 0;
  v_checkout_merchant_count INTEGER := 0;
  v_pos_payment_count INTEGER := 0;
  v_checkout_link_payment_count INTEGER := 0;
  v_total_tx_volume NUMERIC(14,2) := 0;
  v_score NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_topup_count
  FROM public.transactions t
  WHERE t.sender_id = p_user_id
    AND t.receiver_id = p_user_id
    AND t.status = 'completed';

  SELECT COUNT(*)::INTEGER
  INTO v_send_count
  FROM public.transactions t
  WHERE t.sender_id = p_user_id
    AND t.receiver_id <> p_user_id
    AND t.status = 'completed';

  SELECT COUNT(*)::INTEGER
  INTO v_receive_count
  FROM public.transactions t
  WHERE t.receiver_id = p_user_id
    AND t.sender_id <> p_user_id
    AND t.status = 'completed';

  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total_tx_volume
  FROM public.transactions t
  WHERE (t.sender_id = p_user_id OR t.receiver_id = p_user_id)
    AND t.status = 'completed';

  SELECT COUNT(*)::INTEGER
  INTO v_invoice_count
  FROM public.invoices i
  WHERE i.sender_id = p_user_id
     OR i.recipient_id = p_user_id;

  SELECT COUNT(*)::INTEGER
  INTO v_paid_invoice_count
  FROM public.invoices i
  WHERE (i.sender_id = p_user_id OR i.recipient_id = p_user_id)
    AND i.status = 'paid';

  SELECT COUNT(*)::INTEGER
  INTO v_request_count
  FROM public.payment_requests pr
  WHERE pr.requester_id = p_user_id
     OR pr.payer_id = p_user_id;

  SELECT COUNT(*)::INTEGER
  INTO v_paid_request_count
  FROM public.payment_requests pr
  WHERE (pr.requester_id = p_user_id OR pr.payer_id = p_user_id)
    AND pr.status = 'paid';

  SELECT COUNT(*)::INTEGER
  INTO v_checkout_buyer_count
  FROM public.merchant_payments mp
  WHERE mp.buyer_user_id = p_user_id
    AND mp.status = 'succeeded';

  SELECT COUNT(*)::INTEGER
  INTO v_checkout_merchant_count
  FROM public.merchant_payments mp
  WHERE mp.merchant_user_id = p_user_id
    AND mp.status = 'succeeded';

  SELECT COUNT(*)::INTEGER
  INTO v_pos_payment_count
  FROM public.merchant_payments mp
  JOIN public.merchant_checkout_sessions mcs ON mcs.id = mp.session_id
  WHERE mp.merchant_user_id = p_user_id
    AND mp.status = 'succeeded'
    AND LOWER(COALESCE(mcs.metadata->>'channel', '')) = 'pos';

  SELECT COUNT(*)::INTEGER
  INTO v_checkout_link_payment_count
  FROM public.merchant_payments mp
  JOIN public.merchant_checkout_sessions mcs ON mcs.id = mp.session_id
  WHERE mp.merchant_user_id = p_user_id
    AND mp.status = 'succeeded'
    AND COALESCE(
      NULLIF(TRIM(COALESCE(mcs.metadata->>'payment_link_token', '')), ''),
      NULLIF(TRIM(COALESCE(mp.payment_link_token, '')), '')
    ) IS NOT NULL;

  -- New account starts at zero and grows from real OpenPay usage.
  v_score := v_score
    + LEAST(v_topup_count, 50) * 3
    + LEAST(v_send_count, 200) * 4
    + LEAST(v_receive_count, 200) * 3
    + LEAST(v_invoice_count, 80) * 1
    + LEAST(v_request_count, 80) * 1
    + LEAST(v_paid_invoice_count, 120) * 4
    + LEAST(v_paid_request_count, 120) * 4
    + LEAST(v_checkout_buyer_count, 200) * 4
    + LEAST(v_checkout_merchant_count, 200) * 5
    + LEAST(v_pos_payment_count, 200) * 6
    + LEAST(v_checkout_link_payment_count, 200) * 5
    + LEAST(COALESCE(v_total_tx_volume, 0), 50000) / 200;

  RETURN GREATEST(0, LEAST(900, ROUND(v_score)::INTEGER));
END;
$$;

CREATE OR REPLACE FUNCTION public.can_user_unlock_loans(
  p_user_id UUID
)
RETURNS TABLE (
  unlocked BOOLEAN,
  score INTEGER,
  required_score INTEGER,
  total_activity INTEGER,
  required_activity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_activity INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 120, 0, 8;
    RETURN;
  END IF;

  v_score := public.calculate_user_activity_credit_score(p_user_id);

  SELECT
    COALESCE(t.tx_count, 0)
    + COALESCE(inv.paid_count, 0)
    + COALESCE(req.paid_count, 0)
    + COALESCE(mp.pay_count, 0)
  INTO v_activity
  FROM (
    SELECT COUNT(*)::INTEGER AS tx_count
    FROM public.transactions tr
    WHERE tr.status = 'completed'
      AND (
        tr.sender_id = p_user_id
        OR tr.receiver_id = p_user_id
      )
  ) t
  CROSS JOIN (
    SELECT COUNT(*)::INTEGER AS paid_count
    FROM public.invoices i
    WHERE (i.sender_id = p_user_id OR i.recipient_id = p_user_id)
      AND i.status = 'paid'
  ) inv
  CROSS JOIN (
    SELECT COUNT(*)::INTEGER AS paid_count
    FROM public.payment_requests pr
    WHERE (pr.requester_id = p_user_id OR pr.payer_id = p_user_id)
      AND pr.status = 'paid'
  ) req
  CROSS JOIN (
    SELECT COUNT(*)::INTEGER AS pay_count
    FROM public.merchant_payments mp
    WHERE mp.status = 'succeeded'
      AND (
        mp.buyer_user_id = p_user_id
        OR mp.merchant_user_id = p_user_id
      )
  ) mp;

  RETURN QUERY
  SELECT
    (v_score >= 120 AND v_activity >= 8),
    v_score,
    120,
    v_activity,
    8;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_my_loan_application(
  p_requested_amount NUMERIC,
  p_requested_term_months INTEGER,
  p_full_name TEXT,
  p_contact_number TEXT,
  p_address_line TEXT,
  p_city TEXT,
  p_country TEXT,
  p_openpay_account_number TEXT,
  p_openpay_account_username TEXT,
  p_agreement_accepted BOOLEAN DEFAULT false
)
RETURNS public.user_loan_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_app public.user_loan_applications;
  v_existing_id UUID;
  v_credit_score INTEGER := 0;
  v_unlocked BOOLEAN := false;
  v_required_score INTEGER := 120;
  v_total_activity INTEGER := 0;
  v_required_activity INTEGER := 8;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF COALESCE(p_agreement_accepted, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'You must accept loan agreement before submitting';
  END IF;

  IF COALESCE(TRIM(p_full_name), '') = '' OR COALESCE(TRIM(p_contact_number), '') = '' OR COALESCE(TRIM(p_address_line), '') = '' OR
     COALESCE(TRIM(p_city), '') = '' OR COALESCE(TRIM(p_country), '') = '' OR
     COALESCE(TRIM(p_openpay_account_number), '') = '' OR COALESCE(TRIM(p_openpay_account_username), '') = '' THEN
    RAISE EXCEPTION 'Complete all required loan form fields';
  END IF;

  SELECT ula.id INTO v_existing_id
  FROM public.user_loan_applications ula
  WHERE ula.user_id = v_user_id
    AND ula.status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already have a pending loan application';
  END IF;

  SELECT ul.id INTO v_existing_id
  FROM public.user_loans ul
  WHERE ul.user_id = v_user_id
    AND ul.status IN ('pending', 'active')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already have an active or pending loan';
  END IF;

  BEGIN
    v_credit_score := public.calculate_user_activity_credit_score(v_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_credit_score := 0;
  END;

  SELECT c.unlocked, c.score, c.required_score, c.total_activity, c.required_activity
  INTO v_unlocked, v_credit_score, v_required_score, v_total_activity, v_required_activity
  FROM public.can_user_unlock_loans(v_user_id) c;

  IF COALESCE(v_unlocked, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Loan unlock requirements not met. Current score: %, required score: %, activity: %/%',
      COALESCE(v_credit_score, 0),
      COALESCE(v_required_score, 120),
      COALESCE(v_total_activity, 0),
      COALESCE(v_required_activity, 8);
  END IF;

  INSERT INTO public.user_loan_applications (
    user_id,
    requested_amount,
    requested_term_months,
    credit_score_snapshot,
    full_name,
    contact_number,
    address_line,
    city,
    country,
    openpay_account_number,
    openpay_account_username,
    agreement_accepted,
    agreement_accepted_at,
    status
  )
  VALUES (
    v_user_id,
    ROUND(COALESCE(p_requested_amount, 0), 2),
    GREATEST(1, LEAST(COALESCE(p_requested_term_months, 6), 60)),
    GREATEST(300, LEAST(v_credit_score, 900)),
    LEFT(TRIM(p_full_name), 120),
    LEFT(TRIM(p_contact_number), 60),
    LEFT(TRIM(p_address_line), 180),
    LEFT(TRIM(p_city), 120),
    LEFT(TRIM(p_country), 120),
    LEFT(TRIM(p_openpay_account_number), 80),
    LEFT(TRIM(p_openpay_account_username), 80),
    true,
    now(),
    'pending'
  )
  RETURNING * INTO v_app;

  RETURN v_app;
END;
$$;

REVOKE ALL ON FUNCTION public.can_user_unlock_loans(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_user_unlock_loans(UUID) TO authenticated;

