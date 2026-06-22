
-- Update seed function to create parent Nợ + Tiết kiệm with children
CREATE OR REPLACE FUNCTION public.seed_default_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  debt_parent_id uuid;
  sav_parent_id uuid;
BEGIN
  INSERT INTO public.categories (user_id, name, kind, icon, color, is_default) VALUES
    (NEW.id, 'Ăn uống', 'expense', '🍜', '#ef4444', true),
    (NEW.id, 'Đi lại', 'expense', '🚕', '#f59e0b', true),
    (NEW.id, 'Mua sắm', 'expense', '🛍️', '#ec4899', true),
    (NEW.id, 'Hoá đơn', 'expense', '🧾', '#8b5cf6', true),
    (NEW.id, 'Lương', 'income', '💰', '#10b981', true),
    (NEW.id, 'Thưởng', 'income', '🎁', '#22c55e', true);

  INSERT INTO public.categories (user_id, name, kind, icon, color, is_default)
    VALUES (NEW.id, 'Nợ', 'debt', '💳', '#f97316', true)
    RETURNING id INTO debt_parent_id;

  INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id) VALUES
    (NEW.id, 'Khoản nợ', 'debt', '📥', '#dc2626', true, debt_parent_id),
    (NEW.id, 'Cho nợ', 'debt', '📤', '#f97316', true, debt_parent_id);

  INSERT INTO public.categories (user_id, name, kind, icon, color, is_default)
    VALUES (NEW.id, 'Tiết kiệm', 'savings', '🐷', '#06b6d4', true)
    RETURNING id INTO sav_parent_id;

  INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id) VALUES
    (NEW.id, 'Tiết kiệm hộ', 'savings', '🤝', '#06b6d4', true, sav_parent_id),
    (NEW.id, 'Khoản tiết kiệm đồ muốn mua', 'savings', '🛒', '#3b82f6', true, sav_parent_id),
    (NEW.id, 'Dự phòng', 'savings', '🛟', '#0ea5e9', true, sav_parent_id);

  INSERT INTO public.wallets (user_id, name, type, initial_balance, icon, color) VALUES
    (NEW.id, 'Tiền mặt', 'cash', 0, '💵', '#10b981'),
    (NEW.id, 'Ngân hàng', 'bank', 0, '🏦', '#4f46e5');
  RETURN NEW;
END;
$function$;

-- Backfill for existing users
DO $$
DECLARE
  u uuid;
  debt_parent_id uuid;
  sav_parent_id uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.categories LOOP
    -- Debt parent
    SELECT id INTO debt_parent_id FROM public.categories
      WHERE user_id = u AND kind = 'debt' AND name = 'Nợ' AND parent_id IS NULL
      LIMIT 1;
    IF debt_parent_id IS NULL THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default)
        VALUES (u, 'Nợ', 'debt', '💳', '#f97316', true)
        RETURNING id INTO debt_parent_id;
    END IF;

    -- Rename legacy debt categories
    UPDATE public.categories SET name = 'Khoản nợ'
      WHERE user_id = u AND kind = 'debt' AND name = 'Đi vay' AND parent_id IS NULL;
    UPDATE public.categories SET name = 'Cho nợ'
      WHERE user_id = u AND kind = 'debt' AND name = 'Cho vay' AND parent_id IS NULL;

    -- Re-parent all other debt categories under Nợ
    UPDATE public.categories SET parent_id = debt_parent_id
      WHERE user_id = u AND kind = 'debt' AND parent_id IS NULL AND id <> debt_parent_id;

    -- Ensure both children exist
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = u AND kind = 'debt' AND name = 'Khoản nợ' AND parent_id = debt_parent_id) THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id)
        VALUES (u, 'Khoản nợ', 'debt', '📥', '#dc2626', true, debt_parent_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = u AND kind = 'debt' AND name = 'Cho nợ' AND parent_id = debt_parent_id) THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id)
        VALUES (u, 'Cho nợ', 'debt', '📤', '#f97316', true, debt_parent_id);
    END IF;

    -- Savings parent
    SELECT id INTO sav_parent_id FROM public.categories
      WHERE user_id = u AND kind = 'savings' AND name = 'Tiết kiệm' AND parent_id IS NULL
      LIMIT 1;
    IF sav_parent_id IS NULL THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default)
        VALUES (u, 'Tiết kiệm', 'savings', '🐷', '#06b6d4', true)
        RETURNING id INTO sav_parent_id;
    END IF;

    -- Rename legacy savings
    UPDATE public.categories SET name = 'Dự phòng'
      WHERE user_id = u AND kind = 'savings' AND name = 'Quỹ dự phòng' AND parent_id IS NULL;

    -- Re-parent all other savings categories under Tiết kiệm
    UPDATE public.categories SET parent_id = sav_parent_id
      WHERE user_id = u AND kind = 'savings' AND parent_id IS NULL AND id <> sav_parent_id;

    -- Ensure all three children exist
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = u AND kind = 'savings' AND name = 'Tiết kiệm hộ' AND parent_id = sav_parent_id) THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id)
        VALUES (u, 'Tiết kiệm hộ', 'savings', '🤝', '#06b6d4', true, sav_parent_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = u AND kind = 'savings' AND name = 'Khoản tiết kiệm đồ muốn mua' AND parent_id = sav_parent_id) THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id)
        VALUES (u, 'Khoản tiết kiệm đồ muốn mua', 'savings', '🛒', '#3b82f6', true, sav_parent_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = u AND kind = 'savings' AND name = 'Dự phòng' AND parent_id = sav_parent_id) THEN
      INSERT INTO public.categories (user_id, name, kind, icon, color, is_default, parent_id)
        VALUES (u, 'Dự phòng', 'savings', '🛟', '#0ea5e9', true, sav_parent_id);
    END IF;
  END LOOP;
END $$;
