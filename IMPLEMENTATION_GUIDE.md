# Wallet Balance Fix - Implementation Guide

## Quick Summary

**Problem**: Wallet balances were inconsistent across pages and the migration incorrectly reset them to 0.

**Solution**: Database triggers now automatically sync wallet balances when transactions change, while preserving existing opening balances.

**Status**: ✅ Code is ready, just need to run the migrations.

## Step-by-Step Implementation

### Step 1: Run the Primary Migration

This adds the `current_balance` column and preserves existing wallet data.

```bash
# The migration file already exists and is correct:
# supabase/migrations/20260623_add_wallet_balance_sync.sql

# It will:
# 1. Add current_balance column to wallets table
# 2. Copy initial_balance → current_balance (PRESERVES DATA)
# 3. Create trigger functions for insert/update/delete
# 4. Attach triggers to transactions table
```

**Expected Result**:
- ✅ Bank wallet: -251,000đ (preserved)
- ✅ Cash wallet: [original amount] (preserved)
- ✅ Triggers active (auto-sync on transaction changes)

### Step 2: If Data Was Lost (Balances = 0)

If the incorrect migration already ran:

```bash
# Run the recovery migration:
# supabase/migrations/20260623_restore_wallet_balances.sql

# This will restore all balances from initial_balance
```

**Expected Result**:
- ✅ Bank: 0 → -251,000đ
- ✅ Cash: 0 → [previous amount]

### Step 3: Deploy Frontend Code

All frontend changes are already complete in:
- `src/routes/_authenticated/wallets.tsx` - Reads `current_balance` directly
- `src/routes/_authenticated/index.tsx` - Reads `current_balance` for dashboard
- `src/components/QuickAdd.tsx` - Invalidates wallet cache
- `src/components/EditTransactionModal.tsx` - Invalidates wallet cache
- `src/routes/_authenticated/categories.tsx` - Invalidates wallet cache

No additional frontend changes needed.

### Step 4: Test the Implementation

#### Test 1: Create Transaction
1. Go to Dashboard
2. Add transaction: `20k Coffee` (expense)
3. Check:
   - ✅ Wallets page shows updated balance
   - ✅ Overview shows same balance
   - ✅ No error in console

#### Test 2: Edit Transaction
1. Edit the coffee transaction: `20k` → `50k`
2. Check:
   - ✅ Balance updated correctly (+30k)
   - ✅ Both pages show same new balance
   - ✅ No error in console

#### Test 3: Delete Transaction
1. Delete the coffee transaction
2. Check:
   - ✅ Balance returns to previous correct value
   - ✅ Both pages consistent
   - ✅ No error in console

#### Test 4: Different Transaction Types
Create transactions of each type and verify balance updates correctly:

| Type | Amount | Effect | Example |
|------|--------|--------|---------|
| Income | 100k | +100k | Salary |
| Expense | 50k | -50k | Coffee |
| Savings | 30k | -30k | Move to savings |
| Debt (Cho nợ) | 20k | -20k | Loan given out |
| Debt (Khoản nợ) | 20k | +20k | Loan received |

#### Test 5: Cross-Page Consistency
1. Create a transaction on Dashboard
2. Navigate to Wallets page
3. Navigate to Categories page
4. Go back to Dashboard
5. Check: **All pages show identical wallet balance** ✅

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ User Action: Create/Edit/Delete Transaction         │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Frontend: POST/PUT/DELETE /transactions             │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Database: transactions table updated                │
└──────────────────────┬──────────────────────────────┘
                       ↓
            ⚡ DATABASE TRIGGER FIRES ⚡
                       ↓
