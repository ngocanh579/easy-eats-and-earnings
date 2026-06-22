-- Recalculate wallet balances from all transactions
-- IMPORTANT: This excludes Savings transactions which should NOT affect wallet balance
-- Wallet balance = initial_balance + sum(income - expense + debt_effect)
-- Savings are tracked separately and added to total assets, not wallet balance

UPDATE public.wallets w
SET current_balance = w.initial_balance + COALESCE(
  (SELECT COALESCE(SUM(
    CASE 
      -- Income: adds to balance
      WHEN t.kind = 'income' THEN t.amount
      -- Expense: subtracts from balance
      WHEN t.kind = 'expense' THEN -t.amount
      -- Debt: "Cho nợ" (lending) subtracts, others add
      WHEN t.kind = 'debt' THEN (
        CASE 
          WHEN c.name = 'Cho nợ' THEN -t.amount
          ELSE t.amount
        END
      )
      -- Savings: DOES NOT affect wallet balance - handled separately
      WHEN t.kind = 'savings' THEN 0
      ELSE 0
    END
  ), 0)
  FROM public.transactions t
  LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.wallet_id = w.id AND t.user_id = w.user_id),
  0
);
