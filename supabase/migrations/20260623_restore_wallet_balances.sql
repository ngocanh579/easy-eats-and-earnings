-- Recovery migration: Restore wallet balances to their correct values
-- The previous migration incorrectly reset balances to 0
-- This migration restores them from the preserved initial_balance values

-- First, restore current_balance from initial_balance for all wallets
UPDATE public.wallets 
SET current_balance = initial_balance;

-- Verify the restoration worked
-- SELECT id, name, initial_balance, current_balance FROM public.wallets;
