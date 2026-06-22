# Wallet Balance Sync - Deployment Guide

## Current State
- Cash wallet: 0
- Bank wallet: 0
- Total assets: 50,000 (from Savings, incorrectly included)

## Expected State After Fix
- Bank wallet: -251,000 (or correct calculated balance)
- Cash wallet: [correct calculated balance]
- Savings: 50,000 (tracked separately)
- Total assets: Bank + Cash + Savings

## Deployment Steps

### 1. **Deploy Migrations to Database**

Run these migrations in order on your Supabase database:

#### Migration 1: Fixed Triggers
**File**: `supabase/migrations/20260623_add_wallet_balance_sync.sql`

This migration:
- Adds `current_balance` column to wallets
- Creates triggers that update wallet balance on INSERT/UPDATE/DELETE
- **Excludes Savings transactions** from wallet balance

```sql
-- The triggers now correctly handle:
-- income: +amount
-- expense: -amount  
-- debt: -amount if "Cho nợ", +amount otherwise
-- savings: 0 (NOT included)
```

#### Migration 2: Recalculate Balances
**File**: `supabase/migrations/20260624_recalculate_wallet_balances.sql`

This migration:
- Recalculates `current_balance` for all existing wallets
- Uses the correct formula: initial_balance + income - expense + debt effects
- Excludes Savings from the calculation

```sql
-- Result:
-- Bank -251,000 if: initial 1,379,000 - rent 1,630,000
-- Cash keeps correct balance without Savings
```

### 2. **Verify Database Changes**

After migrations run, execute this verification SQL:

```sql
-- Check if current_balance column exists and has values
SELECT id, name, initial_balance, current_balance 
FROM wallets 
ORDER BY created_at;

-- Should show:
-- Bank: initial_balance=1379000, current_balance=-251000
-- Cash: initial_balance=X, current_balance=X (if no transactions)

-- Verify Savings are NOT in wallet balance
SELECT kind, COUNT(*), SUM(amount) 
FROM transactions 
WHERE kind IN ('income', 'expense', 'debt', 'savings')
GROUP BY kind;
```

### 3. **Deploy Frontend Code**

Current frontend code is already correct:
- ✓ Reads `current_balance` from wallet
- ✓ Calculates `savingsPot` from Savings transactions only
- ✓ Shows `total = walletSum + savingsPot`
- ✓ TypeScript compiles without errors

Just deploy the current codebase as-is.

### 4. **Manual Data Recovery (If Needed)**

If wallet balances are still showing 0 after migrations:

```sql
-- Manually restore and recalculate all wallet balances
UPDATE public.wallets w
SET current_balance = w.initial_balance + COALESCE(
  (SELECT COALESCE(SUM(
    CASE 
      WHEN t.kind = 'income' THEN t.amount
      WHEN t.kind = 'expense' THEN -t.amount
      WHEN t.kind = 'debt' THEN (
        CASE 
          WHEN c.name = 'Cho nợ' THEN -t.amount
          ELSE t.amount
        END
      )
      WHEN t.kind = 'savings' THEN 0
      ELSE 0
    END
  ), 0)
  FROM public.transactions t
  LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.wallet_id = w.id AND t.user_id = w.user_id),
  0
);
```

## Testing Checklist

After deployment:

- [ ] Bank wallet shows -251,000 (or correct negative balance)
- [ ] Cash wallet shows correct positive balance
- [ ] Total assets = Bank + Cash + Savings
- [ ] Overview page shows same balance as Wallets page
- [ ] Create new income transaction → bank balance increases
- [ ] Create new expense transaction → bank balance decreases
- [ ] Create new savings transaction → wallet balance unchanged, total assets increases
- [ ] Edit transaction → balance updates correctly
- [ ] Delete transaction → balance reverts correctly

## Key Differences

### Before Fix
```
Wallet Balance = initial_balance + income - expense + debt + SAVINGS ❌
Total Assets = Wallet Sum ❌
Result: Wallet shows 0, but Total Assets shows Savings incorrectly
```

### After Fix
```
Wallet Balance = initial_balance + income - expense + debt (NO SAVINGS) ✓
Savings Balance = Sum of Savings transactions ✓
Total Assets = Wallet Sum + Savings ✓
```

## Rollback Plan

If issues occur:

1. Revert to previous migration state
2. The triggers will stop updating balances
3. Wallets will retain their `current_balance` value
4. No data loss (all transactions remain)

## Support

If balances still don't show correctly:

1. Check that both migrations have been applied
2. Verify `current_balance` column exists: `\d wallets`
3. Check triggers exist: `SELECT * FROM information_schema.triggers WHERE event_object_table = 'transactions'`
4. Manually run recalculation SQL above if needed
