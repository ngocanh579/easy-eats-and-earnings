-- Create a function to calculate wallet balance as a single source of truth
-- Rules:
-- - Income: +amount
-- - Expense: -amount
-- - Savings (positive): -amount (money leaves wallet into savings pot)
-- - Savings (negative): +amount (money returns from savings pot to wallet)
-- - Debt Khoản nợ (borrow): +amount (money enters wallet)
-- - Debt Cho nợ (lending): -amount (money leaves wallet)
-- - Debt repayment/collection (indicated by negative amount): reverses the above
-- - Transfer: handled by separate source/dest wallet entries

CREATE OR REPLACE FUNCTION public.calculate_wallet_balance(p_wallet_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC;
  v_initial_balance NUMERIC;
BEGIN
  -- Get initial balance from wallet
  SELECT initial_balance INTO v_initial_balance
  FROM public.wallets
  WHERE id = p_wallet_id;
  
  IF v_initial_balance IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Start with initial balance
  v_balance := v_initial_balance;
  
  -- Add/subtract transactions based on their kind
  -- This is the SINGLE source of truth for balance calculation
  SELECT v_balance + COALESCE(SUM(
    CASE 
      -- Income: always add
      WHEN kind = 'income' THEN amount
      
      -- Expense: always subtract
      WHEN kind = 'expense' THEN -amount
      
      -- Savings: 
      -- Positive amount = save money (withdraw from wallet)
      -- Negative amount = withdraw savings (add to wallet)
      WHEN kind = 'savings' THEN -amount
      
      -- Debt: check category to determine direction
      WHEN kind = 'debt' THEN
        CASE
          -- "Cho nợ" (lending out) = money leaves wallet = -amount
          -- "Khoản nợ" (borrowing) = money enters wallet = +amount
          WHEN c.name = 'Cho nợ' THEN -amount
          ELSE amount  -- Default for "Khoản nợ" and others
        END
      
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM public.transactions t
  LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.wallet_id = p_wallet_id;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a view for wallet balances (for easier querying)
CREATE OR REPLACE VIEW public.wallet_balances AS
SELECT 
  w.id,
  w.user_id,
  w.name,
  w.type,
  w.icon,
  w.color,
  w.initial_balance,
  public.calculate_wallet_balance(w.id) as current_balance,
  w.created_at,
  w.updated_at
FROM public.wallets w;

-- Grant permissions for the view
ALTER VIEW public.wallet_balances OWNER TO postgres;
