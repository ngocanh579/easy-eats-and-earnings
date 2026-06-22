-- Recalculate wallet balances from all transactions
-- IMPORTANT: This excludes Savings transactions which should NOT affect wallet balance
-- Formula: current_balance = initial_balance + sum(income - expense + debt_effect)
-- Debt logic:
--   - "Cho nợ" (lending): decrease wallet, money is lent out
--   - Other debt (borrowing/repayment): handled by amount sign, affects wallet

UPDATE public.wallets
SET current_balance = initial_balance + COALESCE(
  (
    SELECT SUM(
      CASE
        WHEN kind = 'income' THEN amount
        WHEN kind = 'expense' THEN -amount
        WHEN kind = 'debt' THEN (
          CASE
            WHEN c.name = 'Cho nợ' THEN -amount
            ELSE amount
          END
        )
        ELSE 0
      END
    )
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.wallet_id = wallets.id
    AND kind != 'savings'
  ), 0
);
