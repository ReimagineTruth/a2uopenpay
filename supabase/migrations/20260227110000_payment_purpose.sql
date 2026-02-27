-- Payment Purpose Schema for Analytics
-- Add purpose column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS purpose TEXT,
ADD COLUMN IF NOT EXISTS purpose_category TEXT,
ADD COLUMN IF NOT EXISTS custom_purpose TEXT;

-- Create payment purposes table
CREATE TABLE IF NOT EXISTS public.payment_purposes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment purpose categories table
CREATE TABLE IF NOT EXISTS public.payment_purpose_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO public.payment_purpose_categories (name, icon, color, sort_order) VALUES
('Living Expenses', 'home', 'blue', 1),
('Transportation', 'car', 'green', 2),
('Food & Dining', 'utensils', 'orange', 3),
('Entertainment', 'gamepad-2', 'purple', 4),
('Shopping', 'shopping-bag', 'pink', 5),
('Healthcare', 'heart', 'red', 6),
('Education', 'graduation-cap', 'indigo', 7),
('Utilities', 'zap', 'yellow', 8),
('Business', 'briefcase', 'gray', 9),
('Personal', 'user', 'teal', 10),
('Other', 'more-horizontal', 'slate', 11)
ON CONFLICT (name) DO NOTHING;

-- Insert default payment purposes
INSERT INTO public.payment_purposes (name, category, icon, color, sort_order) VALUES
-- Living Expenses
('Rent', 'Living Expenses', 'home', 'blue', 1),
('Mortgage', 'Living Expenses', 'building', 'blue', 2),
('Insurance', 'Living Expenses', 'shield', 'blue', 3),
('Property Tax', 'Living Expenses', 'file-text', 'blue', 4),

-- Transportation
('Car Payment', 'Transportation', 'car', 'green', 1),
('Gas/Fuel', 'Transportation', 'fuel', 'green', 2),
('Public Transport', 'Transportation', 'train', 'green', 3),
('Ride Sharing', 'Transportation', 'taxi', 'green', 4),
('Car Maintenance', 'Transportation', 'wrench', 'green', 5),

-- Food & Dining
('Groceries', 'Food & Dining', 'shopping-cart', 'orange', 1),
('Restaurant', 'Food & Dining', 'utensils-crossed', 'orange', 2),
('Food Delivery', 'Food & Dining', 'truck', 'orange', 3),
('Coffee', 'Food & Dining', 'coffee', 'orange', 4),
('Takeout', 'Food & Dining', 'package', 'orange', 5),

-- Entertainment
('Movies', 'Entertainment', 'film', 'purple', 1),
('Music', 'Entertainment', 'music', 'purple', 2),
('Games', 'Entertainment', 'gamepad-2', 'purple', 3),
('Streaming', 'Entertainment', 'tv', 'purple', 4),
('Events', 'Entertainment', 'calendar', 'purple', 5),

-- Shopping
('Clothing', 'Shopping', 'shirt', 'pink', 1),
('Electronics', 'Shopping', 'smartphone', 'pink', 2),
('Home Goods', 'Shopping', 'sofa', 'pink', 3),
('Books', 'Shopping', 'book-open', 'pink', 4),
('Gifts', 'Shopping', 'gift', 'pink', 5),

-- Healthcare
('Doctor Visit', 'Healthcare', 'stethoscope', 'red', 1),
('Medicine', 'Healthcare', 'pill', 'red', 2),
('Dental', 'Healthcare', 'smile', 'red', 3),
('Vision', 'Healthcare', 'eye', 'red', 4),
('Fitness', 'Healthcare', 'dumbbell', 'red', 5),

-- Education
('Tuition', 'Education', 'graduation-cap', 'indigo', 1),
('Books', 'Education', 'book', 'indigo', 2),
('Courses', 'Education', 'laptop', 'indigo', 3),
('School Supplies', 'Education', 'pencil', 'indigo', 4),
('Student Loans', 'Education', 'dollar-sign', 'indigo', 5),

-- Utilities
('Electricity', 'Utilities', 'lightbulb', 'yellow', 1),
('Water', 'Utilities', 'droplet', 'yellow', 2),
('Gas', 'Utilities', 'flame', 'yellow', 3),
('Internet', 'Utilities', 'wifi', 'yellow', 4),
('Phone', 'Utilities', 'phone', 'yellow', 5),
('Trash', 'Utilities', 'trash-2', 'yellow', 6),

-- Business
('Office Supplies', 'Business', 'briefcase', 'gray', 1),
('Software', 'Business', 'monitor', 'gray', 2),
('Marketing', 'Business', 'megaphone', 'gray', 3),
('Travel', 'Business', 'plane', 'gray', 4),
('Equipment', 'Business', 'settings', 'gray', 5),

