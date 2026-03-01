
-- 20260301150000_add_bulk_transfer_funds.sql
-- Add support for sending funds to multiple recipients in a single atomic transaction

CREATE OR REPLACE FUNCTION public.bulk_transfer_funds(
  p_recipients UUID[],
  p_amounts NUMERIC[],
  p_notes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_sender_balance NUMERIC;
  v_total_amount NUMERIC := 0;
  v_i INTEGER;
  v_tx_ids UUID[] := '{}';
  v_tx_id UUID;
BEGIN
  -- Basic validation
  IF array_length(p_recipients, 1) IS NULL OR array_length(p_recipients, 1) = 0 THEN
    RETURN jsonb_build_object('error', 'No recipients specified');
  END IF;

  IF array_length(p_recipients, 1) <> array_length(p_amounts, 1) OR 
     array_length(p_recipients, 1) <> array_length(p_notes, 1) THEN
    RETURN jsonb_build_object('error', 'Input arrays must have the same length');
  END IF;

  IF array_length(p_recipients, 1) > 5 THEN
    RETURN jsonb_build_object('error', 'Maximum 5 recipients allowed per bulk transfer');
  END IF;

  -- Calculate total amount and check for self-transfer/negative amounts
  FOR v_i IN 1..array_length(p_recipients, 1) LOOP
    IF p_recipients[v_i] = v_sender_id THEN
      RETURN jsonb_build_object('error', 'Cannot send funds to yourself');
    END IF;
    IF p_amounts[v_i] <= 0 THEN
      RETURN jsonb_build_object('error', 'Transfer amount must be positive');
    END IF;
    v_total_amount := v_total_amount + p_amounts[v_i];
  END LOOP;

  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = v_sender_id
  FOR UPDATE; -- Lock sender's wallet for the duration of the transaction

  IF v_sender_balance < v_total_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient funds for total bulk transfer');
  END IF;

  -- Perform transfers
  FOR v_i IN 1..array_length(p_recipients, 1) LOOP
    -- Subtract from sender
    UPDATE public.wallets
    SET balance = balance - p_amounts[v_i],
        updated_at = now()
    WHERE user_id = v_sender_id;

    -- Add to receiver
    UPDATE public.wallets
    SET balance = balance + p_amounts[v_i],
        updated_at = now()
    WHERE user_id = p_recipients[v_i];

    -- Record transaction
    INSERT INTO public.transactions (
      sender_id,
      receiver_id,
      amount,
      note,
      status,
      type
    ) VALUES (
      v_sender_id,
      p_recipients[v_i],
      p_amounts[v_i],
      COALESCE(p_notes[v_i], ''),
      'completed',
      'transfer'
    ) RETURNING id INTO v_tx_id;

    v_tx_ids := array_append(v_tx_ids, v_tx_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_ids', v_tx_ids,
    'total_amount', v_total_amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.bulk_transfer_funds(UUID[], NUMERIC[], TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.bulk_transfer_funds IS 'Performs multiple fund transfers atomically (max 5 recipients)';
