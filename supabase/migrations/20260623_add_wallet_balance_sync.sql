-- Add current_balance column to wallets table
ALTER TABLE public.wallets 
ADD COLUMN current_balance NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Update current_balance for existing wallets based on transactions
UPDATE public.wallets w
SET current_balance = w.initial_balance + COALESCE(
  (SELECT COALESCE(SUM(
    CASE 
      WHEN t.kind = 'income' THEN t.amount
      WHEN t.kind = 'expense' THEN -t.amount
      WHEN t.kind = 'savings' THEN -t.amount
      WHEN t.kind = 'debt' THEN (
        CASE 
          WHEN c.name = 'Cho nợ' THEN -t.amount
          ELSE t.amount
        END
      )
      ELSE 0
    END
  ), 0)
  FROM public.transactions t
  LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.wallet_id = w.id AND t.user_id = w.user_id),
  0
);

-- Function to update wallet balance when transaction is inserted
CREATE OR REPLACE FUNCTION public.update_wallet_balance_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta NUMERIC(18,2) := 0;
  cat_name TEXT;
BEGIN
  -- Calculate the delta based on transaction kind
  IF NEW.kind = 'income' THEN
    delta := NEW.amount;
  ELSIF NEW.kind = 'expense' THEN
    delta := -NEW.amount;
  ELSIF NEW.kind = 'savings' THEN
    delta := -NEW.amount;
  ELSIF NEW.kind = 'debt' THEN
    -- Get category name to determine if it's lending or borrowing
    SELECT c.name INTO cat_name FROM public.categories c WHERE c.id = NEW.category_id;
    IF cat_name = 'Cho nợ' THEN
      delta := -NEW.amount;
    ELSE
      delta := NEW.amount;
    END IF;
  END IF;

  -- Update the wallet balance
  UPDATE public.wallets 
  SET current_balance = current_balance + delta
  WHERE id = NEW.wallet_id AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Function to update wallet balance when transaction is updated
CREATE OR REPLACE FUNCTION public.update_wallet_balance_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_delta NUMERIC(18,2) := 0;
  new_delta NUMERIC(18,2) := 0;
  cat_name TEXT;
BEGIN
  -- Calculate old delta
  IF OLD.kind = 'income' THEN
    old_delta := OLD.amount;
  ELSIF OLD.kind = 'expense' THEN
    old_delta := -OLD.amount;
  ELSIF OLD.kind = 'savings' THEN
    old_delta := -OLD.amount;
  ELSIF OLD.kind = 'debt' THEN
    SELECT c.name INTO cat_name FROM public.categories c WHERE c.id = OLD.category_id;
    IF cat_name = 'Cho nợ' THEN
      old_delta := -OLD.amount;
    ELSE
      old_delta := OLD.amount;
    END IF;
  END IF;

  -- Calculate new delta
  IF NEW.kind = 'income' THEN
    new_delta := NEW.amount;
  ELSIF NEW.kind = 'expense' THEN
    new_delta := -NEW.amount;
  ELSIF NEW.kind = 'savings' THEN
    new_delta := -NEW.amount;
  ELSIF NEW.kind = 'debt' THEN
    SELECT c.name INTO cat_name FROM public.categories c WHERE c.id = NEW.category_id;
    IF cat_name = 'Cho nợ' THEN
      new_delta := -NEW.amount;
    ELSE
      new_delta := NEW.amount;
    END IF;
  END IF;

  -- If wallet_id changed, update both old and new wallet
  IF OLD.wallet_id != NEW.wallet_id THEN
    UPDATE public.wallets 
    SET current_balance = current_balance - old_delta
    WHERE id = OLD.wallet_id AND user_id = OLD.user_id;
    
    UPDATE public.wallets 
    SET current_balance = current_balance + new_delta
    WHERE id = NEW.wallet_id AND user_id = NEW.user_id;
  ELSE
    -- Same wallet, just apply the difference
    UPDATE public.wallets 
    SET current_balance = current_balance + (new_delta - old_delta)
    WHERE id = NEW.wallet_id AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Function to update wallet balance when transaction is deleted
CREATE OR REPLACE FUNCTION public.update_wallet_balance_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta NUMERIC(18,2) := 0;
  cat_name TEXT;
BEGIN
  -- Calculate the delta to remove
  IF OLD.kind = 'income' THEN
    delta := OLD.amount;
  ELSIF OLD.kind = 'expense' THEN
    delta := -OLD.amount;
  ELSIF OLD.kind = 'savings' THEN
    delta := -OLD.amount;
  ELSIF OLD.kind = 'debt' THEN
    SELECT c.name INTO cat_name FROM public.categories c WHERE c.id = OLD.category_id;
    IF cat_name = 'Cho nợ' THEN
      delta := -OLD.amount;
    ELSE
      delta := OLD.amount;
    END IF;
  END IF;

  -- Remove the delta from wallet balance
  UPDATE public.wallets 
  SET current_balance = current_balance - delta
  WHERE id = OLD.wallet_id AND user_id = OLD.user_id;

  RETURN OLD;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS on_transaction_insert ON public.transactions;
CREATE TRIGGER on_transaction_insert
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_balance_on_insert();

DROP TRIGGER IF EXISTS on_transaction_update ON public.transactions;
CREATE TRIGGER on_transaction_update
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_balance_on_update();

DROP TRIGGER IF EXISTS on_transaction_delete ON public.transactions;
CREATE TRIGGER on_transaction_delete
AFTER DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_balance_on_delete();
