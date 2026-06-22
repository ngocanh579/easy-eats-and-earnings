-- Recalculate wallet balances from all transactions
-- IMPORTANT: This excludes Savings transactions which should NOT affect wallet balance
-- Formula: current_balance = initial_balance + sum(income - expense)
-- Savings are tracked separately and added to total assets, not wallet balance

UPDATE public.wallets
SET current_balance = initial_balance + COALESCE(
  (
    SELECT SUM(
      CASE
        WHEN kind = 'income' THEN amount
        WHEN kind = 'expense' THEN -amount
        ELSE 0
      END
    )
    FROM transactions
    WHERE wallet_id = wallets.id
    AND kind != 'savings'
  ), 0
);
