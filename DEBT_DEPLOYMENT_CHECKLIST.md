# Debt Logic Deployment Checklist

## Pre-Deployment Verification

- [ ] Both migration files exist:
  - `supabase/migrations/20260623_add_wallet_balance_sync.sql`
  - `supabase/migrations/20260624_recalculate_wallet_balances.sql`
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] Frontend code is ready (already updated)
- [ ] Database is backed up

## Migration Order (CRITICAL)

**DO NOT RUN OUT OF ORDER**

1. **FIRST**: Run `20260623_add_wallet_balance_sync.sql`
   - Creates `current_balance` column
   - Creates trigger functions
   - Creates triggers
   - This is idempotent (can rerun safely)

2. **SECOND**: Run `20260624_recalculate_wallet_balances.sql`
   - Recalculates all wallet balances with debt logic
   - MUST run after migration 1

## Post-Deployment Verification

### Database Checks

**1. Verify column created:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='wallets' AND column_name='current_balance';
```
Expected: Returns one row with type `numeric`

**2. Verify triggers created:**
```sql
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table='transactions';
```
Expected: Returns 3 rows (insert, update, delete)

**3. Verify data populated:**
```sql
SELECT id, name, initial_balance, current_balance 
FROM public.wallets 
LIMIT 5;
```
Expected: `current_balance` NOT 0 for wallets with transactions

### Functional Tests

**Test 1: Income Transaction**
- Create income of 1,000,000đ
- Verify wallet balance increased by 1,000,000
- Check both Wallet page and Overview show same amount

**Test 2: Expense Transaction**
- Create expense of 500,000đ
- Verify wallet balance decreased by 500,000
- Verify wallet shows negative if applicable

**Test 3: Lending (Cho nợ)**
- Create debt transaction: 300,000đ, category "Cho nợ"
- Verify wallet balance decreased by 300,000
- Example: 5,000,000 → 4,700,000
- Verify debt is tracked separately (not added to wallet)

**Test 4: Borrowing (Khoản nợ)**
- Create debt transaction: 200,000đ, category "Khoản nợ"
- Verify wallet balance increased by 200,000
- Verify amount sign handled correctly

**Test 5: Savings Transaction**
- Create savings transaction: 500,000đ
- Verify wallet balance NOT changed
- Verify savings shown in dashboard separately

**Test 6: Edit Transaction**
- Edit expense from 500,000 to 600,000
- Verify wallet balance changed by difference (100,000)

**Test 7: Delete Transaction**
- Delete a transaction
- Verify wallet balance reverted correctly

### Frontend Verification

**Wallet Page:**
- [ ] Shows `current_balance` for each wallet
- [ ] Supports negative values (e.g., -251,000đ)
- [ ] Matches Overview page balance

**Overview Page:**
- [ ] Wallet sum = sum of all wallet current_balances
- [ ] Savings pot = sum of all savings transactions
- [ ] Total Assets = Wallet sum + Savings pot
- [ ] Matches Wallets page individual balances

## Rollback Procedure

If issues occur, you can recalculate balances:

```sql
-- Recalculate all wallets using correct formula
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
```

## Success Criteria

✅ All wallet balances correctly calculated
✅ Income/expense transactions working
✅ Debt transactions (lending) decreasing wallet
✅ Debt transactions (borrowing) increasing wallet
✅ Savings transactions not affecting wallet
✅ Wallet page = Overview page balance
✅ Negative balances supported
✅ All transaction edits/deletes updating balance correctly
