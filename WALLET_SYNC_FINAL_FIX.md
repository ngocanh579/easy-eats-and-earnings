# Wallet Balance Sync - Final Fix

## Problem Summary

After the initial migration, wallet balances became 0 because:
1. Triggers were recalculating balances from transactions
2. **Savings transactions were incorrectly included in wallet balance**
3. Should be: Wallet balance = initial_balance + income - expense + debt effects
4. Total assets = Wallet sum + Savings (separately)

## The Fix

### 1. Fixed Migration: `20260623_add_wallet_balance_sync.sql`

**Key Changes:**
- Updated INSERT trigger to **exclude Savings** (delta = 0 for savings kind)
- Updated UPDATE trigger to **exclude Savings** (delta = 0 for savings kind)  
- Updated DELETE trigger to **exclude Savings** (delta = 0 for savings kind)
- Triggers now only count: income, expense, and debt transactions

**Transaction Handling:**
- `income`: +amount (adds to wallet)
- `expense`: -amount (removes from wallet)
- `debt`: -amount if "Cho nợ" (lending), +amount otherwise (borrowing)
- `savings`: 0 (does NOT affect wallet balance)

### 2. New Migration: `20260624_recalculate_wallet_balances.sql`

Recalculates all wallet balances with correct logic:
```
wallet.current_balance = initial_balance + SUM(income - expense + debt_effect)
```

**For each wallet:**
- Starts with `initial_balance` (existing wallet balance)
- Adds all income transactions
- Subtracts all expense transactions  
- Applies debt effects (subtracts lending, adds borrowing)
- **Excludes all Savings transactions**

### 3. Frontend (Already Correct)

**Dashboard/Overview Page:**
- `balanceByWalletId`: Reads `current_balance` from database
- `savingsPot`: Sums only `kind='savings'` transactions
- `walletSum`: Sum of all wallet `current_balance` values
- `total`: `walletSum + savingsPot`

**Wallets Page:**
- Displays each wallet's `current_balance`

## Migration Steps

### Step 1: Apply Fixed Trigger Migration
```bash
# Applies corrected triggers that exclude Savings from wallet balance
# File: 20260623_add_wallet_balance_sync.sql
```

### Step 2: Apply Balance Recalculation Migration
```bash
# Recalculates all wallet balances with correct logic
# File: 20260624_recalculate_wallet_balances.sql
```

### Step 3: Deploy Frontend Code
- Already updated to read `current_balance`
- Already calculates Savings separately
- TypeScript compiles without errors

## Data Flow After Fix

### Creating a Transaction
1. User creates rent payment: -1,630,000
2. Database INSERT trigger fires
3. Trigger calculates: delta = -1,630,000 (expense)
4. Trigger updates: wallet.current_balance -= 1,630,000
5. Bank wallet: 1,379,000 - 1,630,000 = -251,000 ✓
6. Frontend invalidates cache, rerenders
7. Both Overview and Wallets show -251,000

### Savings Transaction
1. User adds savings: +50,000
2. Database INSERT trigger fires
3. Trigger calculates: delta = 0 (savings kind)
4. Trigger does NOT update wallet balance
5. Wallet stays same
6. `savingsPot` increases by 50,000
7. `total = walletSum + savingsPot` includes the 50,000 ✓

## Expected Results After Migration

### Balance Calculations
- **Bank wallet**: -251,000 (from 1,379,000 - 1,630,000 rent)
- **Cash wallet**: [initial + transactions] (excluding savings)
- **Savings**: Sum of all savings transactions (not in wallet balance)
- **Total assets**: Bank + Cash + Savings

### Key Requirements Met
✓ Wallet balance recalculated from historical transactions
✓ Supports negative balance (-251,000 works)
✓ Savings kept separate from wallet balance
✓ Total assets = wallet sum + savings sum
✓ No double counting
✓ Wallet page and Overview show same balance
✓ All pages use same calculation source (database field)

## Verification SQL

After migrations run, verify:

```sql
-- Check wallet balances are correct
SELECT id, name, initial_balance, current_balance 
FROM wallets 
ORDER BY created_at;

-- Verify Bank wallet calculation
-- If initial_balance was 1,379,000 and rent was -1,630,000
-- Expected current_balance: -251,000
SELECT * FROM wallets WHERE name = 'Bank';

-- Check transaction count
SELECT wallet_id, COUNT(*), SUM(amount) 
FROM transactions 
WHERE kind IN ('income', 'expense', 'debt')
GROUP BY wallet_id;

-- Verify Savings are separate
SELECT SUM(amount) as total_savings 
FROM transactions 
WHERE kind = 'savings';
```

## Files Changed

### Database Migrations
- `supabase/migrations/20260623_add_wallet_balance_sync.sql` - Fixed triggers
- `supabase/migrations/20260624_recalculate_wallet_balances.sql` - Recalculation

### Frontend
- `src/routes/_authenticated/index.tsx` - Correctly reads `current_balance`
- `src/routes/_authenticated/wallets.tsx` - Correctly reads `current_balance`

All changes preserve existing data and properly handle negative balances.
