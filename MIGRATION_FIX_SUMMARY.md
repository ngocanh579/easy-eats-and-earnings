# Wallet Balance Migration - Issue & Fix

## What Went Wrong

The initial migration `20260623_add_wallet_balance_sync.sql` incorrectly **recalculated wallet balances from transactions**, which reset existing balances to 0:

```sql
-- ❌ WRONG (removed)
UPDATE public.wallets w
SET current_balance = w.initial_balance + COALESCE(
  (SELECT COALESCE(SUM(...), 0)
   FROM public.transactions t
   LEFT JOIN public.categories c ON t.category_id = c.id
   WHERE t.wallet_id = w.id),
  0
);
```

### Data Loss Example
- **Before Migration**: Bank wallet = -251,000đ (existing opening balance)
- **After Wrong Migration**: Bank wallet = 0 (lost the -251,000đ)
- **Expected**: Bank wallet should stay = -251,000đ

## The Correct Fix

The migration now **preserves existing wallet balances** by simply copying `initial_balance` to `current_balance`:

```sql
-- ✅ CORRECT (current implementation)
UPDATE public.wallets 
SET current_balance = initial_balance
WHERE current_balance = 0;
```

### Why This Works

1. **`initial_balance`** = The original wallet balance set when wallet was created
   - This is the TRUE opening balance (what the user had at start)
   - Example: User created wallet with 50,000đ → `initial_balance = 50,000`

2. **`current_balance`** = What the wallet has now (changes as transactions occur)
   - Initialized to: `initial_balance` (preserve what we had)
   - Then updated by database triggers as transactions are added/edited/deleted
   - Example: 50,000 + 100,000 income - 20,000 expense = 130,000

3. **Transactions** = Are applied ON TOP of the preserved balance
   - Only NEW transactions update the balance via triggers
   - Existing transactions don't affect the preserved starting balance

## How to Recover If Data Was Lost

If the incorrect migration already ran and reset balances to 0:

1. **Run the recovery migration**: `20260623_restore_wallet_balances.sql`
   ```sql
   UPDATE public.wallets 
   SET current_balance = initial_balance;
   ```
   This restores all wallet balances to their original values

2. **Result**:
   - Bank: 0 → -251,000đ ✅
   - Cash: 0 → [previous correct balance] ✅

## Files Updated

- `supabase/migrations/20260623_add_wallet_balance_sync.sql` - Fixed to preserve balances
- `supabase/migrations/20260623_restore_wallet_balances.sql` - NEW: Recovery migration
- `WALLET_BALANCE_FIX.md` - Documentation updated with correct approach

## Frontend Changes (Already Done)

✅ Simplified all pages to read `wallet.current_balance` directly
✅ Removed 60+ lines of duplicate calculation logic
✅ Added proper cache invalidation on transaction changes
✅ All pages now show identical wallet balance

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Balance Source** | Recalculated on every page | Single `current_balance` field |
| **Data Preservation** | ❌ Lost existing balances | ✅ Preserves `initial_balance` |
| **Consistency** | ❌ Different per page | ✅ Same everywhere |
| **Frontend Logic** | ❌ Complex calculations | ✅ Simple field read |
| **Transaction Updates** | ❌ Manual recalc needed | ✅ Database triggers auto-sync |

The key insight: **`initial_balance` is sacred** - it represents what the user said they had. Transactions modify the balance from that starting point. We never discard the starting point.
