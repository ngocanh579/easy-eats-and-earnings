
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18,2) NOT NULL DEFAULT 0;

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

CREATE OR REPLACE FUNCTION public._tx_wallet_delta(_kind text, _amount numeric, _category_id uuid)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name TEXT;
BEGIN
  IF _kind = 'income'  THEN RETURN _amount; END IF;
  IF _kind = 'expense' THEN RETURN -_amount; END IF;
  IF _kind = 'debt' THEN
    SELECT name INTO cat_name FROM public.categories WHERE id = _category_id;
    IF cat_name = 'Cho nợ' THEN RETURN -_amount; ELSE RETURN _amount; END IF;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_apply_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.wallets
    SET current_balance = current_balance + public._tx_wallet_delta(NEW.kind::text, NEW.amount, NEW.category_id)
    WHERE id = NEW.wallet_id;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.tx_apply_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_delta NUMERIC := public._tx_wallet_delta(OLD.kind::text, OLD.amount, OLD.category_id);
  new_delta NUMERIC := public._tx_wallet_delta(NEW.kind::text, NEW.amount, NEW.category_id);
BEGIN
  IF OLD.wallet_id <> NEW.wallet_id THEN
    UPDATE public.wallets SET current_balance = current_balance - old_delta WHERE id = OLD.wallet_id;
    UPDATE public.wallets SET current_balance = current_balance + new_delta WHERE id = NEW.wallet_id;
  ELSE
    UPDATE public.wallets SET current_balance = current_balance + (new_delta - old_delta) WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.tx_apply_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.wallets
    SET current_balance = current_balance - public._tx_wallet_delta(OLD.kind::text, OLD.amount, OLD.category_id)
    WHERE id = OLD.wallet_id;
  RETURN OLD;
END;$$;

DROP TRIGGER IF EXISTS trg_tx_after_insert ON public.transactions;
DROP TRIGGER IF EXISTS trg_tx_after_update ON public.transactions;
DROP TRIGGER IF EXISTS trg_tx_after_delete ON public.transactions;

CREATE TRIGGER trg_tx_after_insert AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_apply_insert();
CREATE TRIGGER trg_tx_after_update AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_apply_update();
CREATE TRIGGER trg_tx_after_delete AFTER DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_apply_delete();
