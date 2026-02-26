-- Add missing total_amount column to merchant_payment_links table
-- This migration fixes the "column total_amount does not exist" error

-- Add total_amount column to merchant_payment_links table
ALTER TABLE public.merchant_payment_links 
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) CHECK (total_amount > 0);

-- Add api_key_id column if it doesn't exist (for tracking which API key was used)
ALTER TABLE public.merchant_payment_links 
ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL;

-- Add reference_number column for merchant reference
ALTER TABLE public.merchant_payment_links 
ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Add remarks column for additional notes
ALTER TABLE public.merchant_payment_links 
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add archived_at column for soft deletion
ALTER TABLE public.merchant_payment_links 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_merchant_payment_links_total_amount 
ON public.merchant_payment_links(total_amount);

CREATE INDEX IF NOT EXISTS idx_merchant_payment_links_api_key_id 
ON public.merchant_payment_links(api_key_id);

CREATE INDEX IF NOT EXISTS idx_merchant_payment_links_archived_at 
ON public.merchant_payment_links(archived_at);

-- Update existing payment links to calculate total_amount from items
UPDATE public.merchant_payment_links mpl
SET total_amount = (
  SELECT COALESCE(SUM(mpli.line_total), 0)
  FROM public.merchant_payment_link_items mpli
  WHERE mpli.link_id = mpl.id
)
WHERE mpl.total_amount IS NULL
AND mpl.link_type = 'products';

-- For custom_amount links, set total_amount from custom_amount
UPDATE public.merchant_payment_links
SET total_amount = custom_amount
WHERE total_amount IS NULL
AND link_type = 'custom_amount'
AND custom_amount IS NOT NULL;

-- Update RLS policies to include new columns
DROP POLICY IF EXISTS "Users can view their own payment links" ON public.merchant_payment_links;
CREATE POLICY "Users can view their own payment links" ON public.merchant_payment_links
  FOR SELECT USING (merchant_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own payment links" ON public.merchant_payment_links;
CREATE POLICY "Users can insert their own payment links" ON public.merchant_payment_links
  FOR INSERT WITH CHECK (merchant_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own payment links" ON public.merchant_payment_links;
CREATE POLICY "Users can update their own payment links" ON public.merchant_payment_links
  FOR UPDATE USING (merchant_user_id = auth.uid());

-- Grant permissions for the updated table
GRANT ALL ON public.merchant_payment_links TO authenticated;
GRANT ALL ON public.merchant_payment_links TO service_role;
