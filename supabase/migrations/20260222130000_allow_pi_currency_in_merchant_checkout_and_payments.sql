ALTER TABLE public.merchant_checkout_sessions
DROP CONSTRAINT IF EXISTS merchant_checkout_sessions_currency_check;

ALTER TABLE public.merchant_checkout_sessions
ADD CONSTRAINT merchant_checkout_sessions_currency_check
CHECK (
  currency = 'PI'
  OR currency ~ '^[A-Z]{3}$'
);

ALTER TABLE public.merchant_payments
DROP CONSTRAINT IF EXISTS merchant_payments_currency_check;

ALTER TABLE public.merchant_payments
ADD CONSTRAINT merchant_payments_currency_check
CHECK (
  currency = 'PI'
  OR currency ~ '^[A-Z]{3}$'
);
