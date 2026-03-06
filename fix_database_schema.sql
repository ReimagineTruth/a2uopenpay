-- =====================================================
-- Database Schema Fix for A2U Payouts
-- =====================================================
-- This script fixes the missing completed_at column issue

-- Check if completed_at column exists in a2u_payouts table
-- If it doesn't exist, add it

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='a2u_payouts' 
        AND column_name='completed_at'
    ) THEN
        ALTER TABLE a2u_payouts 
        ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added completed_at column to a2u_payouts table';
    ELSE
        RAISE NOTICE 'completed_at column already exists in a2u_payouts table';
    END IF;
END $$;

-- Update the recent_payouts view to handle missing completed_at column gracefully
DROP VIEW IF EXISTS recent_payouts;

CREATE OR REPLACE VIEW recent_payouts AS
SELECT 
  ap.id,
  ap.pi_username,
  ap.amount,
  ap.status,
  ap.memo,
  ap.created_at,
  COALESCE(ap.completed_at, NULL) as completed_at,  -- Handle missing column gracefully
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

-- Add trigger to automatically set completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION set_completed_at_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed to 'completed' and completed_at is not set, set it to NOW()
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND (NEW.completed_at IS NULL OR NEW.completed_at = OLD.completed_at) THEN
        NEW.completed_at = NOW();
    END IF;
    
    -- If status changed from 'completed' to something else, clear completed_at
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_completed_at_trigger ON a2u_payouts;

-- Create the trigger
CREATE TRIGGER set_completed_at_trigger
    BEFORE UPDATE ON a2u_payouts
    FOR EACH ROW
    EXECUTE FUNCTION set_completed_at_trigger();

-- Update existing completed payments to have completed_at timestamps
UPDATE a2u_payouts 
SET completed_at = updated_at 
WHERE status = 'completed' AND completed_at IS NULL;

-- Add index for completed_at for better performance
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_completed_at ON a2u_payouts(completed_at) WHERE completed_at IS NOT NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'a2u_payouts' 
AND column_name IN ('completed_at', 'status', 'updated_at')
ORDER BY column_name;

-- Test the view
SELECT * FROM recent_payouts LIMIT 5;

-- Check for any payments that might need completed_at set
SELECT 
    id, 
    status, 
    created_at, 
    updated_at, 
    completed_at,
    CASE 
        WHEN status = 'completed' AND completed_at IS NULL THEN 'Missing completed_at'
        ELSE 'OK'
    END as status_check
FROM a2u_payouts 
WHERE status = 'completed'
ORDER BY created_at DESC;

-- =====================================================
-- Completion Message
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '====================================================';
    RAISE NOTICE 'Database schema fix completed successfully!';
    RAISE NOTICE '====================================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Added completed_at column if missing';
    RAISE NOTICE '2. Updated recent_payouts view';
    RAISE NOTICE '3. Added automatic completed_at trigger';
    RAISE NOTICE '4. Updated existing completed payments';
    RAISE NOTICE '5. Added performance index';
    RAISE NOTICE '====================================================';
END $$;
