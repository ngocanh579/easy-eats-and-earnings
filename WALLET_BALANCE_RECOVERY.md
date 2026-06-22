# Wallet Balance Recovery Guide

## Problem
After migration, wallet balances were incorrectly reset to 0, losing existing balance data.

**Example:**
- Bank balance before: -251,000đ (existing balance from before transactions)
- After migration: 0 (lost data)
- Expected: -251,000đ (should preserve initial balance)

## Root Cause
The previous migration had a faulty WHERE clause that didn't properly preserve existing balances.

## Solution

### Step 1: Verify Current Data State

Before running any migration, check your database to see the current state:

```sql
SELECT id, name, initial_balance, current_balance FROM public.wallets;
```

Expected output might look like:
```
id   | name  | initial_balance | current_balance
-----|-------|-----------------|----------------
xxx  | Bank  | -251000.00      | 0.00           (WRONG - lost data)
yyy  | Cash  | 50000.00        | 0.00           (WRONG - lost data)
```

### Step 2: Fix the Migration

Two corrected migrations are now in place:

**Primary Migration**: `20260623_add_wallet_balance_sync.sql`
- Adds `current_balance` column (if not already added)
- **Unconditionally** sets `current_balance = initial_balance`
- Creates database triggers for automatic balance sync
- **Does NOT recalculate from transactions**

**Recovery Migration**: `20260623_restore_wallet_balances.sql`
- Restores `current_balance` from `initial_balance` for all wallets
- Use this if balances were already reset to 0

### Step 3: Restore Balances (If Data Was Lost)

If your balances are currently 0 and need restoration:

```sql
-- Run the recovery migration
UPDATE public.wallets 
SET current_balance = initial_balance;

-- Verify it worked
SELECT id, name, initial_balance, current_balance FROM public.wallets;
```

After this, you should see:
```
id   | name  | initial_balance | current_balance
-----|-------|-----------------|----------------
xxx  | Bank  | -251000.00      | -251000.00      (CORRECT - restored)
yyy  | Cash  | 50000.00        | 50000.00        (CORRECT - restored)
```

### Step 4: Verify Triggers Are Active

Check that database triggers exist:

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'transactions'
ORDER BY trigger_name;
```

Expected triggers:
- `on_transaction_insert` - Updates balance when transaction created
- `on_transaction_update` - Updates balance when transaction edited
- `on_transaction_delete` - Updates balance when transaction deleted

### Step 5: Deploy Frontend Code

The frontend code is already updated to:
- Read balances from `current_balance` column
- Invalidate wallets cache when transactions change
- Show same balance on all pages (Wallets page, Overview, Dashboard)

No additional frontend deployment needed - the code changes are ready.

### Step 6: Test the Fix

Test that everything works correctly:

#### Test 1: Create a Transaction
1. Go to the app and add a new transaction (e.g., Expense: 100,000đ)
2. Check **Wallets page** - balance should decrease by 100,000đ
3. Check **Overview/Dashboard** - balance should match Wallets page
4. Verify balance is calculated correctly in **database**

#### Test 2: Edit a Transaction
1. Edit the transaction from 100,000đ to 50,000đ
2. Balance should be recalculated: removed old delta (-100,000), applied new delta (-50,000)
3. Verify on both Wallets page and Overview - should be identical

#### Test 3: Delete a Transaction
1. Delete the transaction
2. Balance should return to the previous value (before the transaction)
3. Verify on both pages

#### Test 4: Verify Negative Balances Work
1. Bank account can show negative balance (like -251,000đ)
2. This value persists and is used as the base for future transactions
3. New transactions are calculated from this preserved base

## How Wallet Balance Sync Works

### Data Flow

```
User Action (Create/Edit/Delete Transaction)
        ↓
Frontend API Call (Supabase)
        ↓
Database Trigger (Automatic)
        ↓
Wallet.current_balance Updated
        ↓
Frontend Invalidates Cache
        ↓
All Pages Refetch Wallets
        ↓
All Pages Show Same Balance
```

### Important Points

1. **Initial Balance is Preserved**: `current_balance` = `initial_balance` (the base starting point)
2. **Transactions Update Balance**: Each transaction triggers update: `current_balance += delta`
3. **Single Update**: Balance is updated once per transaction (via database trigger)
4. **No Recalculation**: Frontend doesn't recalculate - it reads the DB value
5. **Negative Balances Supported**: Bank can have -251,000đ as the current_balance

## Verification SQL

Run these queries to verify the fix is working:

```sql
-- Check all wallets have correct current_balance
SELECT id, name, initial_balance, current_balance FROM public.wallets;

-- Check a specific wallet's balance history (via transactions)
SELECT w.id, w.name, w.current_balance, COUNT(t.id) as transaction_count
FROM public.wallets w
LEFT JOIN public.transactions t ON w.id = t.wallet_id
GROUP BY w.id, w.name, w.current_balance;

-- Check if triggers are executing (look at updated_at timestamp)
SELECT id, wallet_id, kind, amount, updated_at
FROM public.transactions
ORDER BY updated_at DESC
LIMIT 5;
```

## Summary

The wallet balance fix ensures:
- ✅ Existing wallet balances are preserved (not reset to 0)
- ✅ Negative balances are supported and maintained
- ✅ Database triggers automatically update balance on transaction changes
- ✅ Frontend reads from single source of truth (`current_balance`)
- ✅ All pages show identical balance
- ✅ Only one balance update per transaction (via trigger, not frontend recalculation)
