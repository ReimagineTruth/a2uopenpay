ALTER TABLE public.merchant_products
ADD COLUMN IF NOT EXISTS product_tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS checkout_info TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'one_time' CHECK (pricing_type IN ('one_time', 'subscription')),
ADD COLUMN IF NOT EXISTS repeat_every INTEGER,
ADD COLUMN IF NOT EXISTS repeat_unit TEXT,
ADD COLUMN IF NOT EXISTS tax_code TEXT,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_merchant_products_owner_published
ON public.merchant_products (merchant_user_id, published_at DESC);

DROP VIEW IF EXISTS public.merchant_product_stats;
CREATE VIEW public.merchant_product_stats AS
SELECT
  mpsi.product_id,
  mcs.merchant_user_id,
  COUNT(DISTINCT mp.id) AS total_sales,
  COUNT(DISTINCT mp.id) AS total_purchases,
  COALESCE(SUM(CASE WHEN mp.id IS NOT NULL THEN mpsi.line_total ELSE 0 END), 0) AS total_revenue
FROM public.merchant_checkout_session_items mpsi
JOIN public.merchant_checkout_sessions mcs
  ON mcs.id = mpsi.session_id
LEFT JOIN public.merchant_payments mp
  ON mp.session_id = mcs.id
  AND mp.status = 'succeeded'
GROUP BY mpsi.product_id, mcs.merchant_user_id;

ALTER TABLE public.merchant_payment_links
ADD COLUMN IF NOT EXISTS reference_number TEXT,
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
