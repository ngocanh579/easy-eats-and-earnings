
-- Enums
CREATE TYPE public.wallet_type AS ENUM ('cash', 'bank', 'ewallet', 'savings', 'other');
CREATE TYPE public.category_kind AS ENUM ('expense', 'income', 'debt', 'savings');
CREATE TYPE public.budget_period AS ENUM ('1', '3', '6', '12');

-- Wallets
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.wallet_type NOT NULL DEFAULT 'cash',
  initial_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallets_user ON public.wallets(user_id);

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_user ON public.categories(user_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  kind public.category_kind NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user_date ON public.transactions(user_id, occurred_at DESC);
CREATE INDEX idx_tx_wallet ON public.transactions(wallet_id);
CREATE INDEX idx_tx_category ON public.transactions(category_id);

-- Budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  period public.budget_period NOT NULL DEFAULT '1',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_budgets_user ON public.budgets(user_id);

-- RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_owner_all" ON public.wallets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_owner_all" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_owner_all" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets_owner_all" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed default categories on signup
CREATE OR REPLACE FUNCTION public.seed_default_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, kind, icon, color, is_default) VALUES
    (NEW.id, 'Ăn uống', 'expense', '🍜', '#ef4444', true),
    (NEW.id, 'Đi lại', 'expense', '🚕', '#f59e0b', true),
    (NEW.id, 'Mua sắm', 'expense', '🛍️', '#ec4899', true),
    (NEW.id, 'Hoá đơn', 'expense', '🧾', '#8b5cf6', true),
    (NEW.id, 'Lương', 'income', '💰', '#10b981', true),
    (NEW.id, 'Thưởng', 'income', '🎁', '#22c55e', true),
    (NEW.id, 'Cho vay', 'debt', '📤', '#f97316', true),
    (NEW.id, 'Đi vay', 'debt', '📥', '#dc2626', true),
    (NEW.id, 'Quỹ dự phòng', 'savings', '🛟', '#06b6d4', true),
    (NEW.id, 'Du lịch', 'savings', '✈️', '#3b82f6', true);

  INSERT INTO public.wallets (user_id, name, type, initial_balance, icon, color) VALUES
    (NEW.id, 'Tiền mặt', 'cash', 0, '💵', '#10b981'),
    (NEW.id, 'Ngân hàng', 'bank', 0, '🏦', '#4f46e5');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.seed_default_data();
