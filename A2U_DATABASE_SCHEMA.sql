-- =====================================================
-- A2U (App-to-User) Payout System Database Schema
-- =====================================================
-- This SQL script creates the complete database structure
-- for Pi Network A2U payouts functionality

-- =====================================================
-- 1. User Profiles Table
-- Stores Pi Network authentication and user information
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pi_uid VARCHAR(255),                    -- Pi Network user UID
  pi_username VARCHAR(255),               -- Pi Network username
  pi_verified BOOLEAN DEFAULT false,      -- Pi Network verification status
  pi_access_token TEXT,                   -- Pi Network access token (encrypted)
  pi_refresh_token TEXT,                  -- Pi Network refresh token (encrypted)
  pi_token_expires_at TIMESTAMP WITH TIME ZONE, -- Token expiration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_supabase_user_id ON user_profiles(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_pi_uid ON user_profiles(pi_uid);
CREATE INDEX IF NOT EXISTS idx_user_profiles_pi_username ON user_profiles(pi_username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_pi_verified ON user_profiles(pi_verified);

-- =====================================================
-- 2. A2U Payouts Table
-- Tracks all A2U payout transactions
-- =====================================================

CREATE TABLE IF NOT EXISTS a2u_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pi_username VARCHAR(255) NOT NULL,
  pi_uid VARCHAR(255) NOT NULL,
  amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
  memo TEXT,
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  pi_payment_id VARCHAR(255) UNIQUE,      -- Pi Network payment identifier
  pi_txid VARCHAR(255),                   -- Blockchain transaction ID
  recipient_address VARCHAR(255),         -- Recipient's blockchain address
  error_message TEXT,                     -- Error details if failed
  metadata JSONB,                         -- Additional payment metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE   -- When payment was completed
);

-- Indexes for a2u_payouts
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_user_id ON a2u_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_pi_uid ON a2u_payouts(pi_uid);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_status ON a2u_payouts(status);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_pi_payment_id ON a2u_payouts(pi_payment_id);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_created_at ON a2u_payouts(created_at);
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_pi_username ON a2u_payouts(pi_username);

-- =====================================================
-- 3. Payment Audit Log Table
-- Tracks all payment-related activities for compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES a2u_payouts(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,             -- Action type: created, submitted, completed, failed, cancelled
  status_before VARCHAR(20),              -- Status before action
  status_after VARCHAR(20),               -- Status after action
  details JSONB,                          -- Action details
  error_message TEXT,                     -- Error if any
  ip_address INET,                        -- Client IP address
  user_agent TEXT,                        -- Client user agent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment_audit_log
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_payout_id ON payment_audit_log(payout_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_action ON payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_created_at ON payment_audit_log(created_at);

-- =====================================================
-- 4. User Balance Tracking Table
-- Tracks user payout limits and balances
-- =====================================================

CREATE TABLE IF NOT EXISTS user_balance_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_payouts DECIMAL(20,8) DEFAULT 0,  -- Total amount paid out
  daily_payouts DECIMAL(20,8) DEFAULT 0,   -- Amount paid out today
  weekly_payouts DECIMAL(20,8) DEFAULT 0,  -- Amount paid out this week
  monthly_payouts DECIMAL(20,8) DEFAULT 0, -- Amount paid out this month
  last_payout_at TIMESTAMP WITH TIME ZONE, -- Last payout timestamp
  payout_count INTEGER DEFAULT 0,         -- Total number of payouts
  daily_reset_date DATE DEFAULT CURRENT_DATE, -- Date for daily reset
  weekly_reset_date DATE DEFAULT CURRENT_DATE, -- Date for weekly reset
  monthly_reset_date DATE DEFAULT CURRENT_DATE, -- Date for monthly reset
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_balance_tracking
CREATE INDEX IF NOT EXISTS idx_user_balance_tracking_user_id ON user_balance_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_balance_tracking_daily_reset ON user_balance_tracking(daily_reset_date);
CREATE INDEX IF NOT EXISTS idx_user_balance_tracking_weekly_reset ON user_balance_tracking(weekly_reset_date);
CREATE INDEX IF NOT EXISTS idx_user_balance_tracking_monthly_reset ON user_balance_tracking(monthly_reset_date);

-- =====================================================
-- 5. System Configuration Table
-- Stores system-wide configuration settings
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system configuration
INSERT INTO system_config (key, value, description, is_encrypted) VALUES
('min_payout_amount', '0.01', 'Minimum payout amount in Pi', false),
('max_payout_amount', '1000.00', 'Maximum payout amount in Pi', false),
('daily_payout_limit', '10.00', 'Daily payout limit per user in Pi', false),
('weekly_payout_limit', '50.00', 'Weekly payout limit per user in Pi', false),
('monthly_payout_limit', '200.00', 'Monthly payout limit per user in Pi', false),
('max_daily_payouts', '10', 'Maximum number of payouts per user per day', false),
('pi_network_environment', 'testnet', 'Pi Network environment (testnet/mainnet)', false),
('auto_cleanup_incomplete', 'true', 'Auto-cleanup incomplete payments', false),
('cleanup_interval_hours', '1', 'Hours between cleanup runs', false)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 6. Views for Common Queries
-- =====================================================

-- View for user payout summary
CREATE OR REPLACE VIEW user_payout_summary AS
SELECT 
  u.id as user_id,
  u.email,
  up.pi_username,
  up.pi_uid,
  up.pi_verified,
  COALESCE(bt.total_payouts, 0) as total_payouts,
  COALESCE(bt.payout_count, 0) as total_payout_count,
  COALESCE(bt.daily_payouts, 0) as daily_payouts,
  COALESCE(bt.weekly_payouts, 0) as weekly_payouts,
  COALESCE(bt.monthly_payouts, 0) as monthly_payouts,
  bt.last_payout_at,
  up.created_at as user_profile_created_at
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.supabase_user_id
LEFT JOIN user_balance_tracking bt ON u.id = bt.user_id;

-- View for payout statistics
CREATE OR REPLACE VIEW payout_statistics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  status,
  COUNT(*) as payout_count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM a2u_payouts
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY date DESC;

-- View for recent payouts
CREATE OR REPLACE VIEW recent_payouts AS
SELECT 
  ap.id,
  ap.pi_username,
  ap.amount,
  ap.status,
  ap.memo,
  ap.created_at,
  ap.completed_at,
  CASE 
    WHEN ap.status = 'completed' THEN '✅'
    WHEN ap.status = 'failed' THEN '❌'
    WHEN ap.status = 'processing' THEN '⏳'
    WHEN ap.status = 'cancelled' THEN '🚫'
    ELSE ap.status
  END as status_icon
FROM a2u_payouts ap
ORDER BY ap.created_at DESC
LIMIT 100;

-- =====================================================
-- 7. Triggers and Functions
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_a2u_payouts_updated_at BEFORE UPDATE ON a2u_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_balance_tracking_updated_at BEFORE UPDATE ON user_balance_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log payout changes
CREATE OR REPLACE FUNCTION log_payout_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO payment_audit_log (
        payout_id, action, status_before, status_after, details, created_at
    ) VALUES (
        NEW.id, 
        'status_change',
        OLD.status,
        NEW.status,
        json_build_object(
            'amount', NEW.amount,
            'pi_username', NEW.pi_username,
            'pi_uid', NEW.pi_uid,
            'payment_id', NEW.pi_payment_id,
            'txid', NEW.pi_txid
        ),
        NOW()
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for payout status changes
CREATE TRIGGER log_payout_status_change AFTER UPDATE ON a2u_payouts
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_payout_change();

-- =====================================================
-- 8. Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2u_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balance_tracking ENABLE ROW LEVEL SECURITY;

-- Policy for user_profiles - users can only see their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = supabase_user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = supabase_user_id);

-- Policy for a2u_payouts - users can only see their own payouts
CREATE POLICY "Users can view own payouts" ON a2u_payouts
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for payment_audit_log - users can only see their own audit logs
CREATE POLICY "Users can view own audit logs" ON payment_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM a2u_payouts ap 
            WHERE ap.id = payment_audit_log.payout_id 
            AND ap.user_id = auth.uid()
        )
    );

-- Policy for user_balance_tracking - users can only see their own balance
CREATE POLICY "Users can view own balance" ON user_balance_tracking
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- 9. Sample Data (for testing)
-- =====================================================

-- Note: Uncomment these for testing purposes only
/*
-- Sample user profile
INSERT INTO user_profiles (supabase_user_id, pi_uid, pi_username, pi_verified)
VALUES ('00000000-0000-0000-0000-000000000000', 'test_user_123', 'testuser', true);

-- Sample balance tracking
INSERT INTO user_balance_tracking (user_id, total_payouts, payout_count)
VALUES ('00000000-0000-0000-0000-000000000000', 0.05, 5);
*/

-- =====================================================
-- 10. Maintenance and Cleanup Queries
-- =====================================================

-- Query to reset daily payouts (run daily)
-- UPDATE user_balance_tracking 
-- SET daily_payouts = 0, daily_reset_date = CURRENT_DATE 
-- WHERE daily_reset_date < CURRENT_DATE;

-- Query to reset weekly payouts (run weekly)
-- UPDATE user_balance_tracking 
-- SET weekly_payouts = 0, weekly_reset_date = CURRENT_DATE 
-- WHERE weekly_reset_date < CURRENT_DATE;

-- Query to reset monthly payouts (run monthly)
-- UPDATE user_balance_tracking 
-- SET monthly_payouts = 0, monthly_reset_date = CURRENT_DATE 
-- WHERE monthly_reset_date < CURRENT_DATE;

-- Query to clean up old audit logs (keep last 90 days)
-- DELETE FROM payment_audit_log 
-- WHERE created_at < NOW() - INTERVAL '90 days';

-- =====================================================
-- 11. Performance Optimization
-- =====================================================

-- Analyze tables for better query planning
ANALYZE user_profiles;
ANALYZE a2u_payouts;
ANALYZE payment_audit_log;
ANALYZE user_balance_tracking;
ANALYZE system_config;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
-- Database schema for A2U payout system has been created successfully.
-- 
-- Tables created:
-- - user_profiles: User Pi Network information
-- - a2u_payouts: Payout transaction records
-- - payment_audit_log: Audit trail for compliance
-- - user_balance_tracking: Balance and limit tracking
-- - system_config: System configuration
-- 
-- Views created:
-- - user_payout_summary: User payout overview
-- - payout_statistics: Payout statistics by date
-- - recent_payouts: Recent payout activity
-- 
-- Security:
-- - Row Level Security enabled
-- - Users can only access their own data
-- - Audit logging for all payout changes
-- 
-- Performance:
-- - Proper indexes created
-- - Triggers for automated updates
-- - Views for common queries
