-- Recreate wallet-balance triggers (previous attempt left them missing)
-- and recompute current_balance for every wallet from scratch.
-- Income → +amount, Expense → -amount, Debt → sign by category
-- ('Cho nợ' = lending = -amount, otherwise borrowing = +amount).
-- Savings transactions do NOT affect wallet balance.

DROP TRIGGER IF EXISTS trg_tx_after_insert ON public.transactions;
DROP TRIGGER IF EXISTS trg_tx_after_update ON public.transactions;
DROP TRIGGER IF EXISTS trg_tx_after_delete ON public.transactions;

CREATE TRIGGER trg_tx_after_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_apply_insert();

CREATE TRIGGER trg_tx_after_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_apply_update();

CREATE TRIGGER trg_tx_after_delete
  AFTER DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_apply_delete();

-- Recompute current_balance for every wallet from the actual ledger.
UPDATE public.wallets w
SET current_balance = w.initial_balance + COALESCE((
  SELECT SUM(
    CASE
      WHEN t.kind::text = 'income'  THEN t.amount
      WHEN t.kind::text = 'expense' THEN -t.amount
      WHEN t.kind::text = 'debt' THEN
        CASE WHEN c.name = 'Cho nợ' THEN -t.amount ELSE t.amount END
      ELSE 0
    END
  )
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.category_id
  WHERE t.wallet_id = w.id
), 0);
