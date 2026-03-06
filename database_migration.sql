-- Add pi_uid column to a2u_payouts table for storing validated Pi user UIDs
ALTER TABLE a2u_payouts 
ADD COLUMN IF NOT EXISTS pi_uid TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_a2u_payouts_pi_uid ON a2u_payouts(pi_uid);

-- Add comment to document the new column
COMMENT ON COLUMN a2u_payouts.pi_uid IS 'The validated Pi Network user UID used for payments';
