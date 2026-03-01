-- Fix invoices_status_check to include 'rejected' status
-- First drop the existing constraint, then re-add with all needed statuses
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'rejected'::text]));