┌─────────────────────────────────────────────────────┐
│ Database: wallets.current_balance updated           │
│ (Automatic - no frontend code needed)               │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Frontend: Invalidate query cache                    │
│ - ["transactions"]                                  │
│ - ["wallets"]                                       │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Frontend: Refetch wallets → Read current_balance    │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ UI: All pages render with updated balance ✅        │
└─────────────────────────────────────────────────────┘
```

## Key Principles

### 1. Preserve Existing Data
- `initial_balance` = Opening balance (never changes)
- `current_balance` = Working balance (updated by triggers)
- Migration copies initial → current, doesn't recalculate

### 2. Automatic Synchronization
- Database triggers update balance on every transaction change
- No manual balance updates needed
- Frontend just reads the result

### 3. Transaction Logic (in Triggers)
```
Income      → +amount
Expense     → -amount
Savings     → -amount (save out), +amount (withdraw)
Debt        → -amount (Cho nợ = loan out)
             → +amount (Khoản nợ = loan received)
```

### 4. Consistency Guarantee
- Single source of truth: `wallets.current_balance`
- All pages read from same field
- All pages show same value
- No more inconsistencies

## Rollback Plan (If Needed)

If something goes wrong:

1. **Database**: Drop triggers and new column
   ```sql
   DROP TRIGGER IF EXISTS on_transaction_insert ON transactions;
   DROP TRIGGER IF EXISTS on_transaction_update ON transactions;
   DROP TRIGGER IF EXISTS on_transaction_delete ON transactions;
   DROP FUNCTION IF EXISTS update_wallet_balance_on_insert();
   DROP FUNCTION IF EXISTS update_wallet_balance_on_update();
   DROP FUNCTION IF EXISTS update_wallet_balance_on_delete();
   ALTER TABLE wallets DROP COLUMN IF EXISTS current_balance;
   ```

2. **Frontend**: Revert to use `initial_balance` instead of `current_balance`

3. **Restore**: Use git to checkout previous frontend code

## Deployment Checklist

- [ ] Review migrations in `supabase/migrations/`
- [ ] Confirm data backup exists
- [ ] Run primary migration: `20260623_add_wallet_balance_sync.sql`
- [ ] If needed, run recovery: `20260623_restore_wallet_balances.sql`
- [ ] Deploy frontend code
- [ ] Run Test Suite (above)
- [ ] Monitor for errors
- [ ] Verify all pages show consistent balances

## Troubleshooting

### Issue: Balances still wrong after recovery migration

**Solution**: Check if triggers are working
```sql
-- Verify triggers exist
SELECT * FROM pg_trigger 
WHERE tgname LIKE 'on_transaction_%';

-- Should show 3 triggers: on_transaction_insert, on_transaction_update, on_transaction_delete
```

### Issue: Creating transaction doesn't update balance

**Solution**: Check trigger function
```sql
-- Test the insert trigger
INSERT INTO transactions (wallet_id, user_id, kind, amount, occurred_at)
VALUES ('wallet_id', 'user_id', 'expense', 10000, now());

-- Check if balance changed
SELECT id, current_balance FROM wallets WHERE id = 'wallet_id';
```

### Issue: Pages show different balances

**Solution**: Manually resync
```sql
-- Option 1: Copy from initial_balance (safe, if initial is correct)
UPDATE wallets SET current_balance = initial_balance;

-- Option 2: Recalculate from transactions (if you trust transaction history)
UPDATE wallets w
SET current_balance = w.initial_balance + COALESCE(
  (SELECT SUM(CASE 
    WHEN t.kind = 'income' THEN t.amount
    WHEN t.kind = 'expense' THEN -t.amount
    WHEN t.kind = 'savings' THEN -t.amount
    WHEN t.kind = 'debt' AND c.name = 'Cho nợ' THEN -t.amount
    WHEN t.kind = 'debt' THEN t.amount
    ELSE 0
   END)
   FROM transactions t
   LEFT JOIN categories c ON t.category_id = c.id
   WHERE t.wallet_id = w.id),
  0
);
```

## Documentation Files

- `WALLET_BALANCE_FIX.md` - Complete technical documentation
- `MIGRATION_FIX_SUMMARY.md` - What went wrong and why
- `IMPLEMENTATION_GUIDE.md` - This file

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review the migration files for syntax errors
3. Check database logs for trigger errors
4. Verify transaction history is intact
5. Ensure frontend cache is cleared
