# Wallet Balance Migration Checklist

## What Was Fixed

| Issue | Solution |
|-------|----------|
| Wallet balance = 0 | Now reads from `initial_balance + income - expense` |
| Savings included in wallet | Now excluded (tracked separately) |
| Debt included in wallet | Now excluded (tracked separately) |
| Balance not updating on transactions | Now auto-synced via database triggers |
| Overview ≠ Wallets page | Now both read same `current_balance` |

## Two Simple Migrations

### Migration 1: `20260623_add_wallet_balance_sync.sql`
- Adds `current_balance` column
- Initializes with `initial_balance`
- Creates 3 database triggers

**Formula in Triggers**:
- Income transactions: `+amount`
- Expense transactions: `-amount`
- Savings/Debt: `0` (not counted)

### Migration 2: `20260624_recalculate_wallet_balances.sql`
- Recalculates ALL wallet balances
- Uses formula: `initial_balance + income - expense`

## Expected Results After Migration

```
Bank Wallet
Before:  1,379,000đ
Rent (expense): -1,630,000đ
After:   -251,000đ ✓

Cash Wallet  
Before:  500,000đ
Income:  +200,000đ
After:   700,000đ ✓

Savings Pot
(Separate from wallet)
Savings transactions: 150,000đ ✓

Total Assets
-251,000 + 700,000 + 150,000 = 599,000đ ✓
```

## Verification Steps

1. **Check Wallets Page**
   - Bank: -251,000đ
   - Cash: [correct value]

2. **Check Overview**
   - Same balances as Wallets page
   - Total Assets = sum of all wallets + savings

3. **Test Transactions**
   - Add income → wallet increases
   - Add expense → wallet decreases
   - Add savings → wallet unchanged
   - Delete transaction → balance reverts

4. **Test Edge Cases**
   - Negative balances work: ✓
   - Edit transaction updates balance: ✓
   - Multiple wallets show correct values: ✓

## Rollback (If Needed)

```sql
-- If something goes wrong, preserve your data:
SELECT * INTO wallets_backup FROM public.wallets;
SELECT * INTO transactions_backup FROM public.transactions;
```

## Files Modified

- ✅ `/supabase/migrations/20260623_add_wallet_balance_sync.sql`
- ✅ `/supabase/migrations/20260624_recalculate_wallet_balances.sql`
- ✅ Frontend code (already uses `current_balance`)
- ✅ TypeScript: Compiles without errors

## Questions?

See `WALLET_BALANCE_FINAL_GUIDE.md` for complete implementation details.
