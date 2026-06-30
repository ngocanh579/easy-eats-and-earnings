
-- 1. Add 'transfer' to category_kind enum (safe with IF NOT EXISTS)
ALTER TYPE public.category_kind ADD VALUE IF NOT EXISTS 'transfer';

-- 2. Add transfer_to_wallet_id column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_to_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL;

-- 3. Update delta function so transfer subtracts from source wallet
CREATE OR REPLACE FUNCTION public._tx_wallet_delta(_kind text, _amount numeric, _category_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _kind = 'income'   THEN RETURN _amount; END IF;
  IF _kind = 'expense'  THEN RETURN -_amount; END IF;
  IF _kind = 'transfer' THEN RETURN -_amount; END IF;
  -- debt and savings have NO effect on wallet balance
  RETURN 0;
END;
$function$;

-- 4. Insert trigger: also credit destination wallet for transfers
CREATE OR REPLACE FUNCTION public.tx_apply_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.wallets
    SET current_balance = current_balance + public._tx_wallet_delta(NEW.kind::text, NEW.amount, NEW.category_id)
    WHERE id = NEW.wallet_id;

  IF NEW.kind::text = 'transfer' AND NEW.transfer_to_wallet_id IS NOT NULL THEN
    UPDATE public.wallets
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.transfer_to_wallet_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Update trigger
CREATE OR REPLACE FUNCTION public.tx_apply_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_delta NUMERIC := public._tx_wallet_delta(OLD.kind::text, OLD.amount, OLD.category_id);
  new_delta NUMERIC := public._tx_wallet_delta(NEW.kind::text, NEW.amount, NEW.category_id);
BEGIN
  -- Reverse old source side
  UPDATE public.wallets SET current_balance = current_balance - old_delta WHERE id = OLD.wallet_id;
  -- Reverse old destination side (for transfer)
  IF OLD.kind::text = 'transfer' AND OLD.transfer_to_wallet_id IS NOT NULL THEN
    UPDATE public.wallets SET current_balance = current_balance - OLD.amount WHERE id = OLD.transfer_to_wallet_id;
  END IF;

  -- Apply new source side
  UPDATE public.wallets SET current_balance = current_balance + new_delta WHERE id = NEW.wallet_id;
  -- Apply new destination side (for transfer)
  IF NEW.kind::text = 'transfer' AND NEW.transfer_to_wallet_id IS NOT NULL THEN
    UPDATE public.wallets SET current_balance = current_balance + NEW.amount WHERE id = NEW.transfer_to_wallet_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. Delete trigger
CREATE OR REPLACE FUNCTION public.tx_apply_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.wallets
    SET current_balance = current_balance - public._tx_wallet_delta(OLD.kind::text, OLD.amount, OLD.category_id)
    WHERE id = OLD.wallet_id;

  IF OLD.kind::text = 'transfer' AND OLD.transfer_to_wallet_id IS NOT NULL THEN
    UPDATE public.wallets
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.transfer_to_wallet_id;
  END IF;
  RETURN OLD;
END;
$function$;

-- 7. Ensure triggers exist on transactions
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