-- Personal
('Gift', 'Personal', 'gift', 'teal', 1),
('Charity', 'Personal', 'heart', 'teal', 2),
('Family', 'Personal', 'users', 'teal', 3),
('Friends', 'Personal', 'user-plus', 'teal', 4),
('Emergency', 'Personal', 'alert-triangle', 'teal', 5),

-- Other
('General', 'Other', 'more-horizontal', 'slate', 1),
('Uncategorized', 'Other', 'help-circle', 'slate', 2),
('Miscellaneous', 'Other', 'folder', 'slate', 3)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_purpose ON public.transactions(purpose);
CREATE INDEX IF NOT EXISTS idx_transactions_purpose_category ON public.transactions(purpose_category);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_purpose ON public.transactions(created_at, purpose);

-- Create view for analytics by purpose
CREATE OR REPLACE VIEW public.transaction_purpose_analytics AS
SELECT 
  t.purpose,
  t.purpose_category,
  pp.category as category_name,
  COUNT(*) as transaction_count,
  COALESCE(SUM(t.amount), 0) as total_amount,
  COALESCE(AVG(t.amount), 0) as average_amount,
  MIN(t.created_at) as first_transaction,
  MAX(t.created_at) as last_transaction,
  DATE_TRUNC('month', t.created_at) as month,
  DATE_TRUNC('week', t.created_at) as week
FROM public.transactions t
LEFT JOIN public.payment_purposes pp ON t.purpose = pp.name
WHERE t.purpose IS NOT NULL
GROUP BY t.purpose, t.purpose_category, pp.category, DATE_TRUNC('month', t.created_at), DATE_TRUNC('week', t.created_at);

-- Create function to get purpose analytics
CREATE OR REPLACE FUNCTION public.get_purpose_analytics(
  p_user_id UUID DEFAULT NULL,
  p_date_range TEXT DEFAULT 'month' -- 'day', 'week', 'month', 'year'
)
RETURNS TABLE (
  purpose TEXT,
  purpose_category TEXT,
  category_name TEXT,
  transaction_count BIGINT,
  total_amount NUMERIC,
  average_amount NUMERIC,
  percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH purpose_stats AS (
    SELECT 
      t.purpose,
      t.purpose_category,
      pp.category as category_name,
      COUNT(*) as transaction_count,
      COALESCE(SUM(t.amount), 0) as total_amount,
      COALESCE(AVG(t.amount), 0) as average_amount
    FROM public.transactions t
    LEFT JOIN public.payment_purposes pp ON t.purpose = pp.name
    WHERE (p_user_id IS NULL OR (t.sender_id = p_user_id OR t.receiver_id = p_user_id))
      AND t.purpose IS NOT NULL
      AND CASE 
        WHEN p_date_range = 'day' THEN t.created_at >= CURRENT_DATE - INTERVAL '1 day'
        WHEN p_date_range = 'week' THEN t.created_at >= CURRENT_DATE - INTERVAL '1 week'
        WHEN p_date_range = 'month' THEN t.created_at >= CURRENT_DATE - INTERVAL '1 month'
        WHEN p_date_range = 'year' THEN t.created_at >= CURRENT_DATE - INTERVAL '1 year'
        ELSE true
      END
    GROUP BY t.purpose, t.purpose_category, pp.category
  ),
  total_stats AS (
    SELECT SUM(transaction_count) as total_count
    FROM purpose_stats
  )
  SELECT 
    ps.purpose,
    ps.purpose_category,
    ps.category_name,
    ps.transaction_count,
    ps.total_amount,
    ps.average_amount,
    CASE 
      WHEN ts.total_count > 0 THEN (ps.transaction_count::DECIMAL / ts.total_count * 100)
      ELSE 0
    END as percentage
  FROM purpose_stats ps, total_stats ts
  ORDER BY ps.total_amount DESC;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.payment_purposes TO authenticated;
GRANT SELECT ON public.payment_purposes TO service_role;
GRANT SELECT ON public.payment_purpose_categories TO authenticated;
GRANT SELECT ON public.payment_purpose_categories TO service_role;
GRANT SELECT ON public.transaction_purpose_analytics TO authenticated;
GRANT SELECT ON public.transaction_purpose_analytics TO service_role;
GRANT EXECUTE ON FUNCTION public.get_purpose_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purpose_analytics TO service_role;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_payment_purposes_updated_at ON public.payment_purposes;
DROP TRIGGER IF EXISTS update_payment_purpose_categories_updated_at ON public.payment_purpose_categories;

CREATE TRIGGER update_payment_purposes_updated_at 
  BEFORE UPDATE ON public.payment_purposes 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_purpose_categories_updated_at 
  BEFORE UPDATE ON public.payment_purpose_categories 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
