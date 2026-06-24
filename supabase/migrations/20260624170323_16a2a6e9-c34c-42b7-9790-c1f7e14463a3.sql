-- 1. Debt transactions no longer affect wallet balance
CREATE OR REPLACE FUNCTION public._tx_wallet_delta(_kind text, _amount numeric, _category_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _kind = 'income'  THEN RETURN _amount; END IF;
  IF _kind = 'expense' THEN RETURN -_amount; END IF;
  -- debt and savings have NO effect on wallet balance
  RETURN 0;
END;
$function$;

-- 2. Add is_paid column for debt repayment tracking
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 3. Recompute all wallet balances: initial + income - expense ONLY
UPDATE public.wallets w
SET current_balance = COALESCE(w.initial_balance, 0) + COALESCE((
  SELECT SUM(CASE
    WHEN t.kind = 'income'  THEN t.amount
    WHEN t.kind = 'expense' THEN -t.amount
    ELSE 0
  END)
  FROM public.transactions t
  WHERE t.wallet_id = w.id
), 0);
